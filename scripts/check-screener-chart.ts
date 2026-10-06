import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  chartInputSchema,
  chartTimeframes,
  type ChartInput,
  type ChartTimeframe,
} from "../src/lib/screener-chart";
import {
  replaySessions,
  replaySymbols,
  type ReplaySymbol,
} from "../src/lib/screener-replay";
import { loadReplayBars } from "../src/server/screener/cache";
import { buildChart, type ChartResult } from "../src/server/screener/chart";
import { evaluateReplay } from "../src/server/screener/replay";
import { screenerRouter } from "../src/server/trpc/routers/screener";

const started = performance.now();
const bars = await loadReplayBars(false);
const base: ChartInput = {
  symbol: "NVDA",
  session: "2026-09-15",
  time: "10:30",
  timeframe: "1m",
  ema: [],
};

// Independent aggregation straight from the raw download: floats, New York
// wall-clock keys and its own bucket arithmetic, not the app's candle module.
type Raw = { o: number; h: number; l: number; c: number; v: number };
const raw = new Map<string, Raw>();
for (const line of (
  await readFile(".local/databento-probe/mini-minute.jsonl", "utf8")
)
  .trim()
  .split("\n")) {
  const row = JSON.parse(line);
  const stamp = new Date(row.hd.ts_event);
  const date = stamp.toISOString().slice(0, 10);
  // Sample is entirely EDT: New York = UTC - 4h.
  const minute = stamp.getUTCHours() * 60 + stamp.getUTCMinutes() - 4 * 60;
  const offset = minute - (9 * 60 + 30);
  if (offset < 0 || offset >= 390) continue;
  raw.set(`${row.symbol}|${date}|${offset}`, {
    o: Number(row.open),
    h: Number(row.high),
    l: Number(row.low),
    c: Number(row.close),
    v: Number(row.volume),
  });
}
const widths: Record<Exclude<ChartTimeframe, "1d">, number> = {
  "1m": 1,
  "5m": 5,
  "10m": 10,
  "15m": 15,
  "30m": 30,
  "1h": 60,
};
function expectedBucket(
  symbol: ReplaySymbol,
  date: string,
  first: number,
  count: number,
): Raw | null {
  const minutes: Raw[] = [];
  for (let offset = first; offset < first + count; offset++) {
    const bar = raw.get(`${symbol}|${date}|${offset}`);
    if (!bar) return null;
    minutes.push(bar);
  }
  return {
    o: minutes[0].o,
    h: Math.max(...minutes.map((bar) => bar.h)),
    l: Math.min(...minutes.map((bar) => bar.l)),
    c: minutes[minutes.length - 1].c,
    v: minutes.reduce((sum, bar) => sum + bar.v, 0),
  };
}
const nyOpen = (date: string) => Date.parse(`${date}T13:30:00Z`);

function expectedCandles(
  symbol: ReplaySymbol,
  timeframe: ChartTimeframe,
  session: string,
  time: string,
) {
  const at = Date.parse(`${session}T${time}:00-04:00`);
  const out: { start: number; end: number; bar: Raw | null }[] = [];
  for (const date of replaySessions) {
    if (timeframe === "1d") {
      if (date >= session) break;
      out.push({
        start: nyOpen(date),
        end: nyOpen(date) + 390 * 60_000,
        bar: expectedBucket(symbol, date, 0, 390),
      });
      continue;
    }
    const width = widths[timeframe];
    for (let first = 0; first < 390; first += width) {
      const count = Math.min(width, 390 - first);
      const start = nyOpen(date) + first * 60_000;
      const end = start + count * 60_000;
      if (end > at) return out;
      out.push({ start, end, bar: expectedBucket(symbol, date, first, count) });
    }
  }
  return out;
}

function close(a: number, b: number, label: string) {
  assert.ok(Math.abs(a - b) < 1e-9, `${label}: ${a} vs ${b}`);
}

