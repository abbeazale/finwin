// One sequential pass per indicator emits a state for every candle. A missing
// close resets the run; `seedIndex` is the first close of the current run.
export type IndicatorPoint =
  | { state: "available"; value: number; seedIndex: number }
  | { state: "warming"; seedIndex: number }
  | { state: "missing" };

// EMA with alpha = 2/(N+1), seeded at the mean of the first N consecutive
// closes. The seed is computed relative to its first close so a constant price
// gives exactly that price. Period 1 is the close itself.
export function emaPoints(
  closes: readonly (bigint | undefined)[],
  period: number,
): IndicatorPoint[] {
  const alpha = 2 / (period + 1);
  const points: IndicatorPoint[] = [];
  let seedIndex = -1;
  let count = 0;
  let sum = BigInt(0);
  let ema = 0;
  for (let index = 0; index < closes.length; index++) {
    const close = closes[index];
    if (close === undefined) {
      seedIndex = -1;
      count = 0;
      sum = BigInt(0);
      points.push({ state: "missing" });
      continue;
    }
    if (seedIndex < 0) seedIndex = index;
    count++;
    if (period === 1) {
      ema = Number(close) / 1e9;
    } else if (count < period) {
      sum += close;
      points.push({ state: "warming", seedIndex });
      continue;
    } else if (count === period) {
      sum += close;
      const first = closes[seedIndex] ?? close;
      ema =
        Number(first) / 1e9 +
        Number(sum - first * BigInt(period)) / period / 1e9;
    } else {
      ema = ema + alpha * (Number(close) / 1e9 - ema);
    }
    points.push({ state: "available", value: ema, seedIndex });
  }
  return points;
}

// Wilder's seed is the arithmetic average of the first N changes in a
// contiguous run. A missing candle resets the seed; no change bridges a gap.
export function rsiPoints(
  closes: readonly (bigint | undefined)[],
  period: number,
): IndicatorPoint[] {
  const points: IndicatorPoint[] = [];
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
      points.push({ state: "missing" });
      continue;
    }
    if (previous === undefined) {
      previous = close;
      seedIndex = index;
      points.push({ state: "warming", seedIndex });
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
    points.push(
      count < period
        ? { state: "warming", seedIndex }
        : {
            state: "available",
            value: gain + loss === 0 ? 50 : (100 * gain) / (gain + loss),
            seedIndex,
          },
    );
  }
  return points;
}

// Final scalar of a series, or null unless its latest candle is available.
export function latestValue(points: readonly IndicatorPoint[]) {
  const last = points.at(-1);
  return last?.state === "available"
    ? { value: last.value, seedIndex: last.seedIndex }
    : null;
}

export function calculateRsi(
  closes: readonly (bigint | undefined)[],
  period: number,
): { value: number; seedIndex: number } | null {
  return latestValue(rsiPoints(closes, period));
}
