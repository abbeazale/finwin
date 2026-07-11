import { z } from "zod";

const FINNHUB_QUOTE_URL = "https://finnhub.io/api/v1/quote";
const CACHE_TTL_MS = 5 * 60 * 1000;

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

export type TickerQuote = {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
};

let cachedQuotes: TickerQuote[] = [];
let cachedAt = 0;

async function fetchQuote(symbol: string, apiKey: string): Promise<TickerQuote | null> {
  const response = await fetch(
    `${FINNHUB_QUOTE_URL}?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`,
    { headers: { accept: "application/json" } },
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

export async function getTickerQuotes(): Promise<TickerQuote[]> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return [];
  }

  const now = Date.now();
  if (cachedQuotes.length > 0 && now - cachedAt < CACHE_TTL_MS) {
    return cachedQuotes;
  }

  try {
    const results = await Promise.all(
      TICKER_SYMBOLS.map((symbol) => fetchQuote(symbol, apiKey)),
    );
    const quotes = results.filter((quote): quote is TickerQuote => quote !== null);

    if (quotes.length > 0) {
      cachedQuotes = quotes;
      cachedAt = now;
    }

    return cachedQuotes;
  } catch {
    // Serve stale quotes (or nothing) rather than failing the landing page.
    return cachedQuotes;
  }
}
