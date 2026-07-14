import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { sandboxPortfolios, sandboxTrades } from "@/db/schema";
import { db } from "@/index";
import { formatDecimalValue, formatMoneyValue } from "@/server/lib/money";
import { getQuote, searchSymbols } from "@/server/market/quotes";
import {
  parseTradeSide,
  replaySandboxTrades,
  SandboxTimelineError,
  type SandboxTradeValue,
} from "@/server/sandbox/values";
import { protectedProcedure, router } from "../trpc";

const portfolioIdInput = z.object({ id: z.string().uuid() });
const portfolioName = z.string().trim().min(1).max(80);
const symbolInput = z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9.-]{0,14}$/);
const positiveDecimal = z.coerce.number().finite().positive();

export const sandboxRouter = router({
  listPortfolios: protectedProcedure.query(async ({ ctx }) => {
    const portfolios = await db.select({
      id: sandboxPortfolios.id,
      name: sandboxPortfolios.name,
      startingCash: sandboxPortfolios.startingCash,
      createdAt: sandboxPortfolios.createdAt,
      updatedAt: sandboxPortfolios.updatedAt,
    })
      .from(sandboxPortfolios)
      .where(eq(sandboxPortfolios.userId, ctx.userId))
      .orderBy(asc(sandboxPortfolios.createdAt));

    return portfolios.map((portfolio) => ({
      id: portfolio.id,
      name: portfolio.name,
      startingCash: money(portfolio.startingCash),
      createdAt: portfolio.createdAt.toISOString(),
      updatedAt: portfolio.updatedAt.toISOString(),
    }));
  }),

  createPortfolio: protectedProcedure
    .input(z.object({
      name: portfolioName,
      startingCash: z.coerce.number().finite().min(0).max(999999999999.99).default(100000),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const [portfolio] = await db.insert(sandboxPortfolios).values({
          userId: ctx.userId,
          name: input.name,
          startingCash: input.startingCash.toFixed(2),
        }).returning();
        return { id: portfolio.id };
      } catch (error) {
        throw mapPortfolioWriteError(error);
      }
    }),

  renamePortfolio: protectedProcedure
    .input(portfolioIdInput.extend({ name: portfolioName }))
    .mutation(async ({ ctx, input }) => {
      try {
        const [portfolio] = await db.update(sandboxPortfolios)
          .set({ name: input.name, updatedAt: new Date() })
          .where(and(
            eq(sandboxPortfolios.id, input.id),
            eq(sandboxPortfolios.userId, ctx.userId),
          ))
          .returning({ id: sandboxPortfolios.id });
        if (!portfolio) throw notFound("Portfolio");
        return portfolio;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw mapPortfolioWriteError(error);
      }
    }),

  deletePortfolio: protectedProcedure
    .input(portfolioIdInput)
    .mutation(async ({ ctx, input }) => {
      const [portfolio] = await db.delete(sandboxPortfolios)
        .where(and(
          eq(sandboxPortfolios.id, input.id),
          eq(sandboxPortfolios.userId, ctx.userId),
        ))
        .returning({ id: sandboxPortfolios.id });
      if (!portfolio) throw notFound("Portfolio");
      return portfolio;
    }),

  getPortfolio: protectedProcedure
    .input(portfolioIdInput)
    .query(async ({ ctx, input }) => {
      const portfolio = await getOwnedPortfolio(input.id, ctx.userId);
      const trades = await getTradeValues(portfolio.id, ctx.userId);
      const replay = replaySandboxTrades(Number(portfolio.startingCash), trades);
      const positions = [...replay.positions.values()].filter((position) => position.quantity > 0);
      const quotes = await Promise.all(positions.map((position) => getQuote(position.symbol)));
      let marketValue = 0;
      let openCostBasis = 0;

      const holdings = positions.map((position, index) => {
        const quote = quotes[index];
        const positionMarketValue = quote ? position.quantity * quote.price : null;
        const unrealizedGain = positionMarketValue === null
          ? null
          : positionMarketValue - position.openCostBasis;
        marketValue += positionMarketValue ?? 0;
        openCostBasis += position.openCostBasis;
        return {
          symbol: position.symbol,
          quantity: decimal(position.quantity, 8),
          averageCost: decimal(position.averageCost, 4),
          openCostBasis: money(position.openCostBasis),
          livePrice: quote ? decimal(quote.price, 4) : null,
          marketValue: positionMarketValue === null ? null : money(positionMarketValue),
          unrealizedGain: unrealizedGain === null ? null : money(unrealizedGain),
          dayChange: quote ? money(position.quantity * quote.change) : null,
          dayChangePercent: quote ? decimal(quote.changePercent, 2) : null,
          priceAvailable: Boolean(quote),
        };
      }).sort((left, right) => left.symbol.localeCompare(right.symbol));

      const startingCash = Number(portfolio.startingCash);
      const totalValue = replay.cashBalance + marketValue;
      const totalReturn = totalValue - startingCash;
      return {
        id: portfolio.id,
        name: portfolio.name,
        startingCash: money(startingCash),
        cashBalance: money(replay.cashBalance),
        marketValue: money(marketValue),
        openCostBasis: money(openCostBasis),
        realizedGain: money(replay.realizedGain),
        unrealizedGain: money(marketValue - openCostBasis),
        totalValue: money(totalValue),
        totalReturn: money(totalReturn),
        totalReturnPercent: startingCash > 0 ? decimal((totalReturn / startingCash) * 100, 2) : null,
        missingQuoteCount: holdings.filter((holding) => !holding.priceAvailable).length,
        holdings,
      };
    }),

  listTrades: protectedProcedure
    .input(z.object({ portfolioId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await getOwnedPortfolio(input.portfolioId, ctx.userId);
      const rows = await db.select().from(sandboxTrades)
        .where(and(
          eq(sandboxTrades.portfolioId, input.portfolioId),
          eq(sandboxTrades.userId, ctx.userId),
        ))
        .orderBy(asc(sandboxTrades.executedAt), asc(sandboxTrades.createdAt));
      return rows.map(serializeTrade);
    }),

  placeTrade: protectedProcedure
    .input(z.object({
      portfolioId: z.string().uuid(),
      symbol: symbolInput,
      side: z.enum(["buy", "sell"]),
      quantity: positiveDecimal.max(9999999999),
      price: z.coerce.number().finite().min(0).max(99999999),
      executedAt: z.coerce.date(),
      note: z.string().trim().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const quote = await getQuote(input.symbol);
      if (!quote) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Finnhub could not validate that stock symbol." });
      }

      return db.transaction(async (tx) => {
        const [portfolio] = await tx.select().from(sandboxPortfolios)
          .where(and(
            eq(sandboxPortfolios.id, input.portfolioId),
            eq(sandboxPortfolios.userId, ctx.userId),
          ))
          .limit(1)
          .for("update");
        if (!portfolio) throw notFound("Portfolio");

        const rows = await tx.select().from(sandboxTrades)
          .where(and(
            eq(sandboxTrades.portfolioId, input.portfolioId),
            eq(sandboxTrades.userId, ctx.userId),
          ));
        const now = new Date();
        const proposed: SandboxTradeValue = {
          id: crypto.randomUUID(),
          symbol: input.symbol,
          side: input.side,
          quantity: input.quantity,
          price: input.price,
          executedAt: input.executedAt,
          createdAt: now,
        };
        validateTimeline(Number(portfolio.startingCash), [...rows.map(toTradeValue), proposed]);
        const [trade] = await tx.insert(sandboxTrades).values({
          id: proposed.id,
          portfolioId: input.portfolioId,
          userId: ctx.userId,
          symbol: input.symbol,
          side: input.side,
          quantity: input.quantity.toFixed(8),
          price: input.price.toFixed(4),
          executedAt: input.executedAt,
          note: input.note || null,
          createdAt: now,
        }).returning();
        await tx.update(sandboxPortfolios).set({ updatedAt: now })
          .where(eq(sandboxPortfolios.id, input.portfolioId));
        return serializeTrade(trade);
      });
    }),

  deleteTrade: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => db.transaction(async (tx) => {
      const [trade] = await tx.select().from(sandboxTrades)
        .where(and(eq(sandboxTrades.id, input.id), eq(sandboxTrades.userId, ctx.userId)))
        .limit(1);
      if (!trade) throw notFound("Trade");

      const [portfolio] = await tx.select().from(sandboxPortfolios)
        .where(and(
          eq(sandboxPortfolios.id, trade.portfolioId),
          eq(sandboxPortfolios.userId, ctx.userId),
        ))
        .limit(1)
        .for("update");
      if (!portfolio) throw notFound("Portfolio");

      const rows = await tx.select().from(sandboxTrades)
        .where(and(
          eq(sandboxTrades.portfolioId, trade.portfolioId),
          eq(sandboxTrades.userId, ctx.userId),
        ));
      validateTimeline(
        Number(portfolio.startingCash),
        rows.filter((row) => row.id !== input.id).map(toTradeValue),
      );
      await tx.delete(sandboxTrades).where(eq(sandboxTrades.id, input.id));
      await tx.update(sandboxPortfolios).set({ updatedAt: new Date() })
        .where(eq(sandboxPortfolios.id, trade.portfolioId));
      return { id: input.id };
    })),

  searchSymbols: protectedProcedure
    .input(z.object({ query: z.string().trim().min(1).max(80) }))
    .query(({ input }) => searchSymbols(input.query)),

  getQuote: protectedProcedure
    .input(z.object({ symbol: symbolInput }))
    .query(async ({ input }) => {
      const quote = await getQuote(input.symbol);
      if (!quote) throw new TRPCError({ code: "NOT_FOUND", message: "No live quote is available for that symbol." });
      return {
        ...quote,
        price: decimal(quote.price, 4),
        change: decimal(quote.change, 4),
        changePercent: decimal(quote.changePercent, 2),
      };
    }),
});

