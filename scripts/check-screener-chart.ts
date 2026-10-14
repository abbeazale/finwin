import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import {
  chartInputSchema,
  chartTimeframes,
  type ChartInput,
  type ChartTimeframe,
} from "../src/lib/screener-chart";
import { replaySymbols, type ReplaySymbol } from "../src/lib/screener-replay";
import { loadReplayBars } from "../src/server/screener/market-data";
import { buildChart, type ChartResult } from "../src/server/screener/chart";
import { evaluateReplay } from "../src/server/screener/replay";
import { screenerRouter } from "../src/server/trpc/routers/screener";
import { startMarketData } from "./market-data-fixture";

const started = performance.now();
const server = await startMarketData();
try {
  const SESSION = "2026-10-09";
  const bars = await loadReplayBars(SESSION, true);
  const base: ChartInput = {
    symbol: "NVDA",
    session: SESSION,
    time: "10:30",
    timeframe: "1m",
    ema: [],
  };

  // Independent aggregation straight from the raw Massive archive: floats, New
  // York wall-clock keys from Intl, SPY's traded days and its own early-close
  // list, not the app's calendar or candle module.
  type Raw = { o: number; h: number; l: number; c: number; v: number };
  const wallClock = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  function newYork(ms: number) {
    const parts = Object.fromEntries(
      wallClock.formatToParts(new Date(ms)).map((part) => [part.type, part.value]),
    );
    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      minute: Number(parts.hour) * 60 + Number(parts.minute),
    };
  }
  async function archive(kind: string) {
    const directory = path.join(".local/market-data/raw", kind);
    const records = await Promise.all(
      (await readdir(directory)).map(async (name) =>
        JSON.parse(gunzipSync(await readFile(path.join(directory, name))).toString()),
      ),
    );
    return records.sort((a, b) => a.fetchedAt.localeCompare(b.fetchedAt)) as {
      url: string;
      body: { results?: ({ t: number } & Raw)[] };
    }[];
  }
  const raw = new Map<string, Raw & { t: number }>();
  for (const record of await archive("minute")) {
    const symbol = record.url.split("/ticker/")[1].split("/")[0];
    for (const row of record.body.results ?? []) {
      const { date, minute } = newYork(row.t);
      raw.set(`${symbol}|${date}|${minute - 570}`, row);
    }
  }
  const rawDaily = new Map<string, Raw>();
  const traded = new Set<string>();
  for (const record of await archive("day")) {
    const symbol = record.url.split("/ticker/")[1].split("/")[0];
    for (const row of record.body.results ?? []) {
      const { date } = newYork(row.t);
      rawDaily.set(`${symbol}|${date}`, row);
      if (symbol === "SPY") traded.add(date);
    }
  }
  const sessions = [...traded].sort();
  const early = new Set([
    "2024-11-29",
    "2024-12-24",
    "2025-07-03",
    "2025-11-28",
    "2025-12-24",
  ]);
  const length = (date: string) => (early.has(date) ? 210 : 390);
  const openOf = (date: string) => {
    // 09:30 New York, from the raw timestamp of the first stored SPY minute.
    const first = raw.get(`SPY|${date}|0`);
    assert.ok(first, `SPY 09:30 bar on ${date}`);
    return first.t;
  };
  const windowOf = (session: string) => {
    const index = sessions.indexOf(session);
    return sessions.slice(Math.max(0, index - 60), index + 1);
  };
  const widths: Record<Exclude<ChartTimeframe, "1d">, number> = {
    "1m": 1,
    "5m": 5,
    "10m": 10,
    "15m": 15,
    "30m": 30,
    "1h": 60,
  };
  function bucket(symbol: ReplaySymbol, date: string, first: number, count: number) {
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
  function expectedCandles(
    symbol: ReplaySymbol,
    timeframe: ChartTimeframe,
    session: string,
    time: string,
  ) {
    const out: { start: number; end: number; bar: Raw | null }[] = [];
    if (timeframe === "1d") {
      const index = sessions.indexOf(session);
      for (const date of sessions.slice(Math.max(0, index - 300), index))
        out.push({
          start: openOf(date),
          end: openOf(date) + length(date) * 60_000,
          bar: rawDaily.get(`${symbol}|${date}`) ?? null,
        });
      return out;
    }
    const at =
      openOf(session) +
      (Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) - 570) * 60_000;
    const width = widths[timeframe];
    for (const date of windowOf(session))
      for (let first = 0; first < length(date); first += width) {
        const count = Math.min(width, length(date) - first);
        const start = openOf(date) + first * 60_000;
        const end = start + count * 60_000;
        if (end > at) return out;
        out.push({ start, end, bar: bucket(symbol, date, first, count) });
      }
    return out;
  }
  function near(a: number, b: number, label: string, tolerance = 1e-9) {
    assert.ok(Math.abs(a - b) < tolerance, `${label}: ${a} vs ${b}`);
  }

  let candleComparisons = 0;
  const sizes: number[] = [];
  const clocks = [
    [SESSION, "10:30"],
    [SESSION, "16:00"],
    ["2026-01-15", "14:00"],
    ["2025-11-28", "13:00"],
  ] as const;
  for (const [session, time] of clocks) {
    const sessionBars =
      session === SESSION ? bars : await loadReplayBars(session, true);
    for (const symbol of replaySymbols)
      for (const timeframe of chartTimeframes) {
        const result = buildChart(sessionBars, {
          ...base,
          symbol,
          session,
          time,
          timeframe,
        });
        const expected = expectedCandles(symbol, timeframe, session, time);
        const window = windowOf(session);
        const shown =
          timeframe === "1d"
            ? expected.slice(-250)
            : expected.filter(
                (slot) => slot.start >= openOf(window[Math.max(0, window.length - 5)]),
              );
        const label = `${symbol} ${timeframe} ${session} ${time}`;
        assert.equal(result.candles.length, shown.length, label);
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
          near(candle.open, want.bar.o, `${label} open`);
          near(candle.high, want.bar.h, `${label} high`);
          near(candle.low, want.bar.l, `${label} low`);
          near(candle.close, want.bar.c, `${label} close`);
          assert.ok(candle.volume !== null);
          near(candle.volume, want.bar.v, `${label} volume`, 1e-3);
          candleComparisons++;
        });
        sizes.push(JSON.stringify(result).length);
      }
  }

  // Boundaries: 10m at 09:39/09:40, 5m at 10:34/10:35, the 1h closing bucket,
  // and the 13:00 close on an early-close day.
  const today = (result: ChartResult) =>
    result.candles.filter((candle) => candle.start >= openOf(result.session));
  const at = (time: string, timeframe: ChartTimeframe) =>
    buildChart(bars, { ...base, time, timeframe });
  assert.equal(today(at("09:39", "10m")).length, 0);
  assert.equal(today(at("09:40", "10m")).length, 1);
  assert.equal(today(at("10:34", "5m")).at(-1)?.end, Date.parse("2026-10-09T14:30:00Z"));
  assert.equal(today(at("10:35", "5m")).at(-1)?.end, Date.parse("2026-10-09T14:35:00Z"));
  assert.equal(today(at("15:59", "1h")).length, 6);
  const closing = today(at("16:00", "1h")).at(-1);
  assert.ok(closing && closing.end - closing.start === 30 * 60_000);
  const earlyBars = await loadReplayBars("2025-11-28", true);
  const earlyClose = buildChart(earlyBars, {
    ...base,
    session: "2025-11-28",
    time: "13:00",
    timeframe: "1h",
  });
  assert.equal(today(earlyClose).length, 4);
  assert.equal(today(earlyClose).at(-1)?.end, Date.parse("2025-11-28T18:00:00Z"));
  // Daily candles never include the replay session, even at the close.
  assert.ok(at("16:00", "1d").candles.every((candle) => candle.start < openOf(SESSION)));

  // The chart EMA/RSI at the cutoff equals the screen's value for the same
  // symbol, interval, period and window.
  let screenAgreement = 0;
  for (const symbol of replaySymbols)
    for (const timeframe of ["1m", "5m", "1d"] as const)
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
        if (ema.latest?.state !== "available" || rsi.latest?.state !== "available")
          throw new Error(`${symbol} ${timeframe} ${period} not available`);
        assert.equal(ema.latest.value, screen.ema?.value);
        assert.equal(new Date(ema.latest.end).toISOString(), screen.ema?.candleEnd);
        assert.equal(rsi.latest.value, screen.rsi?.value);
        assert.equal(new Date(ema.latest.seedStart).toISOString(), screen.ema?.seedStart);
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
    for (const period of [9, 20, 200]) {
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
          if (point.state === "available") near(point.value, want, `${timeframe} EMA ${period}`, 1e-6);
          emaComparisons++;
        }
      });
    }

  // Two years of daily bars warm up the daily EMA 200, and a 1h EMA 200
  // finishes warmup inside the 60-session window.
  const warm = buildChart(bars, {
    ...base,
    timeframe: "1d",
    ema: [{ period: 200, timeframe: "1d" }],
  });
  assert.equal(warm.indicators[0].latest?.state, "available");
  const hourly = buildChart(bars, {
    ...base,
    timeframe: "1h",
    ema: [{ period: 200, timeframe: "1h" }],
  });
  assert.equal(hourly.indicators[0].latest?.state, "available");

  // Projection: a 1m EMA 9 on a 10m chart holds the latest native state at
  // each displayed completion.
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
  projected.candles.forEach((candle, index) =>
    assert.deepEqual(projected.indicators[0].points[index], byEnd.get(candle.end)),
  );

  // No lookahead: removing every minute after the cutoff changes nothing.
  const cutoff = Date.parse("2026-10-09T14:30:00Z");
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

  // Gaps: remove one minute. The EMA restarts after it and needs nine closes.
  const gapMinute = Date.parse("2026-10-09T17:43:00Z");
  const gapped = {
    ...bars,
    minutes: new Map(
      replaySymbols.map((symbol) => [
        symbol,
        new Map(
          [...(bars.minutes.get(symbol) ?? [])].filter(
            ([start]) => symbol !== "IWM" || start !== gapMinute,
          ),
        ),
      ]),
    ),
  };
  const gap = buildChart(gapped, {
    ...base,
    symbol: "IWM",
    time: "14:00",
    ema: [{ period: 9, timeframe: "1m" }],
  });
  const missing = gap.candles.findIndex((candle) => candle.status === "missing");
  assert.equal(gap.candles[missing]?.start, gapMinute);
  assert.equal(gap.indicators[0].points[missing].state, "missing");
  assert.ok(
    gap.indicators[0].points
      .slice(missing + 1, missing + 9)
      .every((point) => point.state === "warming"),
  );
  const resumed = gap.indicators[0].points[missing + 9];
  const before = gap.indicators[0].points[missing - 1];
  assert.ok(resumed.state === "available" && before.state === "available");
  assert.notEqual(resumed.run, before.run);

  // JSON safety: no BigInt, NaN or Infinity in any response.
  const json = JSON.stringify(projected);
  assert.deepEqual(JSON.parse(json), projected);
  assert.ok(!/NaN|Infinity/.test(json));

  for (const invalid of [
    { timeframe: "2m" },
    { symbol: "TSLA" },
    { time: "16:01" },
    { session: "2026-09-07" },
    { session: "2025-11-28", time: "13:01" },
    { ema: [{ period: 0, timeframe: "1m" }] },
    { ema: [{ period: 201, timeframe: "1m" }] },
    { ema: [9, 9].map((period) => ({ period, timeframe: "1m" })) },
    { ema: [9, 20, 50, 200].map((period) => ({ period, timeframe: "1m" })) },
    { rsi: { period: 1, timeframe: "1m" } },
    { ema: [], extra: true },
  ])
    assert.equal(
      chartInputSchema.safeParse({ ...base, ...invalid }).success,
      false,
      JSON.stringify(invalid),
    );

  // Access control through the real tRPC boundary.
  const context = {
    userId: "chart-check-user",
    sessionCreatedAt: new Date(),
    correlationId: "chart-check",
  };
  assert.deepEqual(await screenerRouter.createCaller(context).chart(base), buildChart(bars, base));
  await assert.rejects(
    screenerRouter.createCaller({ ...context, userId: null }).chart(base),
    { code: "UNAUTHORIZED" },
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
        largestResponseBytes: Math.max(...sizes),
        fullChartMs: Math.round(performance.now() - timing),
        totalMs: Math.round(performance.now() - started),
        checks:
          "raw OHLCV for every interval, DST, early close, boundaries, daily bars, warmup, projection, no lookahead, gaps, JSON safety, limits, access control",
      },
      null,
      2,
    ),
  );
} finally {
  server.stop();
}
