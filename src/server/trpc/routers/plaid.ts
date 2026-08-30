import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { CountryCode, Products } from "plaid";
import { z } from "zod";
import { db } from "@/index";
import {
  bankAccounts,
  bankConnections,
  pendingProviderRevocations,
  transactions,
} from "@/db/schema";
import { getPlaid } from "@/server/plaid/client";
import { logProviderError } from "@/server/observability/provider-error";
import { getServerEnvironment } from "@/server/env";
import {
  decryptPlaidAccessTokenFromRow,
  encryptPlaidAccessToken,
} from "@/server/plaid/crypto";
import { getPlaidErrorData } from "@/server/plaid/errors";
import {
  revokePlaidItem,
  sweepDuePlaidRevocationsSafely,
} from "@/server/plaid/revocation";
import {
  isRevocationConfirmed,
  retryDelayMinutes,
} from "@/server/plaid/revocation-rules";
import { syncConnection, syncUserConnections } from "@/server/plaid/sync";
import { recentAuthProcedure, protectedProcedure, router } from "../trpc";

function createPlaidLinkTokenError(err: unknown) {
  const plaidError = getPlaidErrorData(err);

  if (plaidError?.error_code === "INVALID_API_KEYS") {
    return new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Plaid rejected the configured API keys for PLAID_ENV=${getServerEnvironment().plaidEnvironment}. Check PLAID_CLIENT_ID, PLAID_SECRET, and PLAID_ENV.`,
    });
  }

  if (err instanceof Error && err.message.includes("PLAID_CLIENT_ID and PLAID_SECRET")) {
    return new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Plaid credentials are missing. Set PLAID_CLIENT_ID and PLAID_SECRET.",
    });
  }

  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Failed to create link token.",
  });
}

export const plaidRouter = router({
  createLinkToken: recentAuthProcedure
    .input(z.object({ connectionId: z.string().uuid().optional() }))
    .mutation(async ({ ctx, input }) => {
      let updateAccessToken: string | undefined;
      if (input.connectionId) {
        const [conn] = await db
          .select({
            accessTokenEncrypted: bankConnections.accessTokenEncrypted,
            accessTokenKeyVersion: bankConnections.accessTokenKeyVersion,
          })
          .from(bankConnections)
          .where(
            and(
              eq(bankConnections.id, input.connectionId),
              eq(bankConnections.userId, ctx.userId),
            ),
          )
          .limit(1);
        if (!conn) throw new TRPCError({ code: "NOT_FOUND", message: "Connection not found." });
        updateAccessToken = decryptPlaidAccessTokenFromRow(conn);
      }

      try {
        const { data } = await getPlaid().linkTokenCreate({
          user: { client_user_id: ctx.userId },
          client_name: "FinWin",
          products: updateAccessToken ? [] : [Products.Transactions, Products.Investments],
          country_codes: [CountryCode.Us, CountryCode.Ca],
          language: "en",
          webhook: getServerEnvironment().plaidWebhookUrl,
          access_token: updateAccessToken,
        });
        return { link_token: data.link_token, expiration: data.expiration };
      } catch (err) {
        logProviderError(err, {
          operation: "plaid-link-token-create",
          correlationId: ctx.correlationId,
          connectionId: input.connectionId,
        });
        throw createPlaidLinkTokenError(err);
      }
    }),

  exchangeToken: recentAuthProcedure
    .input(z.object({ publicToken: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { data: exchange } = await getPlaid().itemPublicTokenExchange({
          public_token: input.publicToken,
        });
        const accessToken = exchange.access_token;
        const itemId = exchange.item_id;
        const encryptedToken = encryptPlaidAccessToken(accessToken);

        const { data: accountsRes } = await getPlaid().accountsGet({ access_token: accessToken });

        const connection = await db.transaction(async (tx) => {
          const [conn] = await tx
            .insert(bankConnections)
            .values({
              userId: ctx.userId,
              provider: "plaid",
              providerItemId: itemId,
              accessTokenEncrypted: encryptedToken.encrypted,
              accessTokenKeyVersion: encryptedToken.keyVersion,
              status: "active",
            })
            .returning({ id: bankConnections.id });

          if (accountsRes.accounts.length > 0) {
            await tx.insert(bankAccounts).values(
              accountsRes.accounts.map((acct) => ({
                userId: ctx.userId,
                connectionId: conn.id,
                providerAccountId: acct.account_id,
                name: acct.name,
                type: acct.type,
                subtype: acct.subtype ?? null,
                mask: acct.mask ?? null,
                currency: acct.balances.iso_currency_code ?? "CAD",
              })),
            );
          }

          return conn;
        });

        let initialSync: { added: number; modified: number; removed: number } | null = null;
        try {
          const r = await syncConnection(connection.id);
          initialSync = { added: r.added, modified: r.modified, removed: r.removed };
        } catch (err) {
          logProviderError(err, {
            operation: "plaid-initial-sync",
            correlationId: ctx.correlationId,
            connectionId: connection.id,
          });
        }

        return {
          connectionId: connection.id,
          accountCount: accountsRes.accounts.length,
          initialSync,
        };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        logProviderError(err, {
          operation: "plaid-token-exchange",
          correlationId: ctx.correlationId,
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to exchange public token." });
      }
    }),

  syncTransactions: protectedProcedure
    .input(z.object({ connectionId: z.string().uuid().optional() }))
    .mutation(async ({ ctx, input }) => {
      try {
        if (input.connectionId) {
          const [owned] = await db
            .select({ id: bankConnections.id })
            .from(bankConnections)
            .where(
              and(
                eq(bankConnections.id, input.connectionId),
                eq(bankConnections.userId, ctx.userId),
              ),
            )
            .limit(1);

          if (!owned) throw new TRPCError({ code: "NOT_FOUND", message: "Connection not found." });

          const result = await syncConnection(input.connectionId);
          return {
            results: [{ connectionId: input.connectionId, ...result }],
          };
        }

        const results = await syncUserConnections(ctx.userId);
        return { results };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        logProviderError(err, {
          operation: "plaid-transaction-sync",
          correlationId: ctx.correlationId,
          connectionId: input.connectionId,
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Sync failed." });
      } finally {
        await sweepDuePlaidRevocationsSafely(ctx.correlationId);
      }
    }),

  listConnections: protectedProcedure.query(async ({ ctx }) => {
    const [rows] = await Promise.all([
      db
        .select({
          id: bankConnections.id,
          status: bankConnections.status,
          syncErrorCode: bankConnections.syncErrorCode,
          lastSyncedAt: bankConnections.lastSyncedAt,
          createdAt: bankConnections.createdAt,
          updatedAt: bankConnections.updatedAt,
        })
        .from(bankConnections)
        .where(eq(bankConnections.userId, ctx.userId))
        .orderBy(desc(bankConnections.createdAt)),
      sweepDuePlaidRevocationsSafely(ctx.correlationId),
    ]);

    const connections = await Promise.all(
      rows.map(async (r) => {
        const accts = await db
          .select({
            name: bankAccounts.name,
            mask: bankAccounts.mask,
            type: bankAccounts.type,
          })
          .from(bankAccounts)
          .where(eq(bankAccounts.connectionId, r.id));

        const [lastTx] = await db
          .select({ date: transactions.date })
          .from(transactions)
          .innerJoin(bankAccounts, eq(transactions.accountId, bankAccounts.id))
          .where(and(eq(bankAccounts.connectionId, r.id)))
          .orderBy(desc(transactions.date))
          .limit(1);

        return {
          id: r.id,
          status: r.status,
          syncErrorCode: r.syncErrorCode,
          lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
          accounts: accts,
          lastTransactionDate: lastTx?.date ?? null,
        };
      }),
    );

    return connections;
  }),

  unlinkConnection: recentAuthProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [connection] = await db
        .select({
          id: bankConnections.id,
          providerItemId: bankConnections.providerItemId,
          accessTokenEncrypted: bankConnections.accessTokenEncrypted,
          accessTokenKeyVersion: bankConnections.accessTokenKeyVersion,
        })
        .from(bankConnections)
        .where(and(eq(bankConnections.id, input.id), eq(bankConnections.userId, ctx.userId)))
        .limit(1);

      if (!connection) throw new TRPCError({ code: "NOT_FOUND", message: "Connection not found." });

      const { outcome, errorCode } = await revokePlaidItem(connection, {
        correlationId: ctx.correlationId,
        connectionId: connection.id,
      });
      const confirmed = isRevocationConfirmed(outcome);
      const retryable = outcome === "retryable";

      const now = new Date();
      await db.transaction(async (tx) => {
        // The connection row holds the only copy of the credential. If Plaid did
        // not confirm removal, the credential must be handed to the retry queue
        // in the same transaction that deletes it, or the ability to revoke is
        // lost for good.
        if (!confirmed) {
          // A retryable failure keeps the credential so the sweep can try again.
          // Anything else is already beyond automatic recovery, so the row is
          // filed as abandoned with no credential for an operator to pick up.
          const queued = {
            userId: ctx.userId,
            accessTokenEncrypted: retryable ? connection.accessTokenEncrypted : null,
            accessTokenKeyVersion: retryable ? connection.accessTokenKeyVersion : null,
            status: retryable ? "pending" : "abandoned",
            attempts: 1,
            lastAttemptAt: now,
            lastErrorCode: errorCode,
            nextAttemptAt: retryable
              ? new Date(now.getTime() + retryDelayMinutes(1) * 60_000)
              : now,
            updatedAt: now,
          };

          await tx
            .insert(pendingProviderRevocations)
            .values({
              ...queued,
              provider: "plaid",
              providerItemId: connection.providerItemId,
            })
            .onConflictDoUpdate({
              target: pendingProviderRevocations.providerItemId,
              set: queued,
            });
        }

        await tx
          .update(bankAccounts)
          .set({ connectionId: null, isActive: false })
          .where(eq(bankAccounts.connectionId, connection.id));

        await tx.delete(bankConnections).where(eq(bankConnections.id, connection.id));
      });

      // The caller must be told the truth about provider access. Reporting a
      // plain success here is what let a user believe access was cut when the
      // Plaid Item was still live.
      return {
        ok: true,
        revocation: confirmed ? "revoked" : retryable ? "pending" : "manual",
      } as const;
    }),

  reactivateConnection: recentAuthProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [connection] = await db
        .select({ id: bankConnections.id })
        .from(bankConnections)
        .where(and(eq(bankConnections.id, input.id), eq(bankConnections.userId, ctx.userId)))
        .limit(1);

      if (!connection) throw new TRPCError({ code: "NOT_FOUND", message: "Connection not found." });

      await db
        .update(bankConnections)
        .set({ status: "active", syncErrorCode: null, updatedAt: new Date() })
        .where(eq(bankConnections.id, connection.id));

      return { ok: true };
    }),
});
