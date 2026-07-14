import { and, eq, inArray } from "drizzle-orm";
import type {
  RemovedTransaction,
  Transaction as PlaidTransaction,
} from "plaid";
import { db } from "@/index";
import {
  bankAccounts,
  bankConnections,
  categories,
  categoryGroups,
  transactions,
} from "@/db/schema";
import { getPlaid } from "./client";
import { decryptPlaidAccessTokenFromRow } from "./crypto";
import { getPlaidErrorCode } from "./errors";
import {
  EMPTY_INVESTMENT_SYNC_RESULT,
  syncInvestmentsForConnection,
  type InvestmentSyncResult,
} from "./sync-investments";
export {
  syncInvestmentHoldings,
  syncInvestmentTransactions,
} from "./sync-investments";
import {
  PLAID_CATEGORY_MAP,
  PLAID_PRIMARY_FALLBACK_MAP,
} from "@/server/lib/category-map";
import { DEFAULT_CATEGORY_NAME } from "@/server/lib/category-taxonomy";

type SyncErrorReason =
  | "login_required"
  | "locked"
  | "cursor_reset"
  | "unknown"
  | null;

type SyncResult = {
  added: number;
  modified: number;
  removed: number;
  cursor: string | null;
  errorReason: SyncErrorReason;
} & InvestmentSyncResult;

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

function resolveCategoryId(
  plaidTx: PlaidTransaction,
  categoryIdByName: Map<string, string>,
): string | null {
  const detailed = plaidTx.personal_finance_category?.detailed;
  const primary = plaidTx.personal_finance_category?.primary;
  let resolvedName: string | undefined;
  if (detailed) resolvedName = PLAID_CATEGORY_MAP[detailed];
  if (!resolvedName && primary)
    resolvedName = PLAID_PRIMARY_FALLBACK_MAP[primary];
  if (!resolvedName) resolvedName = DEFAULT_CATEGORY_NAME;
  return categoryIdByName.get(resolvedName) ?? null;
}

function classifyErrorReason(errorCode: string): SyncErrorReason {
  if (
    errorCode === "ITEM_LOGIN_REQUIRED" ||
    errorCode === "INSUFFICIENT_CREDENTIALS"
  ) {
    return "login_required";
  }
  if (errorCode === "ITEM_LOCKED") {
    return "locked";
  }
  return "unknown";
}

export async function syncConnection(
  connectionId: string,
): Promise<SyncResult> {
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
    .select({
      id: bankAccounts.id,
      providerAccountId: bankAccounts.providerAccountId,
    })
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

      if (
        errorCode &&
        CURSOR_RESET_ERROR_CODES.has(errorCode) &&
        attempt === 0
      ) {
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
          .set({
            status: "error",
            syncErrorCode: errorCode,
            updatedAt: new Date(),
          })
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
