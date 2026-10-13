import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { z } from "zod";
import { dailySessions } from "../src/server/screener/calendar";
import { mkdtemp, mkdir, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  replayInputSchema,
  replaySymbols,
  type ReplayInput,
} from "../src/lib/screener-replay";
import { loadReplayBars } from "../src/server/screener/cache";
import { evaluateReplay } from "../src/server/screener/replay";
import { calculateRsi } from "../src/server/screener/indicators";
import { screenerRouter } from "../src/server/trpc/routers/screener";

const bars = await loadReplayBars();
const ema = { timeframe: "1m", period: 20, comparison: "above" } as const;
const input: ReplayInput = {
  session: "2026-09-15",
  time: "10:30",
  ema,
};
const first = evaluateReplay(bars, input);
assert.deepEqual(evaluateReplay(bars, input), first);

// A separately implemented Python/Decimal oracle reads the original JSONL.
const oracleSchema = z.object({
  cases: z.array(
    z.object({
      symbol: z.enum(replaySymbols),
      session: z.string(),
      time: z.string(),
      timeframe: z.enum(["1m", "5m", "1d"]),
      rsi: z.number().nullable(),
      volume: z.number().nullable(),
      dailyEma200: z.number(),
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
const oracleOutput = oracleSchema.parse(
  JSON.parse(
    execFileSync("python3", ["scripts/screener-indicator-oracle.py"], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    }),
  ),
);
const oracle = oracleOutput.cases;
let comparisons = 0;
for (const expected of oracleOutput.emas) {
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
  assert.ok(row.ema.seedStart <= row.ema.candleEnd);
  assert.equal(
    row.status === "match",
    row.price > row.ema.value,
    `${label} strict comparison`,
  );
  comparisons++;
}

const at = Date.parse(first.asOf);
const onlyPast = {
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
};
assert.deepEqual(
  evaluateReplay(onlyPast, input),
  first,
  "Future and forming candles must not affect matches",
);
for (const time of ["10:34", "10:35"] as const) {
  const result = evaluateReplay(bars, {
    ...input,
    time,
    ema: { ...ema, timeframe: "5m" },
  });
  for (const row of result.rows) {
    if (row.status === "excluded") throw new Error(row.reason);
    assert.equal(
      row.ema?.candleEnd,
      `2026-09-15T14:${time === "10:34" ? "30" : "35"}:00.000Z`,
    );
  }
}
for (const timeframe of ["1m", "5m"] as const) {
  const gap = evaluateReplay(bars, {
    ...input,
    session: "2026-08-18",
    time: "13:45",
    ema: { ...ema, timeframe },
  });
  assert.equal(
    gap.rows.find((row) => row.symbol === "IWM")?.status,
    "excluded",
  );
  assert.equal(gap.excludedCount, 1);
}
const early = evaluateReplay(bars, {
  ...input,
  session: "2026-08-03",
  time: "09:31",
  ema: { ...ema, period: 200 },
});
assert.equal(early.excludedCount, 5);
const opening = evaluateReplay(bars, {
  ...input,
  time: "09:31",
  ema: { ...ema, timeframe: "5m" },
});
for (const row of opening.rows) {
  if (row.status === "excluded") throw new Error(row.reason);
  assert.equal(row.ema?.candleEnd, "2026-09-14T20:00:00.000Z");
}
for (const comparison of ["above", "below"] as const)
  assert.equal(
    evaluateReplay(bars, { ...input, ema: { ...ema, period: 1, comparison } })
      .matchCount,
    0,
  );
for (const changes of [
  { session: "2026-09-07" },
  { session: "2026-09-12" },
  { session: "2026-09-16" },
  { time: "09:30" },
  { time: "16:01" },
  { ema: { ...ema, period: 0 } },
  { ema: { ...ema, period: 201 } },
]) {
  assert.equal(
    replayInputSchema.safeParse({ ...input, ...changes }).success,
    false,
  );
}

for (const expected of oracle) {
  const setup: ReplayInput = {
    ...input,
    session: expected.session,
    time: expected.time,
    ema: { ...ema, timeframe: "1d", period: 200 },
  };
  const dailyRow = evaluateReplay(bars, setup).rows.find(
    (row) => row.symbol === expected.symbol,
  );
  assert.ok(dailyRow && dailyRow.status !== "excluded");
  assert.ok(dailyRow.ema);
  assert.ok(Math.abs(dailyRow.ema.value - expected.dailyEma200) < 1e-9);
  const withRsi = {
    ...setup,
    rsi: {
      timeframe: expected.timeframe,
      period: 14,
      comparison: "above" as const,
      threshold: 0,
    },
  };
  const row = evaluateReplay(bars, withRsi).rows.find(
    (row) => row.symbol === expected.symbol,
  );
  assert.ok(row);
  if (expected.rsi === null) assert.equal(row.status, "excluded");
  else {
    assert.ok(row.status !== "excluded" && row.rsi && row.ema);
    assert.ok(
      Math.abs(row.rsi.value - expected.rsi) < 1e-9,
      `${expected.symbol} ${expected.timeframe} RSI`,
    );
    assert.equal(
      row.status === "match",
      row.price > row.ema.value && row.rsi.value > 0,
    );
  }
  const volumeRow = evaluateReplay(bars, {
    ...setup,
    relativeVolume: { minimum: 1 },
  }).rows.find((row) => row.symbol === expected.symbol);
  assert.ok(volumeRow);
  if (expected.volume === null) assert.equal(volumeRow.status, "excluded");
  else {
    assert.ok(
      volumeRow.status !== "excluded" &&
        volumeRow.relativeVolume &&
        volumeRow.ema,
    );
    assert.ok(
      Math.abs(volumeRow.relativeVolume.value - expected.volume) < 1e-12,
    );
    assert.equal(
      volumeRow.status === "match",
      volumeRow.price > volumeRow.ema.value &&
        volumeRow.relativeVolume.value >= 1,
    );
  }
}
const mixed: ReplayInput = {
  ...input,
  ema: { ...ema, timeframe: "1d", period: 200 },
  rsi: { timeframe: "5m", period: 14, comparison: "above", threshold: 40 },
  relativeVolume: { minimum: 0.5 },
};
const pastOnly = {
  ...onlyPast,
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
assert.deepEqual(
  evaluateReplay(pastOnly, mixed),
  evaluateReplay(bars, mixed),
  "All indicators must be independent of future intraday and daily data",
);
const closeDaily = evaluateReplay(bars, {
  ...input,
  ema: { ...ema, timeframe: "1d" },
  time: "16:00",
});
for (const row of closeDaily.rows) {
  assert.ok(row.status !== "excluded");
  assert.equal(row.ema?.candleEnd, "2026-09-14T20:00:00.000Z");
}
assert.equal(dailySessions.length, 282);
assert.equal(
  dailySessions.find((session) => session.date === "2025-11-28")?.close,
  Date.parse("2025-11-28T18:00:00Z"),
);
assert.equal(
  dailySessions.find((session) => session.date === "2025-12-24")?.close,
  Date.parse("2025-12-24T18:00:00Z"),
);
assert.equal(
  dailySessions.find((session) => session.date === "2026-03-06")?.close,
  Date.parse("2026-03-06T21:00:00Z"),
);
assert.equal(
  dailySessions.find((session) => session.date === "2026-03-09")?.close,
  Date.parse("2026-03-09T20:00:00Z"),
);
const priceUnits = (values: number[]) =>
  values.map((value) => BigInt(Math.round(value * 1e9)));
assert.equal(calculateRsi(priceUnits([1, 2, 3, 4]), 2)?.value, 100);
assert.equal(calculateRsi(priceUnits([4, 3, 2, 1]), 2)?.value, 0);
assert.equal(calculateRsi(priceUnits([3, 3, 3, 3]), 2)?.value, 50);
assert.equal(
  calculateRsi([...priceUnits([1, 2, 3]), undefined, ...priceUnits([4, 5])], 2),
  null,
);
assert.equal(
  calculateRsi(
    [...priceUnits([1, 2, 3]), undefined, ...priceUnits([4, 5, 6])],
    2,
  )?.seedIndex,
  4,
);
assert.equal(
  evaluateReplay(bars, {
    ...input,
    session: "2026-08-28",
    relativeVolume: { minimum: 0 },
  }).excludedCount,
  5,
);
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
for (const invalid of [
  { rsi: { timeframe: "1d", period: 1, comparison: "above", threshold: 50 } },
  { rsi: { timeframe: "1d", period: 14, comparison: "above", threshold: 101 } },
  { relativeVolume: { minimum: -1 } },
  { relativeVolume: { minimum: 1.0001 } },
])
  assert.equal(
    replayInputSchema.safeParse({ ...input, ...invalid }).success,
    false,
  );

// Prove optional daily data does not take down intraday screens. Use an isolated
// cache directory, never rename or modify the user's downloaded files.
const fixture = await mkdtemp(path.join(tmpdir(), "finwin-replay-cache-"));
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
    import { loadReplayBars } from ${JSON.stringify(path.resolve("src/server/screener/cache.ts"))};
    process.chdir(${JSON.stringify(fixture)});
    const data = await loadReplayBars(false);
    assert.equal(data.minutes.size, 5);
    await assert.rejects(loadReplayBars(true));
    console.log("optional-cache-ok");`;
  assert.match(
    execFileSync(process.execPath, ["-e", source], { encoding: "utf8" }),
    /optional-cache-ok/,
  );
} finally {
  await rm(fixture, { recursive: true, force: true });
}

// Exercise the actual tRPC access boundary without a database or HTTP login.
const context = {
  userId: "replay-check-user",
  sessionCreatedAt: new Date(),
  correlationId: "replay-check",
};
assert.deepEqual(
  await screenerRouter.createCaller(context).replay(mixed),
  evaluateReplay(bars, mixed),
);
assert.deepEqual(
  await screenerRouter.createCaller(context).replay(input),
  first,
);
assert.deepEqual(
  await screenerRouter
    .createCaller({ ...context, userId: "another-user" })
    .replay(input),
  first,
);
await assert.rejects(
  screenerRouter.createCaller({ ...context, userId: null }).replay(input),
  { code: "UNAUTHORIZED" },
);
await assert.rejects(
  screenerRouter
    .createCaller(context)
    .replay({ ...input, ema: { ...ema, period: 0 } }),
  { code: "BAD_REQUEST" },
);
console.log(
  JSON.stringify(
    {
      benchmarkComparisons: comparisons,
      indicatorOracleCases: oracle.length,
      checks:
        "determinism, no lookahead, candle boundaries, gaps, insufficient history, equality, calendar, access control",
      sample: first,
    },
    null,
    2,
  ),
);
