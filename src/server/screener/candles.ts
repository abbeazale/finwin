import { sessionLength, sessionOpen } from "@/lib/market-calendar";

export const MINUTE = 60_000;

// Prices are integer billionths of a USD; volume is integer millionths of a
// share, because the provider reports fractional share volume.
export type Bar = {
  open: bigint;
  high: bigint;
  low: bigint;
  close: bigint;
  volume: bigint;
};
// `bar` is undefined when any constituent minute is missing. A missing slot is
// never filled, carried forward or partially aggregated.
export type CandleSlot = { start: number; end: number; bar: Bar | undefined };
type MinuteBars = ReadonlyMap<number, Bar> | undefined;

function aggregate(minutes: MinuteBars, start: number, count: number) {
  let bar: Bar | undefined;
  for (let offset = 0; offset < count; offset++) {
    const minute = minutes?.get(start + offset * MINUTE);
    if (!minute) return undefined;
    bar = bar
      ? {
          open: bar.open,
          high: minute.high > bar.high ? minute.high : bar.high,
          low: minute.low < bar.low ? minute.low : bar.low,
          close: minute.close,
          volume: bar.volume + minute.volume,
        }
      : { ...minute };
  }
  return bar;
}

// Regular-session candles of `width` minutes over `sessions`, anchored at
// 09:30 and completed by `at`. The final bucket is clipped at the close, so a
// 1h chart ends with a 30-minute 15:30 candle. Buckets never cross the close,
// weekends or holidays.
export function intradayCandles(
  minutes: MinuteBars,
  width: number,
  at: number,
  sessions: readonly string[],
): CandleSlot[] {
  const slots: CandleSlot[] = [];
  for (const date of sessions) {
    const open = sessionOpen(date);
    const length = sessionLength(date);
    for (let offset = 0; offset < length; offset += width) {
      const start = open + offset * MINUTE;
      const size = Math.min(width, length - offset);
      const end = start + size * MINUTE;
      if (end > at) return slots;
      slots.push({ start, end, bar: aggregate(minutes, start, size) });
    }
  }
  return slots;
}

// Provider daily bars for `sessions`, which must all be before the replay
// session: a day's candle belongs only to later days, even at its close.
export function dailyCandles(
  daily: ReadonlyMap<string, Bar> | undefined,
  sessions: readonly string[],
): CandleSlot[] {
  return sessions.map((date) => {
    const start = sessionOpen(date);
    return {
      start,
      end: start + sessionLength(date) * MINUTE,
      bar: daily?.get(date),
    };
  });
}