async function getOwnedPortfolio(id: string, userId: string) {
  const [portfolio] = await db.select().from(sandboxPortfolios)
    .where(and(eq(sandboxPortfolios.id, id), eq(sandboxPortfolios.userId, userId)))
    .limit(1);
  if (!portfolio) throw notFound("Portfolio");
  return portfolio;
}

async function getTradeValues(portfolioId: string, userId: string) {
  const rows = await db.select().from(sandboxTrades).where(and(
    eq(sandboxTrades.portfolioId, portfolioId),
    eq(sandboxTrades.userId, userId),
  ));
  return rows.map(toTradeValue);
}

function toTradeValue(row: typeof sandboxTrades.$inferSelect): SandboxTradeValue {
  return {
    id: row.id,
    symbol: row.symbol,
    side: parseTradeSide(row.side),
    quantity: Number(row.quantity),
    price: Number(row.price),
    executedAt: row.executedAt,
    createdAt: row.createdAt,
  };
}

function serializeTrade(row: typeof sandboxTrades.$inferSelect) {
  return {
    id: row.id,
    portfolioId: row.portfolioId,
    symbol: row.symbol,
    side: parseTradeSide(row.side),
    quantity: decimal(row.quantity, 8),
    price: decimal(row.price, 4),
    total: money(Number(row.quantity) * Number(row.price)),
    executedAt: row.executedAt.toISOString(),
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

function validateTimeline(startingCash: number, trades: SandboxTradeValue[]) {
  try {
    replaySandboxTrades(startingCash, trades);
  } catch (error) {
    if (error instanceof SandboxTimelineError) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
    }
    throw error;
  }
}

function money(value: string | number) {
  return formatMoneyValue(Number(value));
}

function decimal(value: string | number, scale: number) {
  const formatted = formatDecimalValue(Number(value), scale);
  if (formatted === null) {
    throw new Error(`Expected a finite decimal, received ${String(value)}`);
  }
  return formatted;
}

function notFound(subject: string) {
  return new TRPCError({ code: "NOT_FOUND", message: `${subject} not found.` });
}

function mapPortfolioWriteError(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "";
  return code === "23505"
    ? new TRPCError({ code: "CONFLICT", message: "Portfolio names must be unique." })
    : new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not save the portfolio.", cause: error });
}
