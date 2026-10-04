import {
  replaySessions,
  replaySymbols,
  type ReplayInput,
  type ReplaySymbol,
  type ScreenFilter,
} from "@/lib/screener-replay";
import { dailySessions } from "./calendar";
import type { ReplayResearch } from "./research";

const MINUTE = 60_000;
type MinuteBar = { close: bigint; volume: bigint };
export type ReplayBars = {
  minutes: ReadonlyMap<ReplaySymbol, ReadonlyMap<number, MinuteBar>>;
  daily: ReadonlyMap<ReplaySymbol, ReadonlyMap<string, bigint>>;
};
type Candle = { close: bigint | undefined; end: number };
type ReplayRow = { symbol: ReplaySymbol } & (
  | { status: "excluded"; reason: string }
  | {
      status: "match" | "no-match";
      price: number;
      sma: number | null;
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
      indicatorCandleEnd: string | null;
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
  timeframe: NonNullable<ScreenFilter["sma"]>["timeframe"],
  session: string,
  at: number,
): Candle[] {
  if (timeframe === "1d") {
    // SUMMARY is finalized end-of-day data. Never use today's daily candle,
    // even at 16:00: the sample does not prove its publication latency.
    return dailySessions
      .filter((dailySession) => dailySession.date < session)
      .map((session) => ({
        close: bars.daily.get(symbol)?.get(session.date),
        end: session.close,
      }));
  }
  const width = timeframe === "1m" ? 1 : 5;
  const minutes = bars.minutes.get(symbol);
  const series: Candle[] = [];
  for (const replaySession of replaySessions) {
    if (replaySession > session) break;
    const open = Date.parse(`${replaySession}T09:30:00-04:00`);
    for (let minute = 0; minute < 390; minute += width) {
      const start = open + minute * MINUTE;
      const end = start + width * MINUTE;
      if (end > at) break;
      let close: bigint | undefined;
      for (let offset = 0; offset < width; offset++) {
        close = minutes?.get(start + offset * MINUTE)?.close;
        if (close === undefined) break;
      }
      series.push({ close, end });
    }
  }
  return series;
}

// Wilder's seed is the arithmetic average of the first N changes in a
// contiguous run. A missing candle resets the seed; no change bridges a gap.
export function calculateRsi(
  closes: readonly (bigint | undefined)[],
  period: number,
): { value: number; seedIndex: number } | null {
  let previous: bigint | undefined;
  let count = 0;
  let gain = 0;
  let loss = 0;
  let seedIndex = 0;
  for (let index = 0; index < closes.length; index++) {
    const close = closes[index];
    if (close === undefined) {
      previous = undefined;
      count = 0;
      gain = 0;
      loss = 0;
      continue;
    }
    if (previous === undefined) {
      previous = close;
      seedIndex = index;
      continue;
    }
    const change = Number(close - previous) / 1e9;
    const up = Math.max(change, 0);
    const down = Math.max(-change, 0);
    count++;
    if (count <= period) {
      gain += up;
      loss += down;
      if (count === period) {
        gain /= period;
        loss /= period;
      }
    } else {
      gain = (gain * (period - 1) + up) / period;
      loss = (loss * (period - 1) + down) / period;
    }
    previous = close;
  }
  if (count < period) return null;
  return {
    value: gain + loss === 0 ? 50 : (100 * gain) / (gain + loss),
    seedIndex,
  };
}

function relativeVolume(
  bars: ReplayBars,
  symbol: ReplaySymbol,
  session: string,
  at: number,
): { error: string } | { current: bigint; baseline: bigint } {
  const index = replaySessions.indexOf(session);
  if (index < 20)
    return {
      error: "Relative volume needs 20 prior sessions in the minute sample.",
    };
  const minutes = bars.minutes.get(symbol);
  const elapsed = (at - Date.parse(`${session}T09:30:00-04:00`)) / MINUTE;
  let baseline = BigInt(0);
  let current = BigInt(0);
  for (const baselineSession of replaySessions.slice(index - 20, index + 1)) {
    const open = Date.parse(`${baselineSession}T09:30:00-04:00`);
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
  const at = Date.parse(`${input.session}T${input.time}:00-04:00`);
  const rows: ReplayRow[] = replaySymbols.map((symbol) => {
    const price = bars.minutes.get(symbol)?.get(at - MINUTE)?.close;
    if (price === undefined)
      return {
        symbol,
        status: "excluded",
        reason: "Missing latest completed one-minute price candle.",
      };
    const failedConditions: string[] = [];
    let sma: number | null = null;
    let indicatorCandleEnd: string | null = null;
    const series = input.sma
      ? candleSeries(bars, symbol, input.sma.timeframe, input.session, at)
      : [];
    if (input.sma) {
      const window = series.slice(-input.sma.period);
      const last = window.at(-1);
      if (window.length < input.sma.period || !last)
        return {
          symbol,
          status: "excluded",
          reason: `Need ${input.sma.period} completed ${input.sma.timeframe} candles; sample history is too short.`,
        };
      let sum = BigInt(0);
      for (const candle of window) {
        if (candle.close === undefined)
          return {
            symbol,
            status: "excluded",
            reason: `SMA is missing a required ${input.sma.timeframe} candle ending ${new Date(candle.end).toISOString()}. No candle was filled or skipped.`,
          };
        sum += candle.close;
      }
      const scaledPrice = price * BigInt(input.sma.period);
      if (
        !(input.sma.comparison === "above"
          ? scaledPrice > sum
          : scaledPrice < sum)
      )
        failedConditions.push("Price/SMA");
      sma = Number(sum) / input.sma.period / 1e9;
      indicatorCandleEnd = new Date(last.end).toISOString();
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
      const previousSession = dailySessions.findLast(
        (session) => session.date < input.session,
      );
      const previousClose =
        previousSession && bars.daily.get(symbol)?.get(previousSession.date);
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
        session: previousSession.date,
      };
      if (
        (price - previousClose) * BigInt(100_000) <
        previousClose * BigInt(Math.round(input.dailyChange.minimum * 1000))
      )
        failedConditions.push("Daily change");
    }
    let float: Extract<ReplayRow, { price: number }>["float"] = null;
    if (input.float) {
      const snapshot = research.floats
        .filter(
          (value) =>
            value.symbol === symbol &&
            Date.parse(value.effectiveAt) <= at &&
            Date.parse(value.publishedAt) <= at,
        )
        .sort(
          (a, b) =>
            Date.parse(b.effectiveAt) - Date.parse(a.effectiveAt) ||
            Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
        )[0];
      if (!snapshot)
        return {
          symbol,
          status: "excluded",
          reason:
            "No historical share-float record is available at this replay time.",
        };
      float = snapshot;
      if (snapshot.shares >= input.float.maximum)
        failedConditions.push("Float");
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
        input.rsi.timeframe === input.sma?.timeframe
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
          reason: `RSI needs ${input.rsi.period + 1} consecutive completed ${input.rsi.timeframe} closes after the sample start or last gap.`,
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
        currentVolume: Number(result.current),
        baselineVolume: Number(result.baseline) / 20,
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
      sma,
      dailyChange,
      float,
      news,
      priceCandleEnd: new Date(at).toISOString(),
      indicatorCandleEnd,
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
    dataset: "EQUS.MINI" as const,
    smaDataset: input.sma?.timeframe === "1d" ? "EQUS.SUMMARY" : "EQUS.MINI",
    rsiDataset: input.rsi?.timeframe === "1d" ? "EQUS.SUMMARY" : "EQUS.MINI",
    rows,
    matchCount: rows.filter((row) => row.status === "match").length,
    excludedCount: rows.filter((row) => row.status === "excluded").length,
  };
}

export type ReplayResult = ReturnType<typeof evaluateReplay>;
