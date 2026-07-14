import { TRPCError } from "@trpc/server";
import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";
import {
  budgets,
  categories,
  categoryGroups,
  transactions,
  userProfiles,
} from "@/db/schema";
import { db } from "@/index";
import type { BudgetStatus } from "@/lib/budget-status";
import { getMonthStartForTimeZone } from "@/lib/date";
import { resolveProfileTimeZone } from "@/lib/locale";
import {
  getNextMonthStart,
  monthDateRegex,
  monthInputSchema,
  refineFirstOfMonth,
} from "@/server/lib/month";
import { formatMoneyValue } from "@/server/lib/money";
import { protectedProcedure, router } from "../trpc";

const upsertBudgetInput = z
  .object({
    categoryId: z.string().uuid(),
    month: z.string().regex(monthDateRegex),
    amount: z.number().finite().min(0),
  })
  .superRefine(refineFirstOfMonth);

const deleteBudgetInput = z
  .object({
    categoryId: z.string().uuid(),
    month: z.string().regex(monthDateRegex),
  })
  .superRefine(refineFirstOfMonth);

export const budgetsRouter = router({
  context: protectedProcedure.query(async ({ ctx }) => getBudgetContext(ctx.userId)),
  summary: protectedProcedure
    .input(monthInputSchema)
    .query(async ({ ctx, input }) => {
      const nextMonth = getNextMonthStart(input.month);

      const [categoryRows, budgetRows, actualRows, budgetContext] = await Promise.all([
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
            currency: transactions.currency,
            rawActual: sql<number>`coalesce(sum(${transactions.amount}), 0)`.mapWith(Number),
            transactionCount: sql<number>`count(*)`.mapWith(Number),
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
          .groupBy(categories.id, transactions.currency),
        getBudgetContext(ctx.userId),
      ]);

      const budgetByCategory = new Map(
        budgetRows.map((row) => [row.categoryId, Number(row.amount)]),
      );
      const actualByCategory = new Map(
        actualRows
          .filter((row) => row.currency === budgetContext.currency)
          .map((row) => [row.categoryId, row.rawActual]),
      );
      const excludedCurrencyTransactionCount = actualRows
        .filter((row) => row.currency !== budgetContext.currency)
        .reduce((total, row) => total + row.transactionCount, 0);

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
          status: BudgetStatus;
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
          actualAmount: formatMoneyValue(actualAmount),
          remainingAmount: formatMoneyValue(remainingAmount),
          percentUsed,
          status,
        });

        groups.set(category.categoryGroupName, existingGroup);
      }

      return {
        month: input.month,
        currency: budgetContext.currency,
        excludedCurrencyTransactionCount,
        totals: {
          totalBudgeted: formatMoneyValue(totalBudgeted),
          totalActual: formatMoneyValue(totalActual),
          totalRemaining: formatMoneyValue(totalBudgeted - totalActual),
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
      const amount = formatMoneyValue(input.amount);

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
          amount,
        })
        .onConflictDoUpdate({
          target: [budgets.userId, budgets.categoryId, budgets.month],
          set: {
            amount,
          },
        });

      return {
        categoryId: input.categoryId,
        month: input.month,
        amount,
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

async function getBudgetContext(userId: string) {
  const [profile] = await db
    .select({
      currency: userProfiles.currency,
      timezone: userProfiles.timezone,
    })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);
  const currency = profile?.currency ?? "CAD";
  const timezone = resolveProfileTimeZone(profile?.timezone);

  return {
    currency,
    currentMonth: getMonthStartForTimeZone(new Date(), timezone),
  };
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
}): BudgetStatus {
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
