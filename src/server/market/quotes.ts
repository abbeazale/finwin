import { z } from "zod";
import { getServerEnvironment } from "@/server/env";

const FINNHUB_QUOTE_URL = "https://finnhub.io/api/v1/quote";
const FINNHUB_SEARCH_URL = "https://finnhub.io/api/v1/search";
const CACHE_TTL_MS = 5 * 60 * 1000;
const SEARCH_CACHE_TTL_MS = 60 * 1000;
const PROVIDER_TIMEOUT_MS = 1_500;

// Largest US stocks by market cap; static because rankings shift too slowly
// to justify a second API for them.
const TICKER_SYMBOLS = [
  "NVDA", "MSFT", "AAPL", "GOOGL", "AMZN", "META", "AVGO", "TSLA", "BRK.B",
  "LLY", "JPM", "WMT", "V", "ORCL", "MA", "XOM", "COST", "UNH", "NFLX", "HD",
] as const;

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
let tickerRefreshInFlight: Promise<void> | null = null;

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

async function refreshTickerSnapshot() {
  if (tickerRefreshInFlight) {
    await tickerRefreshInFlight;
    return;
  }

  tickerRefreshInFlight = (async () => {
    const results = await Promise.all(TICKER_SYMBOLS.map((symbol) => getQuote(symbol)));
    const quotes = results.filter((quote): quote is TickerQuote => quote !== null);
    if (quotes.length > 0) {
      tickerSnapshot = { quotes, cachedAt: Date.now() };
    }
  })();

  try {
    await tickerRefreshInFlight;
  } finally {
    tickerRefreshInFlight = null;
  }
}

/**
 * Landing-page quotes: never block TTFB on a cold Finnhub fan-out.
 * Fresh or stale snapshots are returned immediately; refresh runs in the background.
 * Cold instances return [] so the page can use its static marquee fallback.
 */
export function getTickerQuotesForLanding(): TickerQuote[] {
  const now = Date.now();
  const snapshot = tickerSnapshot;

  if (snapshot && now - snapshot.cachedAt < CACHE_TTL_MS) {
    return snapshot.quotes;
  }

  void refreshTickerSnapshot();

  if (snapshot) {
    return snapshot.quotes;
  }

  return [];
}
