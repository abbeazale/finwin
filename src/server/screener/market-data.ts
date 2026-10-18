import { z } from "zod";
import { sessionsBefore } from "@/lib/market-calendar";
import { replaySymbols, type ReplaySymbol } from "@/lib/screener-replay";
import { getServerEnvironment } from "@/server/env";
import type { Bar } from "./candles";
import type { ReplayBars } from "./replay";

// Client for the self-hosted market-data API (market-data/ in this repo).
// Intraday indicators and relative volume use the replay session plus the 60
// sessions before it; daily indicators use the 300 sessions before it. Both
// windows are fixed so a value does not depend on how much history is stored.
const INTRADAY_LOOKBACK_SESSIONS = 60;
const DAILY_LOOKBACK_SESSIONS = 300;
const CACHE_TTL_MS = 10 * 60_000;
const MAX_CACHE_ENTRIES = 12;

export class MarketDataUnavailable extends Error {}

const unit = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const minutesSchema = z.object({
  symbols: z.record(
    z.string(),
    z.array(z.tuple([unit, unit, unit, unit, unit, unit])),
  ),
});
const dailySchema = z.object({
  symbols: z.record(
    z.string(),
    z.array(z.tuple([z.string(), unit, unit, unit, unit, unit])),
  ),
});
const span = z.object({ from: z.string(), through: z.string() }).nullable();
const coverageSchema = z.object({
  minutes: span,
  daily: span,
  floats: z.object({ rows: z.number(), lastSeen: z.string().nullable() }),
});
const floatsSchema = z.object({
  floats: z.array(
    z.object({
      symbol: z.enum(replaySymbols),
      shares: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      firstSeen: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  ),
});
type MarketCoverage = z.infer<typeof coverageSchema>;
export type FloatRecord = z.infer<typeof floatsSchema>["floats"][number];

async function request<T>(
  path: string,
  params: Record<string, string>,
  schema: z.ZodType<T>,
): Promise<T> {
  const { marketDataUrl, marketDataToken } = getServerEnvironment();
  if (!marketDataUrl || !marketDataToken)
    throw new MarketDataUnavailable(
      "Market data is not configured. Set MARKET_DATA_URL and MARKET_DATA_TOKEN.",
    );
  let response: Response;
  try {
    response = await fetch(
      `${marketDataUrl}${path}?${new URLSearchParams(params)}`,
      {
        headers: {
          Authorization: `Bearer ${marketDataToken}`,
          "Accept-Encoding": "gzip",
        },
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
  } catch {
    throw new MarketDataUnavailable(
      "The market-data server is unreachable. Check that it is running and online.",
    );
  }
  if (!response.ok)
    throw new MarketDataUnavailable(
      `The market-data server returned HTTP ${response.status}.`,
    );
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success)
    throw new MarketDataUnavailable(
      "The market-data server returned malformed data.",
    );
  return parsed.data;
}

const cache = new Map<string, { expires: number; value: Promise<unknown> }>();
function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const entry = cache.get(key);
  if (entry && entry.expires > Date.now()) return entry.value as Promise<T>;
  if (cache.size >= MAX_CACHE_ENTRIES) cache.clear();
  const value = load().catch((error: unknown) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value });
  return value;
}

const toBar = ([open, high, low, close, volume]: number[]): Bar => ({
  open: BigInt(open),
  high: BigInt(high),
  low: BigInt(low),
  close: BigInt(close),
  volume: BigInt(volume),
});

export function loadCoverage(): Promise<MarketCoverage> {
  return cached("coverage", () =>
    request("/v1/coverage", {}, coverageSchema),
  );
}

// Minute and (optionally) daily bars for one replay session.
export function loadReplayBars(
  session: string,
  includeDaily: boolean,
): Promise<ReplayBars> {
  return cached(`bars:${session}:${includeDaily}`, async () => {
    const sessions = [
      ...sessionsBefore(session, INTRADAY_LOOKBACK_SESSIONS),
      session,
    ];
    const dailySessions = includeDaily
      ? sessionsBefore(session, DAILY_LOOKBACK_SESSIONS)
      : [];
    const symbols = replaySymbols.join(",");
    const [minuteData, dailyData] = await Promise.all([
      request(
        "/v1/minutes",
        { symbols, from: sessions[0], to: session },
        minutesSchema,
      ),
      dailySessions.length
        ? request(
            "/v1/daily",
            {
              symbols,
              from: dailySessions[0],
              to: dailySessions[dailySessions.length - 1],
            },
            dailySchema,
          )
        : Promise.resolve<z.infer<typeof dailySchema>>({ symbols: {} }),
    ]);
    const minutes = new Map<ReplaySymbol, Map<number, Bar>>();
    const daily = new Map<ReplaySymbol, Map<string, Bar>>();
    for (const symbol of replaySymbols) {
      minutes.set(
        symbol,
        new Map(
          (minuteData.symbols[symbol] ?? []).map(([start, ...bar]) => [
            start,
            toBar(bar),
          ]),
        ),
      );
      daily.set(
        symbol,
        new Map(
          (dailyData.symbols[symbol] ?? []).map(([date, ...bar]) => [
            date,
            toBar(bar),
          ]),
        ),
      );
    }
    return { sessions, minutes, dailySessions, daily };
  });
}

export function loadFloatRecords(): Promise<FloatRecord[]> {
  return cached("floats", async () => {
    const data = await request(
      "/v1/floats",
      { symbols: replaySymbols.join(",") },
      floatsSchema,
    );
    return data.floats;
  });
}
