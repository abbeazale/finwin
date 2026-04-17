import { TRPCError } from "@trpc/server";
import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { budgets, categories, categoryGroups, transactions } from "@/db/schema";
import { db } from "@/index";
import { protectedProcedure, router } from "../trpc";

const monthPattern = /^\d{4}-\d{2}-\d{2}$/;

const monthInputSchema = z.object({
  month: z.string().regex(monthPattern),
}).superRefine((value, ctx) => {
  if (!isFirstOfMonth(value.month)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Month must be the first day of a month.",
      path: ["month"],
    });
  }
});

const upsertBudgetInput = z.object({
  categoryId: z.string().uuid(),
  month: z.string().regex(monthPattern),
  amount: z.number().finite().min(0),
}).superRefine((value, ctx) => {
  if (!isFirstOfMonth(value.month)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Month must be the first day of a month.",
      path: ["month"],
    });
  }
});

const deleteBudgetInput = z.object({
  categoryId: z.string().uuid(),
  month: z.string().regex(monthPattern),
}).superRefine((value, ctx) => {
  if (!isFirstOfMonth(value.month)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Month must be the first day of a month.",
      path: ["month"],
    });
  }
});

type SummaryStatus = "on_track" | "near_limit" | "over" | "unbudgeted" | "no_budget";

export const budgetsRouter = router({
  summary: protectedProcedure
    .input(monthInputSchema)
    .query(async ({ ctx, input }) => {
      const nextMonth = getNextMonthStart(input.month);

      const [categoryRows, budgetRows, actualRows] = await Promise.all([
        db
          .select({
            categoryId: categories.id,
            categoryName: categories.name,
            categorySortOrder: categories.sortOrder,
            categoryGroupName: categoryGroups.name,
            categoryGroupSortOrder: categoryGroups.sortOrder,
          })
          .from(categories)
          .innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
          .where(eq(categories.defaultBudgetable, true))
          .orderBy(
            asc(categoryGroups.sortOrder),
            asc(categories.sortOrder),
            asc(categories.name),
          ),
        db
          .select({
            categoryId: budgets.categoryId,
            amount: budgets.amount,
          })
          .from(budgets)
          .where(
            and(
              eq(budgets.userId, ctx.userId),
              eq(budgets.month, input.month),
            ),
          ),
        db
          .select({
            categoryId: categories.id,
            rawActual: sql<number>`coalesce(sum(${transactions.amount}), 0)`.mapWith(Number),
          })
          .from(transactions)
          .innerJoin(categories, eq(transactions.categoryId, categories.id))
          .where(
            and(
              eq(transactions.userId, ctx.userId),
              eq(categories.defaultBudgetable, true),
              gte(transactions.date, input.month),
              lt(transactions.date, nextMonth),
            ),
          )
          .groupBy(categories.id),
      ]);

      const budgetByCategory = new Map(
        budgetRows.map((row) => [row.categoryId, Number(row.amount)]),
      );
      const actualByCategory = new Map(
        actualRows.map((row) => [row.categoryId, row.rawActual]),
      );

      let totalBudgeted = 0;
      let totalActual = 0;
      let overBudgetCount = 0;
      let unbudgetedCount = 0;

      const groups = new Map<string, {
        groupName: string;
        rows: Array<{
          categoryId: string;
          categoryName: string;
          budgetAmount: string | null;
          actualAmount: string;
          remainingAmount: string | null;
          percentUsed: number | null;
          status: SummaryStatus;
        }>;
      }>();

      for (const category of categoryRows) {
        const budgetAmount = budgetByCategory.get(category.categoryId) ?? null;
        const rawActual = actualByCategory.get(category.categoryId) ?? 0;
        const actualAmount = Math.max(-rawActual, 0);
        const remainingAmount = budgetAmount === null ? null : budgetAmount - actualAmount;
        const percentUsed =
          budgetAmount !== null && budgetAmount > 0
            ? actualAmount / budgetAmount
            : null;

        const status = getBudgetStatus({
          budgetAmount,
          actualAmount,
          percentUsed,
        });

        if (budgetAmount !== null) {
          totalBudgeted += budgetAmount;
        }
        totalActual += actualAmount;

        if (status === "over") {
          overBudgetCount += 1;
        }
        if (status === "unbudgeted") {
          unbudgetedCount += 1;
        }

        const existingGroup = groups.get(category.categoryGroupName) ?? {
          groupName: category.categoryGroupName,
          rows: [],
        };

        existingGroup.rows.push({
          categoryId: category.categoryId,
          categoryName: category.categoryName,
          budgetAmount: formatMoneyValue(budgetAmount),
          actualAmount: formatMoneyValue(actualAmount) ?? "0.00",
          remainingAmount: formatMoneyValue(remainingAmount),
          percentUsed,
          status,
        });

        groups.set(category.categoryGroupName, existingGroup);
      }

      return {
        month: input.month,
        totals: {
          totalBudgeted: formatMoneyValue(totalBudgeted) ?? "0.00",
          totalActual: formatMoneyValue(totalActual) ?? "0.00",
          totalRemaining: formatMoneyValue(totalBudgeted - totalActual) ?? "0.00",
          overBudgetCount,
          unbudgetedCount,
        },
        groups: Array.from(groups.values()),
      };
    }),
  upsertMonthlyBudget: protectedProcedure
    .input(upsertBudgetInput)
    .mutation(async ({ ctx, input }) => {
      const category = await getBudgetableCategory(input.categoryId);

      if (!category) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Category is not budgetable.",
        });
      }

      await db
        .insert(budgets)
        .values({
          userId: ctx.userId,
          categoryId: input.categoryId,
          month: input.month,
          amount: input.amount.toFixed(2),
        })
        .onConflictDoUpdate({
          target: [budgets.userId, budgets.categoryId, budgets.month],
          set: {
            amount: input.amount.toFixed(2),
          },
        });

      return {
        categoryId: input.categoryId,
        month: input.month,
        amount: input.amount.toFixed(2),
      };
    }),
  deleteMonthlyBudget: protectedProcedure
    .input(deleteBudgetInput)
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(budgets)
        .where(
          and(
            eq(budgets.userId, ctx.userId),
            eq(budgets.categoryId, input.categoryId),
            eq(budgets.month, input.month),
          ),
        );

      return {
        categoryId: input.categoryId,
        month: input.month,
      };
    }),
});