let candleComparisons = 0;
const sizes: Record<string, number> = {};
const clocks = [
  ["2026-09-15", "10:30"],
  ["2026-09-15", "16:00"],
  ["2026-08-18", "13:45"],
  ["2026-08-03", "09:31"],
] as const;
for (const symbol of replaySymbols)
  for (const timeframe of chartTimeframes)
    for (const [session, time] of clocks) {
      const result = buildChart(bars, {
        ...base,
        symbol,
        session,
        time,
        timeframe,
      });
      const expected = expectedCandles(symbol, timeframe, session, time);
      const shown =
        timeframe === "1d"
          ? expected.slice(-250)
          : expected.filter(
              (slot) =>
                slot.start >=
                nyOpen(
                  replaySessions[
                    Math.max(0, replaySessions.indexOf(session) - 4)
                  ],
                ),
            );
      const label = `${symbol} ${timeframe} ${session} ${time}`;
      assert.equal(result.candles.length, shown.length, label);
      assert.ok(result.candles.length <= (timeframe === "1d" ? 250 : 2000));
      result.candles.forEach((candle, index) => {
        const want = shown[index];
        assert.equal(candle.start, want.start, label);
        assert.equal(candle.end, want.end, label);
        assert.ok(candle.end <= result.asOf, `${label} lookahead`);
        if (!want.bar) {
          assert.equal(candle.status, "missing", `${label} gap`);
          return;
        }
        assert.equal(candle.status, "available", label);
        if (candle.status !== "available") return;
        close(candle.open, want.bar.o, `${label} open`);
        close(candle.high, want.bar.h, `${label} high`);
        close(candle.low, want.bar.l, `${label} low`);
        close(candle.close, want.bar.c, `${label} close`);
        assert.equal(candle.volume, want.bar.v, `${label} volume`);
        candleComparisons++;
      });
      sizes[`${timeframe} ${session} ${time}`] = JSON.stringify(result).length;
    }

// Boundaries: 10m at 09:39/09:40, 5m at 10:34/10:35, the 1h closing bucket.
const today = (result: ChartResult) =>
  result.candles.filter((candle) => candle.start >= nyOpen(result.session));
const at = (time: string, timeframe: ChartTimeframe) =>
  buildChart(bars, { ...base, time, timeframe });
assert.equal(today(at("09:39", "10m")).length, 0);
assert.equal(today(at("09:40", "10m")).length, 1);
assert.equal(
  today(at("10:34", "5m")).at(-1)?.end,
  Date.parse("2026-09-15T14:30:00Z"),
);
assert.equal(
  today(at("10:35", "5m")).at(-1)?.end,
  Date.parse("2026-09-15T14:35:00Z"),
);
assert.equal(today(at("15:59", "1h")).length, 6);
const closing = today(at("16:00", "1h")).at(-1);
assert.ok(closing && closing.end - closing.start === 30 * 60_000);
// Daily candles never include the replay session, even at 16:00.
assert.ok(
  at("16:00", "1d").candles.every((candle) => candle.start < nyOpen("2026-09-15")),
);

// Indicators: the chart EMA/RSI at the cutoff equals the screen's value for
// the same symbol, interval, period, feed and seed history.
let screenAgreement = 0;
for (const symbol of replaySymbols)
  for (const timeframe of ["1m", "5m"] as const)
    for (const period of [1, 9, 20, 200]) {
      const chart = buildChart(bars, {
        ...base,
        symbol,
        timeframe,
        ema: [{ period, timeframe }],
        rsi: { period: 14, timeframe },
      });
      const screen = evaluateReplay(bars, {
        session: base.session,
        time: base.time,
        ema: { timeframe, period, comparison: "above" },
        rsi: { timeframe, period: 14, comparison: "above", threshold: 0 },
      }).rows.find((row) => row.symbol === symbol);
      assert.ok(screen && screen.status !== "excluded");
      const [ema, rsi] = chart.indicators;
      assert.equal(ema.latest?.state, "available");
      assert.equal(rsi.latest?.state, "available");
      if (ema.latest?.state !== "available" || rsi.latest?.state !== "available")
        continue;
      assert.equal(ema.latest.value, screen.ema?.value);
      assert.equal(new Date(ema.latest.end).toISOString(), screen.ema?.candleEnd);
      assert.equal(rsi.latest.value, screen.rsi?.value);
      assert.equal(
        new Date(ema.latest.seedStart).toISOString(),
        screen.ema?.seedStart,
      );
      assert.equal(
        new Date(rsi.latest.seedStart).toISOString(),
        screen.rsi?.seedStart,
      );
      const lastPoint = ema.points.at(-1);
      assert.equal(
        lastPoint?.state === "available" && lastPoint.value,
        ema.latest.value,
      );
      screenAgreement++;
    }

