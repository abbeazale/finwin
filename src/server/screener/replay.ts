import {
  replaySymbols,
  type ReplayInput,
  type ReplaySymbol,
  type ScreenFilter,
} from "@/lib/screener-replay";
import { newYorkTime, sessionClose, sessionOpen } from "@/lib/market-calendar";
import { intradayCandles, MINUTE, type Bar } from "./candles";
import { calculateRsi, emaPoints, latestValue } from "./indicators";
import type { ReplayResearch } from "./research";

// Bars for one replay session. `sessions` is the intraday window, ascending
// and ending with the replay session; indicators seed from its start.
// `dailySessions` are the sessions before it that daily indicators use.
export type ReplayBars = {
  sessions: readonly string[];
  minutes: ReadonlyMap<ReplaySymbol, ReadonlyMap<number, Bar>>;
  dailySessions: readonly string[];
  daily: ReadonlyMap<ReplaySymbol, ReadonlyMap<string, Bar>>;
};
export const MINUTE_DATASET = "Massive minute bars";
export const DAILY_DATASET = "Massive daily bars";
type Candle = { close: bigint | undefined; end: number };
type ReplayRow = { symbol: ReplaySymbol } & (
  | { status: "excluded"; reason: string }
  | {
      status: "match" | "no-match";
      price: number;
      ema: { value: number; candleEnd: string; seedStart: string } | null;
      dailyChange: {
        value: number;
        previousClose: number;
        session: string;
      } | null;
      float: {
        shares: number;
        effectiveAt: string;
        publishedAt: string;
        source: string;
      } | null;
      news:
        | {
            headline: string;
            url: string;
            publishedAt: string;
            source: string;
          }[]
        | null;
      priceCandleEnd: string;
      rsi: { value: number; candleEnd: string; seedStart: string } | null;
      relativeVolume: {
        value: number;
        currentVolume: number;
        baselineVolume: number;
      } | null;
      failedConditions: string[];
    }
);

function candleSeries(
  bars: ReplayBars,
  symbol: ReplaySymbol,
  timeframe: NonNullable<ScreenFilter["ema"]>["timeframe"],
  session: string,
  at: number,
): Candle[] {
  if (timeframe === "1d") {
    // Daily bars are end-of-day data. Never use today's daily candle, even at
    // the close: its publication time is not known.
    return bars.dailySessions
      .filter((date) => date < session)
      .map((date) => ({
        close: bars.daily.get(symbol)?.get(date)?.close,
        end: sessionClose(date),
      }));
  }
  return intradayCandles(
    bars.minutes.get(symbol),
    timeframe === "1m" ? 1 : 5,
    at,
    bars.sessions,
  ).map((slot) => ({ close: slot.bar?.close, end: slot.end }));
}

function relativeVolume(
  bars: ReplayBars,
  symbol: ReplaySymbol,
  session: string,
  at: number,
): { error: string } | { current: bigint; baseline: bigint } {
  const index = bars.sessions.indexOf(session);
  if (index < 20)
    return {
      error: "Relative volume needs 20 prior sessions of stored minutes.",
    };
  const minutes = bars.minutes.get(symbol);
  const elapsed = (at - sessionOpen(session)) / MINUTE;
  let baseline = BigInt(0);
  let current = BigInt(0);
  for (const baselineSession of bars.sessions.slice(index - 20, index + 1)) {
    const open = sessionOpen(baselineSession);
    for (let minute = 0; minute < elapsed; minute++) {
      const volume = minutes?.get(open + minute * MINUTE)?.volume;
      if (volume === undefined)
        return {
          error: `Relative volume is missing a required minute on ${baselineSession}.`,
        };
      if (baselineSession === session) current += volume;
      else baseline += volume;
    }
  }
  if (baseline === BigInt(0))
    return { error: "Relative volume has a zero-volume baseline." };
  return { current, baseline };
}

