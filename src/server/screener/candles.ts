import { replaySessions } from "@/lib/screener-replay";

export const MINUTE = 60_000;
const SESSION_MINUTES = 390;

// Prices are integer billionths of a USD; volume is integer shares.
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

// All replay sessions fall in daylight time, so the fixed offset is exact.
export function sessionOpen(date: string): number {
  return Date.parse(`${date}T09:30:00-04:00`);
}

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

// Regular-session candles of `width` minutes, anchored at 09:30 and completed
// by `at`. The final bucket is clipped at 16:00, so a 1h chart ends with a
// 30-minute 15:30 candle. Buckets never cross the close, weekends or holidays.
export function intradayCandles(
  minutes: MinuteBars,
  width: number,
  at: number,
): CandleSlot[] {
  const slots: CandleSlot[] = [];
  for (const date of replaySessions) {
    const open = sessionOpen(date);
    for (let offset = 0; offset < SESSION_MINUTES; offset += width) {
      const start = open + offset * MINUTE;
      const length = Math.min(width, SESSION_MINUTES - offset);
      const end = start + length * MINUTE;
      if (end > at) return slots;
      slots.push({ start, end, bar: aggregate(minutes, start, length) });
    }
  }
  return slots;
}

// Regular-session daily candles built from minute bars. Only sessions before
// `session` are eligible, even at 16:00: a day's candle belongs to later days.
export function regularDailyCandles(
  minutes: MinuteBars,
  session: string,
): CandleSlot[] {
  return replaySessions
    .filter((date) => date < session)
    .map((date) => {
      const start = sessionOpen(date);
      return {
        start,
        end: start + SESSION_MINUTES * MINUTE,
        bar: aggregate(minutes, start, SESSION_MINUTES),
      };
    });
}
