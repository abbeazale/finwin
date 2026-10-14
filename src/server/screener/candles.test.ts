import { expect, test } from "bun:test";
import { sessionOpen } from "@/lib/market-calendar";
import { dailyCandles, intradayCandles, MINUTE, type Bar } from "./candles";
import { calculateRsi, emaPoints, rsiPoints } from "./indicators";

const day = "2026-09-15";
const open = sessionOpen(day);
const units = (value: number) => BigInt(Math.round(value * 1e9));
const at = (clock: string) => Date.parse(`${day}T${clock}:00-04:00`);

// One full session of minutes whose price rises by one cent each minute.
function session(date: string, skip?: number) {
  const start = sessionOpen(date);
  const minutes = new Map<number, Bar>();
  for (let minute = 0; minute < 390; minute++) {
    if (minute === skip) continue;
    const price = units(100 + minute / 100);
    minutes.set(start + minute * MINUTE, {
      open: price,
      high: price + units(0.5),
      low: price - units(0.25),
      close: price + units(0.001),
      volume: BigInt(minute + 1),
    });
  }
  return minutes;
}
function today(minutes: Map<number, Bar>, width: number, clock: string) {
  return intradayCandles(minutes, width, at(clock), [day]).filter(
    (slot) => slot.start >= open,
  );
}

test("10m candles complete at 09:40, not at 09:39", () => {
  const minutes = session(day);
  expect(today(minutes, 10, "09:39")).toHaveLength(0);
  const [first] = today(minutes, 10, "09:40");
  expect(first.start).toBe(open);
  expect(first.end).toBe(open + 10 * MINUTE);
  expect(first.bar).toEqual({
    open: units(100),
    high: units(100.09) + units(0.5),
    low: units(100) - units(0.25),
    close: units(100.09) + units(0.001),
    volume: BigInt(55),
  });
});

test("a 1h chart ends with a 30-minute closing bucket only at 16:00", () => {
  const minutes = session(day);
  expect(today(minutes, 60, "15:59")).toHaveLength(6);
  const full = today(minutes, 60, "16:00");
  const last = full.at(-1);
  expect(full).toHaveLength(7);
  expect(last?.end).toBe(open + 390 * MINUTE);
  expect(last && (last.end - last.start) / MINUTE).toBe(30);
});

test("a missing minute leaves its bucket missing", () => {
  const minutes = session(day, 12);
  expect(
    today(minutes, 5, "09:50").map((slot) => slot.bar === undefined),
  ).toEqual([false, false, true, false]);
});

test("an early close ends the session at 13:00", () => {
  const early = "2025-11-28";
  const slots = intradayCandles(
    new Map(),
    60,
    Date.parse(`${early}T18:00:00Z`),
    [early],
  );
  expect(slots).toHaveLength(4);
  expect(slots.at(-1)?.end).toBe(Date.parse(`${early}T18:00:00Z`));
  expect(slots.at(-1) && (slots.at(-1)!.end - slots.at(-1)!.start) / MINUTE).toBe(30);
});

test("daily candles come from daily bars; a missing day stays missing", () => {
  const bar = { open: units(1), high: units(2), low: units(1), close: units(2), volume: BigInt(5) };
  const daily = dailyCandles(new Map([["2026-09-11", bar]]), ["2026-09-11", "2026-09-14"]);
  expect(daily[0]).toEqual({
    start: sessionOpen("2026-09-11"),
    end: sessionOpen("2026-09-11") + 390 * MINUTE,
    bar,
  });
  expect(daily[1].bar).toBeUndefined();
});

test("EMA seed is the mean of the first N closes, then the recurrence", () => {
  const points = emaPoints([1, 2, 3, 4].map(units), 3);
  expect(points.map((point) => point.state)).toEqual([
    "warming",
    "warming",
    "available",
    "available",
  ]);
  expect(points[2]).toEqual({ state: "available", value: 2, seedIndex: 0 });
  // alpha = 0.5: 2 + 0.5 * (4 - 2)
  expect(points[3]).toEqual({ state: "available", value: 3, seedIndex: 0 });
});

test("EMA of a constant price equals that price exactly", () => {
  const price = units(187.123456789);
  for (const period of [1, 9, 20, 200]) {
    const points = emaPoints(Array(400).fill(price), period);
    for (const point of points.slice(period - 1))
      expect(point).toMatchObject({ value: 187.123456789 });
  }
});

test("EMA period 1 is the close and a gap resets the seed", () => {
  expect(emaPoints([units(1.1), units(2.2)], 1)).toEqual([
    { state: "available", value: 1.1, seedIndex: 0 },
    { state: "available", value: 2.2, seedIndex: 0 },
  ]);
  const gap = emaPoints([...[1, 2, 3].map(units), undefined, units(5)], 2);
  expect(gap.map((point) => point.state)).toEqual([
    "warming",
    "available",
    "available",
    "missing",
    "warming",
  ]);
  expect(gap[4]).toEqual({ state: "warming", seedIndex: 4 });
});

test("RSI points end on the same value as the scalar RSI", () => {
  const closes = [44, 44.3, 44.1, 43.6, 44.3, 44.8, 45.1, 45.4, 45.8].map(units);
  const points = rsiPoints(closes, 3);
  expect(points.slice(0, 3).every((point) => point.state === "warming")).toBe(
    true,
  );
  const last = points.at(-1);
  expect(last?.state).toBe("available");
  expect(last?.state === "available" && last.value).toBe(
    calculateRsi(closes, 3)?.value ?? -1,
  );
});
