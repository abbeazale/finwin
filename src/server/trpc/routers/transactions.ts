import { and, asc, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { bankAccounts, categories, categoryGroups, transactions } from "@/db/schema";
import { db } from "@/index";
import { protectedProcedure, router } from "../trpc";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const listTransactionsInput = z.object({
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  uncategorizedOnly: z.boolean().default(false),
  pending: z.enum(["all", "pending", "posted"]).default("all"),
  dateFrom: z.string().regex(datePattern).optional(),
  dateTo: z.string().regex(datePattern).optional(),
  includeInactiveAccounts: z.boolean().default(false),
  limit: z.number().int().min(1).max(250).default(100),
}).refine(
  (value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo,
  {
    message: "Start date must be on or before end date.",
    path: ["dateTo"],
  },
);

export const transactionsRouter = router({
  list: protectedProcedure
    .input(listTransactionsInput)
    .query(async ({ ctx, input }) => {
      const baseConditions = [eq(transactions.userId, ctx.userId)];
      const visibleAccountConditions = input.includeInactiveAccounts
        ? baseConditions
        : [...baseConditions, eq(bankAccounts.isActive, true)];

      const filteredConditions = [...visibleAccountConditions];

      if (input.accountId) {
        filteredConditions.push(eq(transactions.accountId, input.accountId));
      }

      if (input.pending === "pending") {
        filteredConditions.push(eq(transactions.pending, true));
      }

      if (input.pending === "posted") {
        filteredConditions.push(eq(transactions.pending, false));
      }

      if (input.dateFrom) {
        filteredConditions.push(gte(transactions.date, input.dateFrom));
      }

      if (input.dateTo) {
        filteredConditions.push(lte(transactions.date, input.dateTo));
      }

      if (input.uncategorizedOnly) {
        filteredConditions.push(isNull(transactions.categoryId));
      } else if (input.categoryId) {
        filteredConditions.push(eq(transactions.categoryId, input.categoryId));
      }

      const [rows, [{ totalCount }], [{ uncategorizedCount }], accounts, categoryRows] = await Promise.all([
        db
          .select({
            id: transactions.id,
            date: transactions.date,
            authorizedDate: transactions.authorizedDate,
            name: transactions.name,
            merchantName: transactions.merchantName,
            amount: transactions.amount,
            currency: transactions.currency,
            pending: transactions.pending,
            accountId: bankAccounts.id,
            accountName: bankAccounts.name,
            accountMask: bankAccounts.mask,
            accountType: bankAccounts.type,
            accountIsActive: bankAccounts.isActive,
            categoryId: categories.id,
            categoryName: categories.name,
            categoryGroupName: categoryGroups.name,
          })
          .from(transactions)
          .innerJoin(bankAccounts, eq(transactions.accountId, bankAccounts.id))
          .leftJoin(categories, eq(transactions.categoryId, categories.id))
          .leftJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
          .where(and(...filteredConditions))
          .orderBy(desc(transactions.date), desc(transactions.createdAt))
          .limit(input.limit),
        db
          .select({
            totalCount: sql<number>`count(*)`.mapWith(Number),
          })
          .from(transactions)
          .innerJoin(bankAccounts, eq(transactions.accountId, bankAccounts.id))
          .where(and(...filteredConditions)),
        db
          .select({
            uncategorizedCount: sql<number>`count(*)`.mapWith(Number),
          })
          .from(transactions)
          .innerJoin(bankAccounts, eq(transactions.accountId, bankAccounts.id))
          .where(and(...visibleAccountConditions, isNull(transactions.categoryId))),
        db
          .select({
            id: bankAccounts.id,
            name: bankAccounts.name,
            mask: bankAccounts.mask,
            type: bankAccounts.type,
            isActive: bankAccounts.isActive,
          })
          .from(bankAccounts)
          .where(
            and(
              eq(bankAccounts.userId, ctx.userId),
              eq(bankAccounts.isActive, true),
            ),
          )
          .orderBy(asc(bankAccounts.name)),
        db
          .select({
            id: categories.id,
            name: categories.name,
            defaultBudgetable: categories.defaultBudgetable,
            groupName: categoryGroups.name,
          })
          .from(categories)
          .innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
          .orderBy(asc(categoryGroups.sortOrder), asc(categories.sortOrder), asc(categories.name)),
      ]);

      return {
        rows: rows.map((row) => ({
          ...row,
          amount: row.amount.toString(),
        })),
        totalCount,
        uncategorizedCount,
        accounts,
        categories: categoryRows,
      };
    }),
});
