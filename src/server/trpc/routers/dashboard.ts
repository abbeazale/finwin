import { and, asc, desc, eq, gte, isNull, lt, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  bankAccounts,
  categories,
  categoryGroups,
  transactions,
} from "@/db/schema";
import { db } from "@/index";
import {
  getNextMonthStart,
  getPreviousMonthStart,
  monthInputSchema,
} from "@/server/lib/month";
import { formatMoneyValue } from "@/server/lib/money";
import {
  CATEGORY_GROUP_NAMES,
  CATEGORY_NAMES,
  DEFAULT_CATEGORY_GROUP_NAME,
  DEFAULT_CATEGORY_NAME,
} from "@/server/lib/category-taxonomy";
import { getChangeRatio, getSavingsRate } from "@/server/dashboard/aggregates";
import { protectedProcedure, router } from "../trpc";

const recentTransactionsInput = monthInputSchema.extend({
  limit: z.number().int().min(1).max(12).default(7),
});

const spendingByCategoryInput = monthInputSchema.extend({
  limit: z.number().int().min(1).max(12).default(6),
});

export const dashboardRouter = router({
  overview: protectedProcedure
    .input(monthInputSchema)
    .query(async ({ ctx, input }) => {
      const comparisonMonth = getPreviousMonthStart(input.month);

      const [current, previous] = await Promise.all([
        getOverviewSnapshot(ctx.userId, input.month),
        getOverviewSnapshot(ctx.userId, comparisonMonth),
      ]);

      const comparisonAvailable = previous.qualifyingRowCount > 0;

      return {
        month: input.month,
        comparisonMonth,
        comparisonAvailable,
        totals: {
          inflow: formatMoneyValue(current.inflow),
          outflow: formatMoneyValue(current.outflow),
          netCashflow: formatMoneyValue(current.netCashflow),
          savingsRate: getSavingsRate(current.inflow, current.netCashflow),
        },
        deltas: {
          inflow: getChangeRatio(current.inflow, previous.inflow, comparisonAvailable),
          outflow: getChangeRatio(current.outflow, previous.outflow, comparisonAvailable),
          netCashflow: getChangeRatio(
            current.netCashflow,
            previous.netCashflow,
            comparisonAvailable,
          ),
          savingsRate: getChangeRatio(
            getSavingsRate(current.inflow, current.netCashflow),
            getSavingsRate(previous.inflow, previous.netCashflow),
            comparisonAvailable,
          ),
        },
      };
    }),
  cashflow: protectedProcedure
    .input(monthInputSchema)
    .query(async ({ ctx, input }) => {
      const nextMonth = getNextMonthStart(input.month);
      const rows = await db
        .select({
          date: transactions.date,
          inflow: sql<number>`
            coalesce(sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end), 0)
          `.mapWith(Number),
          outflow: sql<number>`
            coalesce(sum(case when ${transactions.amount} < 0 then -${transactions.amount} else 0 end), 0)
          `.mapWith(Number),
          netAmount: sql<number>`coalesce(sum(${transactions.amount}), 0)`.mapWith(Number),
        })
        .from(transactions)
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .where(
          and(
            eq(transactions.userId, ctx.userId),
            gte(transactions.date, input.month),
            lt(transactions.date, nextMonth),
            getOverviewInclusionCondition(),
          ),
        )
        .groupBy(transactions.date)
        .orderBy(asc(transactions.date));

      const rowsByDate = new Map(rows.map((row) => [row.date, row]));
      const days = getMonthDays(input.month).map((date) => {
        const row = rowsByDate.get(date);
        return {
          date,
          inflowAmount: formatMoneyValue(row?.inflow ?? 0),
          outflowAmount: formatMoneyValue(row?.outflow ?? 0),
          netAmount: formatMoneyValue(row?.netAmount ?? 0),
        };
      });

      return {
        month: input.month,
        days,
      };
    }),
  spendingByCategory: protectedProcedure
    .input(spendingByCategoryInput)
    .query(async ({ ctx, input }) => {
      const nextMonth = getNextMonthStart(input.month);
      const rows = await db
        .select({
          categoryId: categories.id,
          categoryName: categories.name,
          groupName: categoryGroups.name,
          rawAmount: sql<number>`coalesce(sum(${transactions.amount}), 0)`.mapWith(Number),
        })
        .from(transactions)
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .leftJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
        .where(
          and(
            eq(transactions.userId, ctx.userId),
            gte(transactions.date, input.month),
            lt(transactions.date, nextMonth),
            getSpendingByCategoryCondition(),
          ),
        )
        .groupBy(categories.id, categories.name, categoryGroups.name);

      const normalizedRows = rows
        .map((row) => {
          const spendAmount = Math.max(-row.rawAmount, 0);

          return {
            categoryId: row.categoryId,
            categoryName: row.categoryName ?? DEFAULT_CATEGORY_NAME,
            groupName: row.groupName ?? DEFAULT_CATEGORY_GROUP_NAME,
            spendAmount,
          };
        })
        .filter((row) => row.spendAmount > 0)
        .sort((left, right) => right.spendAmount - left.spendAmount);

      const totalTrackedSpend = normalizedRows.reduce(
        (sum, row) => sum + row.spendAmount,
        0,
      );

      return {
        month: input.month,
        totals: {
          totalTrackedSpend: formatMoneyValue(totalTrackedSpend),
          categoryCount: normalizedRows.length,
        },
        rows: normalizedRows.slice(0, input.limit).map((row) => ({
          categoryId: row.categoryId,
          categoryName: row.categoryName,
          groupName: row.groupName,
          spendAmount: formatMoneyValue(row.spendAmount),
          shareOfTotal: totalTrackedSpend > 0 ? row.spendAmount / totalTrackedSpend : null,
        })),
      };
    }),
  recentTransactions: protectedProcedure
    .input(recentTransactionsInput)
    .query(async ({ ctx, input }) => {
      const nextMonth = getNextMonthStart(input.month);
      const rows = await db
        .select({
          id: transactions.id,
          date: transactions.date,
          name: transactions.name,
          merchantName: transactions.merchantName,
          amount: transactions.amount,
          currency: transactions.currency,
          pending: transactions.pending,
          accountId: bankAccounts.id,
          accountName: bankAccounts.name,
          accountMask: bankAccounts.mask,
          accountIsActive: bankAccounts.isActive,
          categoryId: categories.id,
          categoryName: categories.name,
          categoryGroupName: categoryGroups.name,
        })
        .from(transactions)
        .innerJoin(bankAccounts, eq(transactions.accountId, bankAccounts.id))
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .leftJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
        .where(
          and(
            eq(transactions.userId, ctx.userId),
            gte(transactions.date, input.month),
            lt(transactions.date, nextMonth),
          ),
        )
        .orderBy(desc(transactions.date), desc(transactions.createdAt))
        .limit(input.limit);

      return {
        month: input.month,
        rows: rows.map((row) => ({
          ...row,
          amount: row.amount.toString(),
          categoryName: row.categoryName ?? DEFAULT_CATEGORY_NAME,
          categoryGroupName: row.categoryGroupName ?? DEFAULT_CATEGORY_GROUP_NAME,
        })),
      };
    }),
});

