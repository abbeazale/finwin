import {
  intradayMinutes,
  type ChartInput,
  type ChartTimeframe,
} from "@/lib/screener-chart";
import { replaySessions } from "@/lib/screener-replay";
import {
  intradayCandles,
  regularDailyCandles,
  sessionOpen,
  type CandleSlot,
} from "./candles";
import { emaPoints, rsiPoints, type IndicatorPoint } from "./indicators";
import type { ReplayBars } from "./replay";

const INTRADAY_SESSIONS = 5;
const MAX_INTRADAY_SLOTS = 2_000;
const MAX_DAILY_SLOTS = 250;

// JSON-safe display values. Times are UTC epoch milliseconds.
type ChartCandle =
  | {
      status: "available";
      start: number;
      end: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number | null;
    }
  | { status: "missing"; start: number; end: number };
// `run` identifies the native contiguous run so a line never bridges a reset.
type ChartPoint =
  | { state: "available"; value: number; run: number }
  | { state: "warming" }
  | { state: "missing" };
type LatestState =
  | { end: number; state: "available"; value: number; seedStart: number }
  | { end: number; state: "warming"; seedStart: number }
  | { end: number; state: "missing" };

const price = (units: bigint) => Number(units) / 1e9;

function serialize(slot: CandleSlot): ChartCandle {
  if (!slot.bar) return { status: "missing", start: slot.start, end: slot.end };
  const { open, high, low, close, volume } = slot.bar;
  return {
    status: "available",
    start: slot.start,
    end: slot.end,
    open: price(open),
    high: price(high),
    low: price(low),
    close: price(close),
    // Never round an oversized share count; report it as unavailable.
    volume:
      volume <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(volume) : null,
  };
}

function latest(
  slots: readonly CandleSlot[],
  points: readonly IndicatorPoint[],
): LatestState | null {
  const point = points.at(-1);
  const slot = slots.at(-1);
  if (!point || !slot) return null;
  if (point.state === "missing") return { end: slot.end, state: "missing" };
  // Same convention as the screen: the completion time of the first seed candle.
  const seedStart = slots[point.seedIndex].end;
  return point.state === "available"
    ? { end: slot.end, state: "available", value: point.value, seedStart }
    : { end: slot.end, state: "warming", seedStart };
}

function plotted(
  point: IndicatorPoint | undefined,
  slots: readonly CandleSlot[],
): ChartPoint {
  if (!point || point.state === "warming") return { state: "warming" };
  if (point.state === "missing") return { state: "missing" };
  return {
    state: "available",
    value: point.value,
    run: slots[point.seedIndex].start,
  };
}

export function buildChart(bars: ReplayBars, input: ChartInput) {
  const at = Date.parse(`${input.session}T${input.time}:00-04:00`);
  const minutes = bars.minutes.get(input.symbol);
  const native = new Map<ChartTimeframe, CandleSlot[]>();
  // Every interval is calculated over all eligible sample history before the
  // display window is trimmed, so panning never reseeds an indicator.
  function slotsFor(timeframe: ChartTimeframe) {
    let slots = native.get(timeframe);
    if (!slots) {
      slots =
        timeframe === "1d"
          ? regularDailyCandles(minutes, input.session)
          : intradayCandles(minutes, intradayMinutes[timeframe], at);
      native.set(timeframe, slots);
    }
    return slots;
  }

  const all = slotsFor(input.timeframe);
  const sessionIndex = replaySessions.indexOf(input.session);
  const firstShown = sessionOpen(
    replaySessions[Math.max(0, sessionIndex - (INTRADAY_SESSIONS - 1))],
  );
  const shown =
    input.timeframe === "1d"
      ? all.slice(-MAX_DAILY_SLOTS)
      : all.filter((slot) => slot.start >= firstShown).slice(-MAX_INTRADAY_SLOTS);
  const offset = all.length - shown.length;

  function indicator(
    kind: "ema" | "rsi",
    period: number,
    timeframe: ChartTimeframe,
  ) {
    const slots = slotsFor(timeframe);
    const closes = slots.map((slot) => slot.bar?.close);
    const points =
      kind === "ema" ? emaPoints(closes, period) : rsiPoints(closes, period);
    let values: ChartPoint[];
    if (timeframe === input.timeframe) {
      values = shown.map((_, index) => plotted(points[offset + index], slots));
    } else {
      // Hold the latest native state that was available at each displayed
      // completion. A daily value belongs only to later sessions, so it is
      // available strictly after its own close.
      const availableAt = (slot: CandleSlot) =>
        timeframe === "1d" ? slot.end + 1 : slot.end;
      let next = 0;
      values = shown.map((slot) => {
        while (next < slots.length && availableAt(slots[next]) <= slot.end)
          next++;
        return plotted(next > 0 ? points[next - 1] : undefined, slots);
      });
    }
    return {
      kind,
      period,
      timeframe,
      dataset: "EQUS.MINI" as const,
      points: values,
      latest: latest(slots, points),
    };
  }

  const lastExpected = all.at(-1);
  const lastAvailable = all.findLast((slot) => slot.bar);
  return {
    symbol: input.symbol,
    asOf: at,
    session: input.session,
    timeframe: input.timeframe,
    currency: "USD" as const,
    adjustment: "unadjusted" as const,
    dataset: "EQUS.MINI" as const,
    sessionScope: "regular" as const,
    volumeScope: "EQUS.MINI feed only" as const,
    coverage: {
      from: replaySessions[0],
      through: replaySessions[replaySessions.length - 1],
    },
    latestExpected: lastExpected
      ? {
          end: lastExpected.end,
          status: lastExpected.bar
            ? ("available" as const)
            : ("missing" as const),
        }
      : null,
    latestAvailable: lastAvailable ? { end: lastAvailable.end } : null,
    candles: shown.map(serialize),
    indicators: [
      ...input.ema.map((line) => indicator("ema", line.period, line.timeframe)),
      ...(input.rsi
        ? [indicator("rsi", input.rsi.period, input.rsi.timeframe)]
        : []),
    ],
  };
}

export type ChartResult = ReturnType<typeof buildChart>;