// Independent EMA over the raw aggregation for every interval (float seed).
function rawEma(values: (number | null)[], period: number) {
  const out: (number | null)[] = [];
  let run: number[] = [];
  let ema = 0;
  for (const value of values) {
    if (value === null) {
      run = [];
      out.push(null);
      continue;
    }
    run.push(value);
    if (run.length < period) out.push(null);
    else if (run.length === period)
      out.push((ema = run.reduce((sum, item) => sum + item, 0) / period));
    else out.push((ema = ema + (2 / (period + 1)) * (value - ema)));
  }
  return out;
}
let emaComparisons = 0;
for (const timeframe of chartTimeframes)
  for (const period of [9, 20]) {
    const result = buildChart(bars, {
      ...base,
      time: "16:00",
      timeframe,
      ema: [{ period, timeframe }],
    });
    const expected = rawEma(
      expectedCandles(base.symbol, timeframe, base.session, "16:00").map(
        (slot) => slot.bar?.c ?? null,
      ),
      period,
    ).slice(-result.candles.length);
    result.indicators[0].points.forEach((point, index) => {
      const want = expected[index];
      if (want === null) assert.notEqual(point.state, "available");
      else {
        assert.equal(point.state, "available", `${timeframe} EMA ${period}`);
        if (point.state === "available")
          assert.ok(Math.abs(point.value - want) < 1e-6);
        emaComparisons++;
      }
    });
  }

// Projection: a 1m EMA 9 and a daily EMA 9 on a 10m chart hold the latest
// native state at each displayed completion and never use a later value.
const projected = buildChart(bars, {
  ...base,
  time: "16:00",
  timeframe: "10m",
  ema: [
    { period: 9, timeframe: "1m" },
    { period: 9, timeframe: "1d" },
  ],
});
const oneMinute = buildChart(bars, {
  ...base,
  time: "16:00",
  timeframe: "1m",
  ema: [{ period: 9, timeframe: "1m" }],
});
const byEnd = new Map(
  oneMinute.candles.map((candle, index) => [
    candle.end,
    oneMinute.indicators[0].points[index],
  ]),
);
projected.candles.forEach((candle, index) => {
  assert.deepEqual(projected.indicators[0].points[index], byEnd.get(candle.end));
});
const dailyLine = projected.indicators[1];
const dailyChart = buildChart(bars, {
  ...base,
  timeframe: "1d",
  ema: [{ period: 9, timeframe: "1d" }],
});
projected.candles.forEach((candle, index) => {
  const date = new Date(candle.start).toISOString().slice(0, 10);
  // Latest daily candle strictly before this candle's session.
  const dailyIndex = dailyChart.candles.findLastIndex(
    (day) => new Date(day.start).toISOString().slice(0, 10) < date,
  );
  const want =
    dailyIndex < 0
      ? { state: "warming" }
      : buildChart(bars, {
          ...base,
          session: date,
          timeframe: "1d",
          ema: [{ period: 9, timeframe: "1d" }],
        }).indicators[0].points.at(-1);
  assert.deepEqual(dailyLine.points[index], want, `daily overlay ${date}`);
});

// No lookahead: removing every minute after the cutoff changes nothing.
const cutoff = Date.parse("2026-09-15T14:30:00Z");
const past = {
  ...bars,
  minutes: new Map(
    replaySymbols.map((symbol) => [
      symbol,
      new Map(
        [...(bars.minutes.get(symbol) ?? [])].filter(
          ([start]) => start + 60_000 <= cutoff,
        ),
      ),
    ]),
  ),
};
for (const timeframe of chartTimeframes) {
  const input: ChartInput = {
    ...base,
    timeframe,
    ema: [
      { period: 9, timeframe },
      { period: 20, timeframe: "1m" },
      { period: 9, timeframe: "1d" },
    ],
    rsi: { period: 14, timeframe: "5m" },
  };
  assert.deepEqual(buildChart(past, input), buildChart(bars, input), timeframe);
}

// Gaps: IWM is missing the 13:43 minute on 2026-08-18, the sample's only
// gap. The EMA restarts after it and needs nine new closes.
const gap = buildChart(bars, {
  ...base,
  symbol: "IWM",
  session: "2026-08-18",
  time: "14:00",
  ema: [{ period: 9, timeframe: "1m" }],
});
const missing = gap.candles.findIndex((candle) => candle.status === "missing");
assert.ok(missing > 0, "expected a missing IWM minute");
assert.equal(gap.indicators[0].points[missing].state, "missing");
const after = gap.indicators[0].points.slice(missing + 1, missing + 9);
assert.ok(after.every((point) => point.state === "warming"));
const resumed = gap.indicators[0].points[missing + 9];
const before = gap.indicators[0].points[missing - 1];
assert.ok(resumed.state === "available" && before.state === "available");
assert.notEqual(resumed.run, before.run);
const tenMinute = buildChart(bars, {
  ...base,
  symbol: "IWM",
  session: "2026-08-18",
  time: "14:00",
  timeframe: "10m",
});
assert.equal(
  tenMinute.candles.filter((candle) => candle.status === "missing").length,
  1,
);

