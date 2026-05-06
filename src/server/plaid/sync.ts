import { and, desc, eq, inArray, notInArray } from "drizzle-orm";
import type {
  Holding,
  InvestmentTransaction,
  RemovedTransaction,
  Security,
  Transaction as PlaidTransaction,
} from "plaid";
import { db } from "@/index";
import {
  bankAccounts,
  bankConnections,
  categories,
  categoryGroups,
  investmentHoldings,
  investmentTransactions,
  securities,
  transactions,
} from "@/db/schema";
import { getPlaid } from "./client";
import { decryptPlaidAccessTokenFromRow } from "./crypto";
import { getPlaidErrorCode } from "./errors";
import { PLAID_CATEGORY_MAP, PLAID_PRIMARY_FALLBACK_MAP } from "@/server/lib/category-map";

type SyncErrorReason = "login_required" | "locked" | "cursor_reset" | "unknown" | null;

type SyncResult = {
  added: number;
  modified: number;
  removed: number;
  cursor: string | null;
  errorReason: SyncErrorReason;
  investmentHoldingsUpserted: number;
  investmentHoldingsRemoved: number;
  investmentTransactionsUpserted: number;
};

type InvestmentSyncResult = Pick<
  SyncResult,
  "investmentHoldingsUpserted" | "investmentHoldingsRemoved" | "investmentTransactionsUpserted"
>;

type ConnectionForPlaidSync = {
  id: string;
  userId: string;
  accessTokenEncrypted: string;
  accessTokenKeyVersion: string;
};

const EMPTY_INVESTMENT_SYNC_RESULT: InvestmentSyncResult = {
  investmentHoldingsUpserted: 0,
  investmentHoldingsRemoved: 0,
  investmentTransactionsUpserted: 0,
};

// Plaid error codes that require the user to re-authenticate via Link update mode.
const USER_ACTION_ERROR_CODES = new Set([
  "ITEM_LOGIN_REQUIRED",
  "ITEM_LOCKED",
  "INSUFFICIENT_CREDENTIALS",
  "USER_SETUP_REQUIRED",
  "MFA_NOT_SUPPORTED",
  "INVALID_MFA",
  "NO_ACCOUNTS",
]);

// Plaid error codes that indicate a stale or invalid cursor.
const CURSOR_RESET_ERROR_CODES = new Set([
  "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION",
]);

function normalizeTransactionAmount(providerAmount: number) {
  // FinWin stores canonical account semantics:
  // positive = money in, negative = money out.
  return (-providerAmount).toFixed(2);
}

