import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { CountryCode, Products } from "plaid";
import { z } from "zod";
import { db } from "@/index";
import { bankAccounts, bankConnections, transactions } from "@/db/schema";
import { plaid } from "@/server/plaid/client";
import { syncConnection, syncUserConnections } from "@/server/plaid/sync";
import { protectedProcedure, router } from "../trpc";

export type ConnectionRow = {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  accounts: { name: string; mask: string | null; type: string }[];
  lastTransactionDate: string | null;
};

export const plaidRouter = router({
  createLinkToken: protectedProcedure
    .input(z.object({ connectionId: z.string().uuid().optional() }))
    .mutation(async ({ ctx, input }) => {
      let updateAccessToken: string | undefined;
      if (input.connectionId) {
        const [conn] = await db
          .select({ accessToken: bankConnections.accessToken })
          .from(bankConnections)
          .where(
            and(
              eq(bankConnections.id, input.connectionId),
              eq(bankConnections.userId, ctx.userId),
            ),
          )
          .limit(1);
        if (!conn) throw new TRPCError({ code: "NOT_FOUND", message: "Connection not found." });
        updateAccessToken = conn.accessToken;
      }

      try {
        const { data } = await plaid.linkTokenCreate({
          user: { client_user_id: ctx.userId },
          client_name: "FinWin",
          products: updateAccessToken ? [] : [Products.Transactions],
          country_codes: [CountryCode.Us, CountryCode.Ca],
          language: "en",
          webhook: process.env.PLAID_WEBHOOK_URL || undefined,
          access_token: updateAccessToken,
        });
        return { link_token: data.link_token, expiration: data.expiration };
      } catch (err: unknown) {
        const plaidErr = (err as { response?: { data?: unknown } })?.response?.data;
        console.error("plaid linkTokenCreate failed", plaidErr ?? err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create link token." });
      }
    }),

  exchangeToken: protectedProcedure
    .input(z.object({ publicToken: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { data: exchange } = await plaid.itemPublicTokenExchange({
          public_token: input.publicToken,
        });
        const accessToken = exchange.access_token;
        const itemId = exchange.item_id;

        const { data: accountsRes } = await plaid.accountsGet({ access_token: accessToken });

        const connection = await db.transaction(async (tx) => {
          const [conn] = await tx
            .insert(bankConnections)
            .values({
              userId: ctx.userId,
              provider: "plaid",
              providerItemId: itemId,
              accessToken,
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
          console.error("initial sync failed (non-fatal)", err);
        }

        return {
          connectionId: connection.id,
          accountCount: accountsRes.accounts.length,
          initialSync,
        };
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const plaidErr = (err as { response?: { data?: unknown } })?.response?.data;
        console.error("plaid exchange failed", plaidErr ?? err);
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
          return { results: [result] };
        }

        const results = await syncUserConnections(ctx.userId);
        return { results };
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const plaidErr = (err as { response?: { data?: unknown } })?.response?.data;
        console.error("plaid sync failed", plaidErr ?? err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Sync failed." });
      }
    }),

  listConnections: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({
        id: bankConnections.id,
        status: bankConnections.status,
        createdAt: bankConnections.createdAt,
        updatedAt: bankConnections.updatedAt,
      })
      .from(bankConnections)
      .where(eq(bankConnections.userId, ctx.userId))
      .orderBy(desc(bankConnections.createdAt));

    const connections: ConnectionRow[] = await Promise.all(
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
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
          accounts: accts,
          lastTransactionDate: lastTx?.date ?? null,
        };
      }),
    );

    return connections;
  }),

  unlinkConnection: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [connection] = await db
        .select({
          id: bankConnections.id,
          accessToken: bankConnections.accessToken,
        })
        .from(bankConnections)
        .where(and(eq(bankConnections.id, input.id), eq(bankConnections.userId, ctx.userId)))
        .limit(1);

      if (!connection) throw new TRPCError({ code: "NOT_FOUND", message: "Connection not found." });

      try {
        await plaid.itemRemove({ access_token: connection.accessToken });
      } catch (err) {
        const plaidErr = (err as { response?: { data?: unknown } })?.response?.data;
        console.error("plaid itemRemove failed (continuing with local unlink)", plaidErr ?? err);
      }

      await db.transaction(async (tx) => {
        await tx
          .update(bankAccounts)
          .set({ connectionId: null, isActive: false })
          .where(eq(bankAccounts.connectionId, connection.id));

        await tx.delete(bankConnections).where(eq(bankConnections.id, connection.id));
      });

      return { ok: true };
    }),

  reactivateConnection: protectedProcedure
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
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(bankConnections.id, connection.id));

      return { ok: true };
    }),
});
