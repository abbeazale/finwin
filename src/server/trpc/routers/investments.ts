import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  bankAccounts,
  bankConnections,
  investmentHoldings,
  investmentTransactions,
  securities,
} from "@/db/schema";
import { db } from "@/index";
import { getUsdFxRates } from "@/server/investments/fx";
import {
  calculateInvestmentValue,
  getCashImpact,
  getDisplayAccountName,
  getNativeCurrency,
  summarizeInvestmentValues,
  toNumber,
  type FxRateLookup,
  type InvestmentValueResult,
} from "@/server/investments/values";
import { formatDecimalValue } from "@/server/lib/money";
import {
  syncInvestmentHoldings,
  syncInvestmentTransactions,
} from "@/server/plaid/sync";
import { protectedProcedure, router } from "../trpc";

const accountScopeInput = z.object({
  includeInactive: z.boolean().default(false),
});

const holdingsInput = accountScopeInput.extend({
  accountId: z.string().uuid().optional(),
});

const transactionsInput = accountScopeInput.extend({
  accountId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

const syncInput = z.object({
  connectionId: z.string().uuid().optional(),
});

type HoldingRow = Awaited<ReturnType<typeof getHoldingRows>>[number];

export const investmentsRouter = router({
  getAccounts: protectedProcedure
    .input(accountScopeInput)
    .query(async ({ ctx, input }) => {
      const [accounts, holdings] = await Promise.all([
        getInvestmentAccounts(ctx.userId, input.includeInactive),
        getHoldingRows(ctx.userId, input.includeInactive),
      ]);
      const fxRates = await getUsdFxRates();

      const holdingsByAccountId = groupByAccountId(holdings);

      return {
        accounts: accounts.map((account) => {
          const accountHoldings = holdingsByAccountId.get(account.accountId) ?? [];
          const values = accountHoldings.map((holding) => getHoldingValue(holding, fxRates));
          const totals = summarizeInvestmentValues(values);

          return {
            accountId: account.accountId,
            accountName: getDisplayAccountName(account.accountNickname, account.providerAccountName),
            providerAccountName: account.providerAccountName,
            accountNickname: account.accountNickname,
            accountMask: account.accountMask,
            accountSubtype: account.accountSubtype,
            nativeCurrency: account.nativeCurrency,
            totalValueUsd: totals.totalValueUsd,
            totalCostBasisUsd: totals.totalCostBasisUsd,
            totalGainLossUsd: totals.totalGainLossUsd,
            totalGainLossPct: totals.totalGainLossPct,
            holdingCount: accountHoldings.length,
            excludedHoldingCount: totals.excludedHoldingCount,
            lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
            isActive: account.isActive,
          };
        }),
      };
    }),

  getHoldings: protectedProcedure
    .input(holdingsInput)
    .query(async ({ ctx, input }) => {
      if (input.accountId) {
        await assertOwnedInvestmentAccount(ctx.userId, input.accountId, input.includeInactive);
      }

      const holdings = await getHoldingRows(ctx.userId, input.includeInactive, input.accountId);
      const fxRates = await getUsdFxRates();
      const values = holdings.map((holding) => getHoldingValue(holding, fxRates));
      const totals = summarizeInvestmentValues(values);

      return {
        totals,
        holdings: holdings.map((holding, index) => {
          const value = values[index];
          const quantity = toNumber(holding.quantity) ?? 0;
          const costBasisNative = toNumber(holding.costBasis);

          return {
            holdingId: holding.holdingId,
            accountId: holding.accountId,
            accountName: getDisplayAccountName(holding.accountNickname, holding.providerAccountName),
            providerAccountName: holding.providerAccountName,
            accountNickname: holding.accountNickname,
            securityId: holding.securityId,
            tickerSymbol: holding.tickerSymbol,
            securityName: holding.securityName,
            securityType: holding.securityType,
            isCashEquivalent: holding.isCashEquivalent,
            quantity: formatDecimalValue(quantity, 8),
            nativeCurrency: value.marketValueCurrency,
            costBasisNative: formatDecimalValue(costBasisNative),
            costBasisCurrency: getNativeCurrency(
              holding.isoCurrencyCode,
              holding.unofficialCurrencyCode,
              holding.accountCurrency,
            ),
            costBasisUsd: formatDecimalValue(value.costBasisUsd),
            institutionPriceNative: formatDecimalValue(value.price, 4),
            institutionPriceAsOf: value.priceAsOf,
            priceSource: value.priceSource,
            priceCurrency: value.priceCurrency,
            marketValueNative: formatDecimalValue(value.marketValueNative),
            marketValueCurrency: value.marketValueCurrency,
            marketValueUsd: formatDecimalValue(value.marketValueUsd),
            gainLossUsd: formatDecimalValue(value.gainLossUsd),
            gainLossPct: value.gainLossPct,
            fxConverted: value.fxConverted,
            fxRateStale: value.fxRateStale,
            excludedFromUsd: value.excludedFromUsd,
          };
        }),
      };
    }),

  getTransactions: protectedProcedure
    .input(transactionsInput)
    .query(async ({ ctx, input }) => {
      if (input.accountId) {
        await assertOwnedInvestmentAccount(ctx.userId, input.accountId, input.includeInactive);
      }

      const conditions = [
        eq(investmentTransactions.userId, ctx.userId),
        input.includeInactive ? undefined : eq(bankAccounts.isActive, true),
        input.accountId ? eq(investmentTransactions.accountId, input.accountId) : undefined,
      ].filter((condition): condition is NonNullable<typeof condition> => Boolean(condition));

      const [rows, [{ totalCount }], fxRates] = await Promise.all([
        db
          .select({
            transactionId: investmentTransactions.id,
            date: investmentTransactions.date,
            name: investmentTransactions.name,
            type: investmentTransactions.type,
            subtype: investmentTransactions.subtype,
            tickerSymbol: securities.tickerSymbol,
            securityName: securities.name,
            quantity: investmentTransactions.quantity,
            price: investmentTransactions.price,
            plaidAmount: investmentTransactions.plaidAmount,
            fees: investmentTransactions.fees,
            isoCurrencyCode: investmentTransactions.isoCurrencyCode,
            unofficialCurrencyCode: investmentTransactions.unofficialCurrencyCode,
            accountName: bankAccounts.name,
            accountNickname: bankAccounts.nickname,
            accountCurrency: bankAccounts.currency,
          })
          .from(investmentTransactions)
          .innerJoin(bankAccounts, eq(investmentTransactions.accountId, bankAccounts.id))
          .leftJoin(securities, eq(investmentTransactions.securityId, securities.id))
          .where(and(...conditions))
          .orderBy(desc(investmentTransactions.date), desc(investmentTransactions.createdAt))
          .limit(input.limit)
          .offset(input.offset),
        db
          .select({ totalCount: count() })
          .from(investmentTransactions)
          .innerJoin(bankAccounts, eq(investmentTransactions.accountId, bankAccounts.id))
          .where(and(...conditions)),
        getUsdFxRates(),
      ]);

      return {
        transactions: rows.map((row) => {
          const plaidAmount = toNumber(row.plaidAmount) ?? 0;
          const cashImpact = getCashImpact(plaidAmount);
          const nativeCurrency = getNativeCurrency(
            row.isoCurrencyCode,
            row.unofficialCurrencyCode,
            row.accountCurrency,
          );
          const cashImpactUsd = nativeCurrency === null || nativeCurrency === "USD"
            ? cashImpact
            : fxRates.get(nativeCurrency)
              ? cashImpact / fxRates.get(nativeCurrency)!.rate
              : null;

          return {
            transactionId: row.transactionId,
            date: row.date,
            name: row.name,
            type: row.type,
            subtype: row.subtype,
            tickerSymbol: row.tickerSymbol,
            securityName: row.securityName,
            quantity: formatDecimalValue(toNumber(row.quantity), 8),
            price: formatDecimalValue(toNumber(row.price), 4),
            plaidAmount: formatDecimalValue(plaidAmount),
            cashImpact: formatDecimalValue(cashImpact),
            cashImpactUsd: formatDecimalValue(cashImpactUsd),
            fees: formatDecimalValue(toNumber(row.fees)),
            nativeCurrency,
            accountName: getDisplayAccountName(row.accountNickname, row.accountName),
          };
        }),
        totalCount,
      };
    }),

  sync: protectedProcedure
    .input(syncInput)
    .mutation(async ({ ctx, input }) => {
      const connectionIds = input.connectionId
        ? [await assertOwnedInvestmentConnection(ctx.userId, input.connectionId)]
        : await getOwnedInvestmentConnectionIds(ctx.userId);

      const results = await Promise.all(
        connectionIds.map(async (connectionId) => {
          const holdings = await syncInvestmentHoldings(connectionId);
          const investmentTx = await syncInvestmentTransactions(connectionId);
          return {
            connectionId,
            holdingsUpdated: holdings.investmentHoldingsUpserted,
            holdingsRemoved: holdings.investmentHoldingsRemoved,
            transactionsUpserted: investmentTx.investmentTransactionsUpserted,
          };
        }),
      );

      const lastSyncedAt = await getLatestInvestmentSyncTime(ctx.userId);

      return {
        syncedConnections: results.length,
        holdingsUpdated: results.reduce((sum, row) => sum + row.holdingsUpdated, 0),
        holdingsRemoved: results.reduce((sum, row) => sum + row.holdingsRemoved, 0),
        transactionsUpserted: results.reduce((sum, row) => sum + row.transactionsUpserted, 0),
        lastSyncedAt: lastSyncedAt?.toISOString() ?? null,
      };
    }),
});

async function getInvestmentAccounts(userId: string, includeInactive: boolean) {
  return db
    .select({
      accountId: bankAccounts.id,
      providerAccountName: bankAccounts.name,
      accountNickname: bankAccounts.nickname,
      accountMask: bankAccounts.mask,
      accountSubtype: bankAccounts.subtype,
      nativeCurrency: bankAccounts.currency,
      isActive: bankAccounts.isActive,
      lastSyncedAt: bankConnections.lastSyncedAt,
    })
    .from(bankAccounts)
    .leftJoin(bankConnections, eq(bankAccounts.connectionId, bankConnections.id))
    .where(
      and(
        eq(bankAccounts.userId, userId),
        eq(bankAccounts.type, "investment"),
        includeInactive ? undefined : eq(bankAccounts.isActive, true),
      ),
    )
    .orderBy(asc(bankAccounts.name));
}

async function getHoldingRows(userId: string, includeInactive: boolean, accountId?: string) {
  return db
    .select({
      holdingId: investmentHoldings.id,
      accountId: bankAccounts.id,
      providerAccountName: bankAccounts.name,
      accountNickname: bankAccounts.nickname,
      accountCurrency: bankAccounts.currency,
      securityId: securities.id,
      tickerSymbol: securities.tickerSymbol,
      securityName: securities.name,
      securityType: securities.type,
      isCashEquivalent: securities.isCashEquivalent,
      securityClosePrice: securities.closePrice,
      securityClosePriceAsOf: securities.closePriceAsOf,
      securityIsoCurrencyCode: securities.isoCurrencyCode,
      securityUnofficialCurrencyCode: securities.unofficialCurrencyCode,
      quantity: investmentHoldings.quantity,
      costBasis: investmentHoldings.costBasis,
      institutionPrice: investmentHoldings.institutionPrice,
      institutionPriceAsOf: investmentHoldings.institutionPriceAsOf,
      isoCurrencyCode: investmentHoldings.isoCurrencyCode,
      unofficialCurrencyCode: investmentHoldings.unofficialCurrencyCode,
      isActive: bankAccounts.isActive,
    })
    .from(investmentHoldings)
    .innerJoin(bankAccounts, eq(investmentHoldings.accountId, bankAccounts.id))
    .innerJoin(securities, eq(investmentHoldings.securityId, securities.id))
    .where(
      and(
        eq(investmentHoldings.userId, userId),
        includeInactive ? undefined : eq(bankAccounts.isActive, true),
        accountId ? eq(investmentHoldings.accountId, accountId) : undefined,
      ),
    )
    .orderBy(desc(sql<number>`${investmentHoldings.quantity} * ${investmentHoldings.institutionPrice}`));
}

function getHoldingValue(holding: HoldingRow, fxRates: FxRateLookup): InvestmentValueResult {
  return calculateInvestmentValue({
    quantity: toNumber(holding.quantity) ?? 0,
    institutionPrice: toNumber(holding.institutionPrice),
    institutionPriceCurrency: getNativeCurrency(
      holding.isoCurrencyCode,
      holding.unofficialCurrencyCode,
      holding.accountCurrency,
    ),
    institutionPriceAsOf: holding.institutionPriceAsOf,
    closePrice: toNumber(holding.securityClosePrice),
    closePriceCurrency: getNativeCurrency(
      holding.securityIsoCurrencyCode,
      holding.securityUnofficialCurrencyCode,
      null,
    ),
    closePriceAsOf: holding.securityClosePriceAsOf,
    costBasis: toNumber(holding.costBasis),
    costBasisCurrency: getNativeCurrency(
      holding.isoCurrencyCode,
      holding.unofficialCurrencyCode,
      holding.accountCurrency,
    ),
    fxRates,
  });
}

function groupByAccountId(holdings: HoldingRow[]) {
  const map = new Map<string, HoldingRow[]>();
  for (const holding of holdings) {
    const rows = map.get(holding.accountId) ?? [];
    rows.push(holding);
    map.set(holding.accountId, rows);
  }
  return map;
}

async function assertOwnedInvestmentAccount(
  userId: string,
  accountId: string,
  includeInactive: boolean,
) {
  const [account] = await db
    .select({ id: bankAccounts.id })
    .from(bankAccounts)
    .where(
      and(
        eq(bankAccounts.id, accountId),
        eq(bankAccounts.userId, userId),
        eq(bankAccounts.type, "investment"),
        includeInactive ? undefined : eq(bankAccounts.isActive, true),
      ),
    )
    .limit(1);

  if (!account) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Investment account not found." });
  }
}

async function assertOwnedInvestmentConnection(userId: string, connectionId: string) {
  const [connection] = await db
    .select({ id: bankConnections.id })
    .from(bankConnections)
    .innerJoin(bankAccounts, eq(bankAccounts.connectionId, bankConnections.id))
    .where(
      and(
        eq(bankConnections.id, connectionId),
        eq(bankConnections.userId, userId),
        eq(bankConnections.status, "active"),
        eq(bankAccounts.type, "investment"),
        eq(bankAccounts.isActive, true),
      ),
    )
    .limit(1);

  if (!connection) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Investment connection not found." });
  }

  return connection.id;
}

async function getOwnedInvestmentConnectionIds(userId: string) {
  const rows = await db
    .select({ id: bankConnections.id })
    .from(bankConnections)
    .innerJoin(bankAccounts, eq(bankAccounts.connectionId, bankConnections.id))
    .where(
      and(
        eq(bankConnections.userId, userId),
        eq(bankConnections.status, "active"),
        eq(bankAccounts.type, "investment"),
        eq(bankAccounts.isActive, true),
      ),
    );

  return [...new Set(rows.map((row) => row.id))];
}

async function getLatestInvestmentSyncTime(userId: string) {
  const [row] = await db
    .select({ lastSyncedAt: bankConnections.lastSyncedAt })
    .from(bankConnections)
    .innerJoin(bankAccounts, eq(bankAccounts.connectionId, bankConnections.id))
    .where(
      and(
        eq(bankConnections.userId, userId),
        eq(bankAccounts.type, "investment"),
      ),
    )
    .orderBy(desc(bankConnections.lastSyncedAt))
    .limit(1);

  return row?.lastSyncedAt ?? null;
}
