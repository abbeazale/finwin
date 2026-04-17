import { and, eq, inArray } from "drizzle-orm";
import type { Transaction as PlaidTransaction, RemovedTransaction } from "plaid";
import { db } from "@/index";
import { bankAccounts, bankConnections, categories, categoryGroups, transactions } from "@/db/schema";
import { plaid } from "./client";
import { PLAID_CATEGORY_MAP, PLAID_PRIMARY_FALLBACK_MAP } from "@/server/trpc/category-map";

export type SyncResult = {
  added: number;
  modified: number;
  removed: number;
  cursor: string | null;
};

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
  if (!resolvedName && primary) resolvedName = PLAID_PRIMARY_FALLBACK_MAP[primary];
  if (!resolvedName) resolvedName = "Uncategorized";
  return categoryIdByName.get(resolvedName) ?? null;
}

export async function syncConnection(connectionId: string): Promise<SyncResult> {
  const [connection] = await db
    .select({
      id: bankConnections.id,
      userId: bankConnections.userId,
      accessToken: bankConnections.accessToken,
      lastCursor: bankConnections.lastCursor,
    })
    .from(bankConnections)
    .where(eq(bankConnections.id, connectionId))
    .limit(1);

  if (!connection) throw new Error(`bankConnection ${connectionId} not found`);

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

  // Plaid accepts `cursor` on request; omit (undefined) on first call.
  let hasMore = true;
  while (hasMore) {
    const { data } = await plaid.transactionsSync({
      access_token: connection.accessToken,
      cursor: cursor ?? undefined,
    });
    added.push(...data.added);
    modified.push(...data.modified);
    removed.push(...data.removed);
    cursor = data.next_cursor;
    hasMore = data.has_more;
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

    await tx
      .update(bankConnections)
      .set({ lastCursor: cursor, updatedAt: new Date() })
      .where(eq(bankConnections.id, connection.id));
  });

  return {
    added: added.length,
    modified: modified.length,
    removed: removedIds.length,
    cursor,
  };
}

export async function syncUserConnections(userId: string): Promise<SyncResult[]> {
  const rows = await db
    .select({ id: bankConnections.id })
    .from(bankConnections)
    .where(
      and(
        eq(bankConnections.userId, userId),
        eq(bankConnections.status, "active"),
      ),
    );

  const results: SyncResult[] = [];
  for (const row of rows) {
    results.push(await syncConnection(row.id));
  }
  return results;
}
