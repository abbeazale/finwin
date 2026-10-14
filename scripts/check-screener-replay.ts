import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { z } from "zod";
import {
  isSession,
  sessionsBetween,
  sessionClose,
} from "../src/lib/market-calendar";
import {
  nextReplayMinute,
  replayInputSchema,
  replaySymbols,
  type ReplayInput,
} from "../src/lib/screener-replay";
import { loadReplayBars } from "../src/server/screener/market-data";
import { evaluateReplay } from "../src/server/screener/replay";
import { calculateRsi } from "../src/server/screener/indicators";
import { screenerRouter } from "../src/server/trpc/routers/screener";
import { startMarketData } from "./market-data-fixture";

const server = await startMarketData();
const { origin, token } = server;

try {
  // The API rejects missing or wrong tokens and unknown symbols.
  assert.equal((await fetch(`${origin}/v1/coverage`)).status, 401);
  assert.equal(
    (
      await fetch(`${origin}/v1/coverage`, {
        headers: { Authorization: `Bearer ${token.slice(1)}x` },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await fetch(`${origin}/v1/minutes?symbols=TSLA&from=2026-10-09&to=2026-10-09`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).status,
    400,
  );

  const oracleSchema = z.object({
    sessions: z.tuple([z.string(), z.string()]),
    cases: z.array(
      z.object({
        symbol: z.enum(replaySymbols),
        session: z.string(),
        time: z.string(),
        timeframe: z.enum(["1m", "5m", "1d"]),
        rsi: z.number().nullable(),
        volume: z.number().nullable(),
        dailyEma200: z.number().nullable(),
        dailyChange: z.number().nullable(),
      }),
    ),
    emas: z.array(
      z.object({
        symbol: z.enum(replaySymbols),
        session: z.string(),
        time: z.string(),
        timeframe: z.enum(["1m", "5m", "1d"]),
        period: z.number(),
        value: z.number().nullable(),
      }),
    ),
  });
  const oracle = oracleSchema.parse(
    JSON.parse(
      execFileSync("python3", ["scripts/screener-indicator-oracle.py"], {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      }),
    ),
  );

  // The app calendar matches the sessions SPY actually traded.
  const [first, last] = oracle.sessions;
  const spySessions = new Set(
    (
      (await (
        await fetch(
          `${origin}/v1/daily?symbols=SPY&from=${sessionsBetween(first, last).at(-300) ?? first}&to=${last}`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
      ).json()) as { symbols: { SPY: [string][] } }
    ).symbols.SPY.map(([date]) => date),
  );
  for (const date of sessionsBetween(
    sessionsBetween(first, last).at(-300) ?? first,
    last,
  ))
    assert.ok(spySessions.has(date), `SPY has no bar on calendar session ${date}`);
  assert.equal(spySessions.size, Math.min(300, sessionsBetween(first, last).length));

  const ema = { timeframe: "1m", period: 20, comparison: "above" } as const;
  let comparisons = 0;
  for (const expected of oracle.emas) {
    const bars = await loadReplayBars(expected.session, true);
    const result = evaluateReplay(bars, {
      session: expected.session,
      time: expected.time,
      ema: { ...ema, timeframe: expected.timeframe, period: expected.period },
    });
    const row = result.rows.find((row) => row.symbol === expected.symbol);
    const label = `${expected.symbol} ${expected.session} ${expected.time} ${expected.timeframe} EMA ${expected.period}`;
    assert.ok(row, label);
    if (expected.value === null) {
      assert.equal(row.status, "excluded", label);
      continue;
    }
    if (row.status === "excluded") throw new Error(`${label}: ${row.reason}`);
    assert.ok(row.ema, label);
    assert.ok(Math.abs(row.ema.value - expected.value) < 1e-9, label);
    assert.ok(Date.parse(row.ema.candleEnd) <= Date.parse(result.asOf));
    assert.equal(
      row.status === "match",
      row.price > row.ema.value,
      `${label} strict comparison`,
    );
    comparisons++;
  }

  for (const expected of oracle.cases) {
    const label = `${expected.symbol} ${expected.session} ${expected.time} ${expected.timeframe}`;
    const bars = await loadReplayBars(expected.session, true);
    const base: ReplayInput = {
      session: expected.session,
      time: expected.time,
    };
    const row = (input: ReplayInput) =>
      evaluateReplay(bars, input).rows.find(
        (row) => row.symbol === expected.symbol,
      );
    const daily = row({ ...base, ema: { ...ema, timeframe: "1d", period: 200 } });
    if (expected.dailyEma200 === null) assert.equal(daily?.status, "excluded");
    else {
      assert.ok(daily && daily.status !== "excluded" && daily.ema, label);
      assert.ok(Math.abs(daily.ema.value - expected.dailyEma200) < 1e-9, label);
    }
    const withRsi = row({
      ...base,
      rsi: {
        timeframe: expected.timeframe,
        period: 14,
        comparison: "above",
        threshold: 0,
      },
    });
    if (expected.rsi === null) assert.equal(withRsi?.status, "excluded", label);
    else {
      assert.ok(withRsi && withRsi.status !== "excluded" && withRsi.rsi, label);
      assert.ok(Math.abs(withRsi.rsi.value - expected.rsi) < 1e-9, `${label} RSI`);
    }
    const volume = row({ ...base, relativeVolume: { minimum: 1 } });
    if (expected.volume === null) assert.equal(volume?.status, "excluded", label);
    else {
      assert.ok(volume && volume.status !== "excluded" && volume.relativeVolume);
      assert.ok(
        Math.abs(volume.relativeVolume.value - expected.volume) < 1e-12,
        `${label} relative volume`,
      );
      assert.equal(
        volume.status === "match",
        volume.relativeVolume.value >= 1,
      );
    }
    const change = row({ ...base, dailyChange: { minimum: 0 } });
    if (expected.dailyChange === null) assert.equal(change?.status, "excluded");
    else {
      assert.ok(change && change.status !== "excluded" && change.dailyChange);
      assert.ok(
        Math.abs(change.dailyChange.value - expected.dailyChange) < 1e-9,
        `${label} daily change`,
      );
    }
  }

  const input: ReplayInput = { session: "2026-10-09", time: "10:30", ema };
  const bars = await loadReplayBars(input.session, true);
  const result = evaluateReplay(bars, input);
  assert.deepEqual(evaluateReplay(bars, input), result, "Deterministic");

  // Future and forming candles must not affect matches.
  const at = Date.parse(result.asOf);
  const mixed: ReplayInput = {
    ...input,
    ema: { ...ema, timeframe: "1d", period: 200 },
    rsi: { timeframe: "5m", period: 14, comparison: "above", threshold: 40 },
    relativeVolume: { minimum: 0.5 },
    dailyChange: { minimum: -5 },
  };
  const pastOnly = {
    ...bars,
    minutes: new Map(
      replaySymbols.map((symbol) => [
        symbol,
        new Map(
          [...(bars.minutes.get(symbol) ?? [])].filter(
            ([start]) => start + 60_000 <= at,
          ),
        ),
      ]),
    ),
    daily: new Map(
      replaySymbols.map((symbol) => [
        symbol,
        new Map(
          [...(bars.daily.get(symbol) ?? [])].filter(
            ([date]) => date < input.session,
          ),
        ),
      ]),
    ),
  };
  assert.deepEqual(evaluateReplay(pastOnly, mixed), evaluateReplay(bars, mixed));

  // Five-minute candles complete at their end; 09:31 sees the prior close.
  for (const time of ["10:34", "10:35"] as const)
    for (const row of evaluateReplay(bars, {
      ...input,
      time,
      ema: { ...ema, timeframe: "5m" },
    }).rows) {
      if (row.status === "excluded") throw new Error(row.reason);
      assert.equal(
        row.ema?.candleEnd,
        `2026-10-09T14:${time === "10:34" ? "30" : "35"}:00.000Z`,
      );
    }
  for (const row of evaluateReplay(bars, {
    ...input,
    time: "09:31",
    ema: { ...ema, timeframe: "5m" },
  }).rows) {
    if (row.status === "excluded") throw new Error(row.reason);
    assert.equal(row.ema?.candleEnd, "2026-10-08T20:00:00.000Z");
  }

  // Winter time uses -05:00, and an early close ends at 13:00.
  const winter = await loadReplayBars("2026-01-15", false);
  for (const row of evaluateReplay(winter, {
    session: "2026-01-15",
    time: "10:35",
    ema: { ...ema, timeframe: "5m" },
  }).rows) {
    if (row.status === "excluded") throw new Error(row.reason);
    assert.equal(row.ema?.candleEnd, "2026-01-15T15:35:00.000Z");
  }
  assert.equal(nextReplayMinute("2025-11-28", "13:00"), null);
  assert.equal(nextReplayMinute("2025-11-28", "12:59"), "13:00");
  assert.equal(sessionClose("2025-11-28"), Date.parse("2025-11-28T18:00:00Z"));
  assert.equal(sessionClose("2026-03-06"), Date.parse("2026-03-06T21:00:00Z"));
  assert.equal(sessionClose("2026-03-09"), Date.parse("2026-03-09T20:00:00Z"));
  const afterEarly = await loadReplayBars("2025-12-01", false);
  const earlyDay = evaluateReplay(afterEarly, {
    session: "2025-12-01",
    time: "14:00",
    relativeVolume: { minimum: 0 },
  });
  // The 20 prior sessions include the 13:00 close on 2025-11-28.
  assert.equal(earlyDay.excludedCount, 5);

  for (const comparison of ["above", "below"] as const)
    assert.equal(
      evaluateReplay(bars, {
        ...input,
        ema: { ...ema, period: 1, comparison },
      }).matchCount,
      0,
      "Price equals EMA 1, so neither direction matches",
    );
  for (const changes of [
    { session: "2026-09-07" },
    { session: "2026-10-10" },
    { session: "2025-11-28", time: "13:01" },
    { time: "09:30" },
    { time: "16:01" },
    { ema: { ...ema, period: 0 } },
    { ema: { ...ema, period: 201 } },
    { rsi: { timeframe: "1d", period: 1, comparison: "above", threshold: 50 } },
    { relativeVolume: { minimum: 1.0001 } },
  ])
    assert.equal(
      replayInputSchema.safeParse({ ...input, ...changes }).success,
      false,
      JSON.stringify(changes),
    );
  assert.ok(isSession("2025-11-28") && !isSession("2025-01-09"));

  const priceUnits = (values: number[]) =>
    values.map((value) => BigInt(Math.round(value * 1e9)));
  assert.equal(calculateRsi(priceUnits([1, 2, 3, 4]), 2)?.value, 100);
  assert.equal(calculateRsi(priceUnits([4, 3, 2, 1]), 2)?.value, 0);
  assert.equal(calculateRsi(priceUnits([3, 3, 3, 3]), 2)?.value, 50);

  const zeroVolume = {
    ...bars,
    minutes: new Map(
      replaySymbols.map((symbol) => [
        symbol,
        new Map(
          [...(bars.minutes.get(symbol) ?? [])].map(([start, bar]) => [
            start,
            { ...bar, volume: BigInt(0) },
          ]),
        ),
      ]),
    ),
  };
  assert.equal(
    evaluateReplay(zeroVolume, { ...input, relativeVolume: { minimum: 0 } })
      .excludedCount,
    5,
  );

  // The tRPC boundary: signed-in callers get the same result; sessions outside
  // stored history are rejected with a clear message.
  const context = {
    userId: "replay-check-user",
    sessionCreatedAt: new Date(),
    correlationId: "replay-check",
  };
  const caller = screenerRouter.createCaller(context);
  assert.deepEqual(await caller.replay(input), result);
  assert.deepEqual(await caller.replay(mixed), evaluateReplay(bars, mixed));
  await assert.rejects(caller.replay({ ...input, session: "2027-06-01" }), {
    code: "BAD_REQUEST",
  });
  await assert.rejects(
    screenerRouter.createCaller({ ...context, userId: null }).replay(input),
    { code: "UNAUTHORIZED" },
  );
  const capabilities = await caller.capabilities();
  assert.equal(capabilities.sessions?.through, last);

  console.log(
    JSON.stringify(
      {
        emaComparisons: comparisons,
        indicatorOracleCases: oracle.cases.length,
        sessions: oracle.sessions,
        checks:
          "API auth, calendar vs SPY, determinism, no lookahead, candle boundaries, DST, early close, equality, validation, access control",
      },
      null,
      2,
    ),
  );
} finally {
  server.stop();
}
