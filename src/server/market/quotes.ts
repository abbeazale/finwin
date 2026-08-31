import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { marketQuoteSnapshots } from "@/db/schema";
import { db } from "@/index";
import { TOP_US_TICKER_SYMBOLS } from "@/lib/market-symbols";
import { getServerEnvironment } from "@/server/env";

const FINNHUB_QUOTE_URL = "https://finnhub.io/api/v1/quote";
const FINNHUB_SEARCH_URL = "https://finnhub.io/api/v1/search";
const CACHE_TTL_MS = 5 * 60 * 1000;
const SEARCH_CACHE_TTL_MS = 60 * 1000;
const PROVIDER_TIMEOUT_MS = 1_500;

const LANDING_TICKER_SNAPSHOT_KEY = "top-us-stocks";

const finnhubQuoteSchema = z.object({
  c: z.number(), // current price
  d: z.number().nullable(), // change vs previous close
  dp: z.number().nullable(), // percent change vs previous close
});

const finnhubSearchSchema = z.object({
  result: z.array(z.object({
    description: z.string(),
    displaySymbol: z.string(),
    symbol: z.string(),
    type: z.string(),
  })),
});

const tickerQuoteSchema = z.object({
  symbol: z.string(),
  price: z.number(),
  change: z.number(),
  changePercent: z.number(),
});

const tickerSnapshotSchema = z.array(tickerQuoteSchema).min(1);

export type TickerQuote = {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
};

type SymbolSearchResult = {
  symbol: string;
  description: string;
};

const quoteCache = new Map<string, { quote: TickerQuote; cachedAt: number }>();
const searchCache = new Map<string, { results: SymbolSearchResult[]; cachedAt: number }>();
let tickerSnapshot: { quotes: TickerQuote[]; cachedAt: number } | null = null;
let tickerRefreshInFlight: Promise<TickerQuote[]> | null = null;

async function fetchWithTimeout(url: string, timeoutMs: number = PROVIDER_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchQuote(symbol: string, apiKey: string): Promise<TickerQuote | null> {
  const response = await fetchWithTimeout(
    `${FINNHUB_QUOTE_URL}?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`,
  );

  if (!response.ok) {
    return null;
  }

  const parsed = finnhubQuoteSchema.safeParse(await response.json());
  // Finnhub returns c=0 for unknown symbols and outside coverage instead of erroring.
  if (!parsed.success || parsed.data.c === 0) {
    return null;
  }

  return {
    symbol,
    price: parsed.data.c,
    change: parsed.data.d ?? 0,
    changePercent: parsed.data.dp ?? 0,
  };
}

export async function getQuote(symbol: string): Promise<TickerQuote | null> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const apiKey = getServerEnvironment().finnhubApiKey;
  if (!apiKey || !normalizedSymbol) {
    return null;
  }

  const cached = quoteCache.get(normalizedSymbol);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.quote;
  }

  try {
    const quote = await fetchQuote(normalizedSymbol, apiKey);
    if (quote) {
      quoteCache.set(normalizedSymbol, { quote, cachedAt: Date.now() });
      return quote;
    }
  } catch {
    // Existing positions should remain readable when Finnhub is unavailable.
  }

  return cached?.quote ?? null;
}

export async function searchSymbols(query: string): Promise<SymbolSearchResult[]> {
  const normalizedQuery = query.trim().toLowerCase();
  const apiKey = getServerEnvironment().finnhubApiKey;
  if (!apiKey || normalizedQuery.length < 1) {
    return [];
  }

  const cached = searchCache.get(normalizedQuery);
  if (cached && Date.now() - cached.cachedAt < SEARCH_CACHE_TTL_MS) {
    return cached.results;
  }

  try {
    const response = await fetchWithTimeout(
      `${FINNHUB_SEARCH_URL}?q=${encodeURIComponent(normalizedQuery)}&token=${encodeURIComponent(apiKey)}`,
    );
    if (!response.ok) {
      return cached?.results ?? [];
    }

    const parsed = finnhubSearchSchema.safeParse(await response.json());
    if (!parsed.success) {
      return cached?.results ?? [];
    }

    const results = parsed.data.result
      .filter((result) => result.type.toLowerCase() === "common stock")
      .filter((result) => /^[A-Z][A-Z0-9.-]{0,14}$/.test(result.symbol.toUpperCase()))
      .map((result) => ({
        symbol: result.symbol.toUpperCase(),
        description: result.description,
      }))
      .slice(0, 10);
    searchCache.set(normalizedQuery, { results, cachedAt: Date.now() });
    return results;
  } catch {
    return cached?.results ?? [];
  }
}

async function readDurableTickerSnapshot() {
  try {
    const [row] = await db
      .select({
        quotes: marketQuoteSnapshots.quotes,
        fetchedAt: marketQuoteSnapshots.fetchedAt,
      })
      .from(marketQuoteSnapshots)
      .where(eq(marketQuoteSnapshots.key, LANDING_TICKER_SNAPSHOT_KEY))
      .limit(1);

    if (!row) {
      return null;
    }

    const parsed = tickerSnapshotSchema.safeParse(row.quotes);
    if (!parsed.success) {
      return null;
    }

    return { quotes: parsed.data, cachedAt: row.fetchedAt.getTime() };
  } catch {
    return null;
  }
}

async function writeDurableTickerSnapshot(quotes: TickerQuote[], fetchedAt: Date) {
  try {
    await db
      .insert(marketQuoteSnapshots)
      .values({
        key: LANDING_TICKER_SNAPSHOT_KEY,
        quotes,
        fetchedAt,
        updatedAt: fetchedAt,
      })
      .onConflictDoUpdate({
        target: marketQuoteSnapshots.key,
        set: {
          quotes: sql`excluded.quotes`,
          fetchedAt: sql`excluded.fetched_at`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  } catch {
    // A provider result still renders when the durable cache is unavailable.
  }
}

async function refreshTickerSnapshot(): Promise<TickerQuote[]> {
  if (tickerRefreshInFlight) {
    return tickerRefreshInFlight;
  }

  tickerRefreshInFlight = (async () => {
    const results = await Promise.all(TOP_US_TICKER_SYMBOLS.map((symbol) => getQuote(symbol)));
    const quotes = results.filter((quote): quote is TickerQuote => quote !== null);
    if (quotes.length > 0) {
      const fetchedAt = new Date();
      tickerSnapshot = { quotes, cachedAt: fetchedAt.getTime() };
      await writeDurableTickerSnapshot(quotes, fetchedAt);
    }
    return quotes;
  })();

  try {
    return await tickerRefreshInFlight;
  } finally {
    tickerRefreshInFlight = null;
  }
}

/**
 * Landing-page quotes survive serverless cold starts in Postgres. A missing or stale
 * snapshot refreshes within the request so Vercel cannot freeze the work mid-flight.
 */
export async function getTickerQuotesForLanding(): Promise<TickerQuote[]> {
  const now = Date.now();

  if (tickerSnapshot && now - tickerSnapshot.cachedAt < CACHE_TTL_MS) {
    return tickerSnapshot.quotes;
  }

  const durableSnapshot = await readDurableTickerSnapshot();
  if (durableSnapshot) {
    tickerSnapshot = durableSnapshot;
    if (now - durableSnapshot.cachedAt < CACHE_TTL_MS) {
      return durableSnapshot.quotes;
    }
  }

  const refreshedQuotes = await refreshTickerSnapshot();
  if (refreshedQuotes.length > 0) {
    return refreshedQuotes;
  }

  return durableSnapshot?.quotes ?? tickerSnapshot?.quotes ?? [];
}