function isFirstOfMonth(value: string) {
  const parts = value.split("-");
  return parts.length === 3 && parts[2] === "01";
}

function getNextMonthStart(value: string) {
  const [year, month] = value.split("-").map(Number);
  const nextDate = new Date(Date.UTC(year, month, 1));
  const nextYear = nextDate.getUTCFullYear();
  const nextMonth = `${nextDate.getUTCMonth() + 1}`.padStart(2, "0");

  return `${nextYear}-${nextMonth}-01`;
}

async function getBudgetableCategory(categoryId: string) {
  const [category] = await db
    .select({
      id: categories.id,
    })
    .from(categories)
    .where(
      and(
        eq(categories.id, categoryId),
        eq(categories.defaultBudgetable, true),
      ),
    )
    .limit(1);

  return category ?? null;
}

function getBudgetStatus({
  budgetAmount,
  actualAmount,
  percentUsed,
}: {
  budgetAmount: number | null;
  actualAmount: number;
  percentUsed: number | null;
}): SummaryStatus {
  if (budgetAmount === null) {
    return actualAmount > 0 ? "unbudgeted" : "no_budget";
  }

  if (actualAmount > budgetAmount) {
    return "over";
  }

  if (percentUsed !== null && percentUsed >= 0.85) {
    return "near_limit";
  }

  return "on_track";
}

function formatMoneyValue(value: number | null) {
  if (value === null) {
    return null;
  }

  return value.toFixed(2);
}