async function getOverviewSnapshot(userId: string, month: string) {
  const nextMonth = getNextMonthStart(month);

  const [row] = await db
    .select({
      qualifyingRowCount: sql<number>`count(*)`.mapWith(Number),
      inflow: sql<number>`
        coalesce(sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end), 0)
      `.mapWith(Number),
      outflow: sql<number>`
        coalesce(sum(case when ${transactions.amount} < 0 then -${transactions.amount} else 0 end), 0)
      `.mapWith(Number),
      netCashflow: sql<number>`coalesce(sum(${transactions.amount}), 0)`.mapWith(Number),
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, month),
        lt(transactions.date, nextMonth),
        getOverviewInclusionCondition(),
      ),
    );

  return row;
}

function getOverviewInclusionCondition() {
  return or(
    isNull(categories.id),
    ne(categories.name, CATEGORY_NAMES.CREDIT_CARD_PAYMENT),
  );
}

function getSpendingByCategoryCondition() {
  return or(
    isNull(categories.id),
    and(
      ne(categoryGroups.name, CATEGORY_GROUP_NAMES.INCOME),
      ne(categoryGroups.name, CATEGORY_GROUP_NAMES.TRANSFERS),
      ne(categories.name, CATEGORY_NAMES.CREDIT_CARD_PAYMENT),
    ),
  );
}

function getMonthDays(value: string) {
  const [year, month] = value.split("-").map(Number);
  const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return Array.from({ length: dayCount }, (_, index) => {
    const day = `${index + 1}`.padStart(2, "0");
    return `${year}-${`${month}`.padStart(2, "0")}-${day}`;
  });
}