export function evaluateReplay(
  bars: ReplayBars,
  input: ReplayInput,
  research: ReplayResearch = { news: new Map(), floats: [] },
) {
  const at = newYorkTime(input.session, input.time);
  const rows: ReplayRow[] = replaySymbols.map((symbol) => {
    const price = bars.minutes.get(symbol)?.get(at - MINUTE)?.close;
    if (price === undefined)
      return {
        symbol,
        status: "excluded",
        reason: "Missing latest completed one-minute price candle.",
      };
    const failedConditions: string[] = [];
    let ema: Extract<ReplayRow, { price: number }>["ema"] = null;
    const series = input.ema
      ? candleSeries(bars, symbol, input.ema.timeframe, input.session, at)
      : [];
    if (input.ema) {
      const { period, timeframe } = input.ema;
      const last = series.at(-1);
      if (last && last.close === undefined)
        return {
          symbol,
          status: "excluded",
          reason: `EMA is missing the latest ${timeframe} candle ending ${new Date(last.end).toISOString()}. No candle was filled or skipped.`,
        };
      const value = latestValue(
        emaPoints(
          series.map((candle) => candle.close),
          period,
        ),
      );
      if (!value || !last)
        return {
          symbol,
          status: "excluded",
          reason: `EMA needs ${period} consecutive completed ${timeframe} candles after the history start or last gap.`,
        };
      // Strict comparison against the unrounded EMA; equality matches neither.
      const latest = Number(price) / 1e9;
      if (
        !(input.ema.comparison === "above"
          ? latest > value.value
          : latest < value.value)
      )
        failedConditions.push("Price/EMA");
      ema = {
        value: value.value,
        candleEnd: new Date(last.end).toISOString(),
        seedStart: new Date(series[value.seedIndex].end).toISOString(),
      };
    }
    if (input.priceRange) {
      // Compare integer cents against the original billionths, before display rounding.
      const minimum =
        BigInt(Math.round(input.priceRange.minimum * 100)) * BigInt(10_000_000);
      const maximum =
        BigInt(Math.round(input.priceRange.maximum * 100)) * BigInt(10_000_000);
      if (price < minimum || price > maximum)
        failedConditions.push("Price range");
    }
    let dailyChange: Extract<ReplayRow, { price: number }>["dailyChange"] =
      null;
    if (input.dailyChange) {
      const previousSession = bars.dailySessions.findLast(
        (date) => date < input.session,
      );
      const previousClose = previousSession
        ? bars.daily.get(symbol)?.get(previousSession)?.close
        : undefined;
      if (
        !previousSession ||
        previousClose === undefined ||
        previousClose <= BigInt(0)
      )
        return {
          symbol,
          status: "excluded",
          reason:
            "Daily change needs the previous trading session's closing price.",
        };
      dailyChange = {
        value: (Number(price - previousClose) / Number(previousClose)) * 100,
        previousClose: Number(previousClose) / 1e9,
        session: previousSession,
      };
      if (
        (price - previousClose) * BigInt(100_000) <
        previousClose * BigInt(Math.round(input.dailyChange.minimum * 1000))
      )
        failedConditions.push("Daily change");
    }
    let float: Extract<ReplayRow, { price: number }>["float"] = null;
    if (input.float) {
      const records = research.floats.filter(
        (value) => value.symbol === symbol,
      );
      const snapshot = records
        .filter(
          (value) =>
            Date.parse(value.effectiveAt) <= at &&
            Date.parse(value.publishedAt) <= at,
        )
        .sort(
          (a, b) =>
            Date.parse(b.effectiveAt) - Date.parse(a.effectiveAt) ||
            Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
        )[0];
      if (!snapshot) {
        const earliest = records.map((value) => value.effectiveAt).sort()[0];
        return {
          symbol,
          status: "excluded",
          reason: earliest
            ? `No free-float value was in effect yet. The earliest saved value applies from ${earliest.slice(0, 10)}.`
            : "No free-float data for this instrument. ETFs have none.",
        };
      }
      float = snapshot;
      if (snapshot.shares >= input.float.maximum)
        failedConditions.push("Free float");
    }
    let news: Extract<ReplayRow, { price: number }>["news"] = null;
    if (input.news) {
      const coverage = research.news.get(symbol);
      const from = at - input.news.hours * 3_600_000;
      if (!coverage || coverage.status === "unavailable")
        return {
          symbol,
          status: "excluded",
          reason:
            coverage?.reason ??
            "Historical news is unavailable for this instrument.",
        };
      if (coverage.from > from || coverage.through < at)
        return {
          symbol,
          status: "excluded",
          reason: "News coverage does not span the selected lookback window.",
        };
      news = coverage.articles.filter(
        (article) =>
          Date.parse(article.publishedAt) >= from &&
          Date.parse(article.publishedAt) <= at,
      );
      if (news.length === 0) failedConditions.push("Recent news");
    }
    let rsi: Extract<ReplayRow, { price: number }>["rsi"] = null;
    if (input.rsi) {
      const rsiSeries =
        input.rsi.timeframe === input.ema?.timeframe
          ? series
          : candleSeries(bars, symbol, input.rsi.timeframe, input.session, at);
      const value = calculateRsi(
        rsiSeries.map((candle) => candle.close),
        input.rsi.period,
      );
      const end = rsiSeries.at(-1);
      if (!value || !end)
        return {
          symbol,
          status: "excluded",
          reason: `RSI needs ${input.rsi.period + 1} consecutive completed ${input.rsi.timeframe} closes after the history start or last gap.`,
        };
      rsi = {
        value: value.value,
        candleEnd: new Date(end.end).toISOString(),
        seedStart: new Date(rsiSeries[value.seedIndex].end).toISOString(),
      };
      if (
        !(input.rsi.comparison === "above"
          ? value.value > input.rsi.threshold
          : value.value < input.rsi.threshold)
      )
        failedConditions.push("RSI");
    }
    let volume: Extract<ReplayRow, { price: number }>["relativeVolume"] = null;
    if (input.relativeVolume) {
      const result = relativeVolume(bars, symbol, input.session, at);
      if ("error" in result)
        return { symbol, status: "excluded", reason: result.error };
      volume = {
        value: Number(result.current * BigInt(20)) / Number(result.baseline),
        currentVolume: Number(result.current) / 1e6,
        baselineVolume: Number(result.baseline) / 20 / 1e6,
      };
      if (
        result.current * BigInt(20_000) <
        result.baseline *
          BigInt(Math.round(input.relativeVolume.minimum * 1000))
      )
        failedConditions.push("Relative volume");
    }
    return {
      symbol,
      status: failedConditions.length === 0 ? "match" : "no-match",
      price: Number(price) / 1e9,
      ema,
      dailyChange,
      float,
      news,
      priceCandleEnd: new Date(at).toISOString(),
      rsi,
      relativeVolume: volume,
      failedConditions,
    };
  });
  return {
    input,
    asOf: new Date(at).toISOString(),
    activeFilterCount: Object.entries(input).filter(
      ([key, value]) =>
        key !== "session" && key !== "time" && value !== undefined,
    ).length,
    dataset: MINUTE_DATASET,
    emaDataset: input.ema?.timeframe === "1d" ? DAILY_DATASET : MINUTE_DATASET,
    rsiDataset: input.rsi?.timeframe === "1d" ? DAILY_DATASET : MINUTE_DATASET,
    rows,
    matchCount: rows.filter((row) => row.status === "match").length,
    excludedCount: rows.filter((row) => row.status === "excluded").length,
  };
}

export type ReplayResult = ReturnType<typeof evaluateReplay>;