function fixed(value: number, scale: number) {
  return value.toFixed(scale);
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoString(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function addDaysString(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function resolveCategoryId(
  plaidTx: PlaidTransaction,
  categoryIdByName: Map<string, string>,
): string | null {
  const detailed = plaidTx.personal_finance_category?.detailed;
  const primary = plaidTx.personal_finance_category?.primary;
  let resolvedName: string | undefined;
  if (detailed) resolvedName = PLAID_CATEGORY_MAP[detailed];
  if (!resolvedName && primary) resolvedName = PLAID_PRIMARY_FALLBACK_MAP[primary];
  if (!resolvedName) resolvedName = "Uncategorized";
  return categoryIdByName.get(resolvedName) ?? null;
}

function classifyErrorReason(errorCode: string): SyncErrorReason {
  if (errorCode === "ITEM_LOGIN_REQUIRED" || errorCode === "INSUFFICIENT_CREDENTIALS") {
    return "login_required";
  }
  if (errorCode === "ITEM_LOCKED") {
    return "locked";
  }
  return "unknown";
}

function mapSecurity(security: Security) {
  return {
    plaidSecurityId: security.security_id,
    tickerSymbol: security.ticker_symbol,
    name: security.name,
    type: security.type,
    isCashEquivalent: security.is_cash_equivalent ?? false,
    closePrice: security.close_price === null ? null : fixed(security.close_price, 4),
    closePriceAsOf: security.close_price_as_of,
    isoCurrencyCode: security.iso_currency_code,
    unofficialCurrencyCode: security.unofficial_currency_code,
    updatedAt: new Date(),
  };
}

async function upsertSecurities(plaidSecurities: Security[]) {
  const rowsByPlaidId = new Map<string, ReturnType<typeof mapSecurity>>();
  for (const security of plaidSecurities) {
    rowsByPlaidId.set(security.security_id, mapSecurity(security));
  }

  const rows = [...rowsByPlaidId.values()];
  if (rows.length === 0) return new Map<string, string>();

  for (const row of rows) {
    await db
      .insert(securities)
      .values(row)
      .onConflictDoUpdate({
        target: securities.plaidSecurityId,
        set: {
          tickerSymbol: row.tickerSymbol,
          name: row.name,
          type: row.type,
          isCashEquivalent: row.isCashEquivalent,
          closePrice: row.closePrice,
          closePriceAsOf: row.closePriceAsOf,
          isoCurrencyCode: row.isoCurrencyCode,
          unofficialCurrencyCode: row.unofficialCurrencyCode,
          updatedAt: row.updatedAt,
        },
      });
  }

  const securityRows = await db
    .select({ id: securities.id, plaidSecurityId: securities.plaidSecurityId })
    .from(securities)
    .where(inArray(securities.plaidSecurityId, rows.map((row) => row.plaidSecurityId)));

  return new Map(securityRows.map((row) => [row.plaidSecurityId, row.id]));
}

async function getConnectionForPlaidSync(connectionId: string): Promise<ConnectionForPlaidSync> {
  const [connection] = await db
    .select({
      id: bankConnections.id,
      userId: bankConnections.userId,
      accessTokenEncrypted: bankConnections.accessTokenEncrypted,
      accessTokenKeyVersion: bankConnections.accessTokenKeyVersion,
    })
    .from(bankConnections)
    .where(eq(bankConnections.id, connectionId))
    .limit(1);

  if (!connection) throw new Error(`bankConnection ${connectionId} not found`);
  return connection;
}

async function getActiveInvestmentAccounts(connectionId: string) {
  return db
    .select({
      id: bankAccounts.id,
      providerAccountId: bankAccounts.providerAccountId,
    })
    .from(bankAccounts)
    .where(
      and(
        eq(bankAccounts.connectionId, connectionId),
        eq(bankAccounts.type, "investment"),
        eq(bankAccounts.isActive, true),
      ),
    );
}

export async function syncInvestmentHoldings(connectionId: string): Promise<InvestmentSyncResult> {
  const connection = await getConnectionForPlaidSync(connectionId);
  const accountRows = await getActiveInvestmentAccounts(connection.id);
  if (accountRows.length === 0) return EMPTY_INVESTMENT_SYNC_RESULT;

  const accessToken = decryptPlaidAccessTokenFromRow(connection);

  let data: Awaited<ReturnType<ReturnType<typeof getPlaid>["investmentsHoldingsGet"]>>["data"];
  try {
    const response = await getPlaid().investmentsHoldingsGet({ access_token: accessToken });
    data = response.data;
  } catch (err) {
    if (getPlaidErrorCode(err) === "PRODUCT_NOT_READY") return EMPTY_INVESTMENT_SYNC_RESULT;
    throw err;
  }

  const securityIdByPlaidId = await upsertSecurities(data.securities);
  const holdingsByProviderAccount = new Map<string, Holding[]>();
  for (const holding of data.holdings) {
    const rows = holdingsByProviderAccount.get(holding.account_id) ?? [];
    rows.push(holding);
    holdingsByProviderAccount.set(holding.account_id, rows);
  }

  let holdingsUpserted = 0;
  let holdingsRemoved = 0;

  for (const account of accountRows) {
    const holdingsForAccount = holdingsByProviderAccount.get(account.providerAccountId) ?? [];
    const keptSecurityIds = new Set<string>();

    await db.transaction(async (tx) => {
      for (const holding of holdingsForAccount) {
        const securityId = securityIdByPlaidId.get(holding.security_id);
        if (!securityId) continue;

        keptSecurityIds.add(securityId);
        const row = {
          userId: connection.userId,
          accountId: account.id,
          securityId,
          quantity: fixed(holding.quantity, 8),
          costBasis: holding.cost_basis === null ? null : fixed(holding.cost_basis, 2),
          institutionPrice: fixed(holding.institution_price, 4),
          institutionPriceAsOf: holding.institution_price_as_of ?? null,
          isoCurrencyCode: holding.iso_currency_code,
          unofficialCurrencyCode: holding.unofficial_currency_code,
          updatedAt: new Date(),
        };

        await tx
          .insert(investmentHoldings)
          .values(row)
          .onConflictDoUpdate({
            target: [investmentHoldings.accountId, investmentHoldings.securityId],
            set: {
              quantity: row.quantity,
              costBasis: row.costBasis,
              institutionPrice: row.institutionPrice,
              institutionPriceAsOf: row.institutionPriceAsOf,
              isoCurrencyCode: row.isoCurrencyCode,
              unofficialCurrencyCode: row.unofficialCurrencyCode,
              updatedAt: row.updatedAt,
            },
          });
        holdingsUpserted += 1;
      }

      const keptIds = [...keptSecurityIds];
      const removedRows = await tx
        .delete(investmentHoldings)
        .where(
          keptIds.length > 0
            ? and(
                eq(investmentHoldings.accountId, account.id),
                notInArray(investmentHoldings.securityId, keptIds),
              )
            : eq(investmentHoldings.accountId, account.id),
        )
        .returning({ id: investmentHoldings.id });
      holdingsRemoved += removedRows.length;
    });
  }

  const now = new Date();
  await db
    .update(bankConnections)
    .set({ status: "active", syncErrorCode: null, lastSyncedAt: now, updatedAt: now })
    .where(eq(bankConnections.id, connection.id));

  return {
    investmentHoldingsUpserted: holdingsUpserted,
    investmentHoldingsRemoved: holdingsRemoved,
    investmentTransactionsUpserted: 0,
  };
}

export async function syncInvestmentTransactions(connectionId: string): Promise<InvestmentSyncResult> {
  const connection = await getConnectionForPlaidSync(connectionId);
  const accountRows = await getActiveInvestmentAccounts(connection.id);
  if (accountRows.length === 0) return EMPTY_INVESTMENT_SYNC_RESULT;

  const accountIdByProvider = new Map(
    accountRows.map((account) => [account.providerAccountId, account.id]),
  );
  const accessToken = decryptPlaidAccessTokenFromRow(connection);

  const [latest] = await db
    .select({ date: investmentTransactions.date })
    .from(investmentTransactions)
    .innerJoin(bankAccounts, eq(investmentTransactions.accountId, bankAccounts.id))
    .where(
      and(
        eq(bankAccounts.connectionId, connection.id),
        eq(bankAccounts.type, "investment"),
      ),
    )
    .orderBy(desc(investmentTransactions.date))
    .limit(1);

  const startDate = latest?.date ? addDaysString(latest.date, -7) : daysAgoString(730);
  const endDate = todayString();
  const pageSize = 500;
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  const plaidTransactions: InvestmentTransaction[] = [];
  const plaidSecurities: Security[] = [];

  try {
    while (offset < total) {
      const { data } = await getPlaid().investmentsTransactionsGet({
        access_token: accessToken,
        start_date: startDate,
        end_date: endDate,
        options: { count: pageSize, offset },
      });

      plaidTransactions.push(...data.investment_transactions);
      plaidSecurities.push(...data.securities);
      total = data.total_investment_transactions;
      if (data.investment_transactions.length === 0) break;
      offset += data.investment_transactions.length;
    }
  } catch (err) {
    if (getPlaidErrorCode(err) === "PRODUCT_NOT_READY") return EMPTY_INVESTMENT_SYNC_RESULT;
    throw err;
  }

  const securityIdByPlaidId = await upsertSecurities(plaidSecurities);
  let transactionsUpserted = 0;

  await db.transaction(async (tx) => {
    for (const plaidTransaction of plaidTransactions) {
      const accountId = accountIdByProvider.get(plaidTransaction.account_id);
      if (!accountId) continue;

      const securityId = plaidTransaction.security_id
        ? securityIdByPlaidId.get(plaidTransaction.security_id) ?? null
        : null;
      const row = {
        userId: connection.userId,
        accountId,
        securityId,
        plaidInvestmentTransactionId: plaidTransaction.investment_transaction_id,
        date: plaidTransaction.date,
        name: plaidTransaction.name,
        quantity: fixed(plaidTransaction.quantity, 8),
        plaidAmount: fixed(plaidTransaction.amount, 2),
        price: fixed(plaidTransaction.price, 4),
        fees: plaidTransaction.fees === null ? null : fixed(plaidTransaction.fees, 2),
        type: plaidTransaction.type,
        subtype: plaidTransaction.subtype,
        isoCurrencyCode: plaidTransaction.iso_currency_code,
        unofficialCurrencyCode: plaidTransaction.unofficial_currency_code,
      };

      await tx
        .insert(investmentTransactions)
        .values(row)
        .onConflictDoUpdate({
          target: investmentTransactions.plaidInvestmentTransactionId,
          set: {
            userId: row.userId,
            accountId: row.accountId,
            securityId: row.securityId,
            date: row.date,
            name: row.name,
            quantity: row.quantity,
            plaidAmount: row.plaidAmount,
            price: row.price,
            fees: row.fees,
            type: row.type,
            subtype: row.subtype,
            isoCurrencyCode: row.isoCurrencyCode,
            unofficialCurrencyCode: row.unofficialCurrencyCode,
          },
        });
      transactionsUpserted += 1;
    }
  });

  const now = new Date();
  await db
    .update(bankConnections)
    .set({ status: "active", syncErrorCode: null, lastSyncedAt: now, updatedAt: now })
    .where(eq(bankConnections.id, connection.id));

  return {
    investmentHoldingsUpserted: 0,
    investmentHoldingsRemoved: 0,
    investmentTransactionsUpserted: transactionsUpserted,
  };
}

async function syncInvestmentsForConnection(connectionId: string): Promise<InvestmentSyncResult> {
  const holdings = await syncInvestmentHoldings(connectionId);
  const investmentTx = await syncInvestmentTransactions(connectionId);

  return {
    investmentHoldingsUpserted: holdings.investmentHoldingsUpserted,
    investmentHoldingsRemoved: holdings.investmentHoldingsRemoved,
    investmentTransactionsUpserted: investmentTx.investmentTransactionsUpserted,
  };
}

export async function syncConnection(connectionId: string): Promise<SyncResult> {
  const [connection] = await db
    .select({
      id: bankConnections.id,
      userId: bankConnections.userId,
      accessTokenEncrypted: bankConnections.accessTokenEncrypted,
      accessTokenKeyVersion: bankConnections.accessTokenKeyVersion,
      lastCursor: bankConnections.lastCursor,
    })
    .from(bankConnections)
    .where(eq(bankConnections.id, connectionId))
    .limit(1);

  if (!connection) throw new Error(`bankConnection ${connectionId} not found`);
  const accessToken = decryptPlaidAccessTokenFromRow(connection);

  const categoryRows = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id));
  const categoryIdByName = new Map<string, string>(
    categoryRows.map((c) => [c.name, c.id]),
  );

  const accountRows = await db
    .select({ id: bankAccounts.id, providerAccountId: bankAccounts.providerAccountId })
    .from(bankAccounts)
    .where(eq(bankAccounts.connectionId, connection.id));

  const accountIdByProvider = new Map(
    accountRows.map((a) => [a.providerAccountId, a.id]),
  );

  let cursor: string | null = connection.lastCursor;
  const added: PlaidTransaction[] = [];
  const modified: PlaidTransaction[] = [];
  const removed: RemovedTransaction[] = [];

  // Run the sync loop. On a cursor-related error, reset the cursor and retry once from scratch.
  let didCursorReset = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    added.length = 0;
    modified.length = 0;
    removed.length = 0;

    try {
      let hasMore = true;
      while (hasMore) {
        const { data } = await getPlaid().transactionsSync({
          access_token: accessToken,
          cursor: cursor ?? undefined,
        });
        added.push(...data.added);
        modified.push(...data.modified);
        removed.push(...data.removed);
        cursor = data.next_cursor;
        hasMore = data.has_more;
      }
    } catch (err) {
      const errorCode = getPlaidErrorCode(err);

      if (errorCode && CURSOR_RESET_ERROR_CODES.has(errorCode) && attempt === 0) {
        // Stale cursor — null it out and retry from scratch.
        cursor = null;
        didCursorReset = true;
        continue;
      }

      if (errorCode && USER_ACTION_ERROR_CODES.has(errorCode)) {
        // User needs to re-authenticate; mark the connection as errored.
        const reason = classifyErrorReason(errorCode);
        await db
          .update(bankConnections)
          .set({ status: "error", syncErrorCode: errorCode, updatedAt: new Date() })
          .where(eq(bankConnections.id, connectionId));
        return {
          added: 0,
          modified: 0,
          removed: 0,
          cursor: connection.lastCursor,
          errorReason: reason,
          ...EMPTY_INVESTMENT_SYNC_RESULT,
        };
      }

      if (errorCode === "PRODUCT_NOT_READY") {
        // Transactions product not yet ready; not an error state.
        const investments = await syncInvestmentsForConnection(connection.id);
        return {
          added: 0,
          modified: 0,
          removed: 0,
          cursor: connection.lastCursor,
          errorReason: null,
          ...investments,
        };
      }

      // Unknown Plaid or network error — mark as errored so the user knows.
      const code = errorCode ?? "UNKNOWN";
      await db
        .update(bankConnections)
        .set({ status: "error", syncErrorCode: code, updatedAt: new Date() })
        .where(eq(bankConnections.id, connectionId));
      throw err;
    }

    break;
  }

  const upserts = [...added, ...modified].flatMap((tx) => {
    const accountId = accountIdByProvider.get(tx.account_id);
    if (!accountId) return [];
    return [
      {
        userId: connection.userId,
        accountId,
        providerTransactionId: tx.transaction_id,
        date: tx.date,
        authorizedDate: tx.authorized_date ?? null,
        name: tx.name,
        merchantName: tx.merchant_name ?? null,
        amount: normalizeTransactionAmount(tx.amount),
        currency: tx.iso_currency_code ?? "CAD",
        pending: tx.pending,
        categoryId: resolveCategoryId(tx, categoryIdByName),
      },
    ];
  });

  const removedIds = removed
    .map((r) => r.transaction_id)
    .filter((id): id is string => Boolean(id));

  await db.transaction(async (tx) => {
    for (const row of upserts) {
      await tx
        .insert(transactions)
        .values(row)
        .onConflictDoUpdate({
          target: transactions.providerTransactionId,
          set: {
            date: row.date,
            authorizedDate: row.authorizedDate,
            name: row.name,
            merchantName: row.merchantName,
            amount: row.amount,
            currency: row.currency,
            pending: row.pending,
          },
        });
    }

    if (removedIds.length > 0) {
      await tx
        .delete(transactions)
        .where(
          and(
            eq(transactions.userId, connection.userId),
            inArray(transactions.providerTransactionId, removedIds),
          ),
        );
    }

    const now = new Date();
    await tx
      .update(bankConnections)
      .set({
        status: "active",
        syncErrorCode: null,
        lastCursor: cursor,
        lastSyncedAt: now,
        updatedAt: now,
      })
      .where(eq(bankConnections.id, connection.id));
  });

  const investments = await syncInvestmentsForConnection(connection.id);

  return {
    added: added.length,
    modified: modified.length,
    removed: removedIds.length,
    cursor,
    errorReason: didCursorReset ? "cursor_reset" : null,
    ...investments,
  };
}

export async function syncUserConnections(
  userId: string,
): Promise<Array<{ connectionId: string } & SyncResult>> {
  const rows = await db
    .select({ id: bankConnections.id })
    .from(bankConnections)
    .where(
      and(
        eq(bankConnections.userId, userId),
        eq(bankConnections.status, "active"),
      ),
    );

  return Promise.all(
    rows.map(async (row) => {
      const result = await syncConnection(row.id);
      return { connectionId: row.id, ...result };
    }),
  );
}