// Warmup: EMA 200 daily is unavailable with ~6 weeks of regular sessions,
// while daily candles stay usable.
const warm = buildChart(bars, {
  ...base,
  timeframe: "1d",
  ema: [{ period: 200, timeframe: "1d" }],
});
assert.ok(warm.candles.some((candle) => candle.status === "available"));
assert.ok(warm.indicators[0].points.every((point) => point.state !== "available"));
assert.equal(warm.indicators[0].latest?.state, "warming");

// JSON safety: no BigInt, NaN or Infinity in any response.
const json = JSON.stringify(projected);
assert.deepEqual(JSON.parse(json), projected);
assert.ok(!/NaN|Infinity/.test(json));

// Input limits.
for (const invalid of [
  { timeframe: "2m" },
  { symbol: "TSLA" },
  { time: "16:01" },
  { session: "2026-09-07" },
  { ema: [{ period: 0, timeframe: "1m" }] },
  { ema: [{ period: 201, timeframe: "1m" }] },
  {
    ema: [
      { period: 9, timeframe: "1m" },
      { period: 9, timeframe: "1m" },
    ],
  },
  {
    ema: [9, 20, 50, 200].map((period) => ({ period, timeframe: "1m" })),
  },
  { rsi: { period: 1, timeframe: "1m" } },
  { ema: [], extra: true },
])
  assert.equal(
    chartInputSchema.safeParse({ ...base, ...invalid }).success,
    false,
    JSON.stringify(invalid),
  );

// Charts need only the minute file: no SUMMARY, news or float.
const fixture = await mkdtemp(path.join(tmpdir(), "finwin-chart-cache-"));
try {
  const folder = path.join(fixture, ".local/databento-probe");
  await mkdir(folder, { recursive: true });
  await Promise.all(
    ["manifest.json", "mini-minute.jsonl"].map((file) =>
      copyFile(
        path.join(".local/databento-probe", file),
        path.join(folder, file),
      ),
    ),
  );
  const source = `import assert from "node:assert/strict";
    import { screenerRouter } from ${JSON.stringify(path.resolve("src/server/trpc/routers/screener.ts"))};
    process.chdir(${JSON.stringify(fixture)});
    const caller = screenerRouter.createCaller({ userId: "u", sessionCreatedAt: new Date(), correlationId: "c" });
    const chart = await caller.chart(${JSON.stringify({ ...base, timeframe: "1d", ema: [{ period: 9, timeframe: "1d" }] })});
    assert.ok(chart.candles.length > 0);
    console.log("chart-minute-only-ok");`;
  assert.match(
    execFileSync(process.execPath, ["-e", source], { encoding: "utf8" }),
    /chart-minute-only-ok/,
  );
} finally {
  await rm(fixture, { recursive: true, force: true });
}

// Access control through the real tRPC boundary.
const context = {
  userId: "chart-check-user",
  sessionCreatedAt: new Date(),
  correlationId: "chart-check",
};
assert.deepEqual(
  await screenerRouter.createCaller(context).chart(base),
  buildChart(bars, base),
);
await assert.rejects(
  screenerRouter.createCaller({ ...context, userId: null }).chart(base),
  { code: "UNAUTHORIZED" },
);
await assert.rejects(
  screenerRouter
    .createCaller(context)
    .chart({ ...base, timeframe: "2m" as ChartTimeframe }),
  { code: "BAD_REQUEST" },
);

const timing = performance.now();
buildChart(bars, {
  ...base,
  time: "16:00",
  ema: [
    { period: 9, timeframe: "1m" },
    { period: 20, timeframe: "1m" },
    { period: 200, timeframe: "1m" },
  ],
  rsi: { period: 14, timeframe: "1m" },
});
console.log(
  JSON.stringify(
    {
      candleComparisons,
      emaComparisons,
      screenAgreement,
      largestResponseBytes: Math.max(...Object.values(sizes)),
      fullChartMs: Math.round(performance.now() - timing),
      totalMs: Math.round(performance.now() - started),
      checks:
        "raw OHLCV for every interval, 10m/5m/1h boundaries, regular-session daily, gaps, warmup, projection, no lookahead, JSON safety, limits, minute-only cache, access control",
    },
    null,
    2,
  ),
);
