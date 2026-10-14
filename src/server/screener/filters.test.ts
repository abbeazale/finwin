import { expect, test } from "bun:test";
import type { Bar } from "./candles";
import { evaluateReplay, type ReplayBars } from "./replay";
import type { ReplayResearch } from "./research";
import {
  replayInputSchema,
  parseReplayForm,
  type ReplayInput,
} from "@/lib/screener-replay";

const input: ReplayInput = { session: "2026-09-15", time: "10:30" };
const at = Date.parse("2026-09-15T14:30:00Z");
const sessions = ["2026-09-14", "2026-09-15"];
const dailySessions = ["2026-09-11", "2026-09-14"];
const day = (close: bigint): Bar => ({
  open: close,
  high: close,
  low: close,
  close,
  volume: BigInt(1),
});
function bars(price: bigint, previous = BigInt(10_000_000_000)): ReplayBars {
  return {
    sessions,
    dailySessions,
    minutes: new Map([
      [
        "AAPL",
        new Map([
          [
            at - 60_000,
            {
              open: price,
              high: price,
              low: price,
              close: price,
              volume: BigInt(1),
            },
          ],
        ]),
      ],
    ]),
    daily: new Map([["AAPL", new Map([["2026-09-14", day(previous)]])]]),
  };
}
function apple(
  data: ReplayBars,
  filters: Partial<ReplayInput> = {},
  research?: ReplayResearch,
) {
  const row = evaluateReplay(
    data,
    { ...input, ...filters },
    research,
  ).rows.find((row) => row.symbol === "AAPL");
  if (!row) throw new Error("Missing AAPL result");
  return row;
}

test("no filters needs only the current price, never EMA warmup or daily history", () => {
  const data = bars(BigInt(11_000_000_000));
  const result = apple({ ...data, daily: new Map() });
  expect(result.status).toBe("match");
  if (result.status !== "excluded") {
    expect(result.ema).toBeNull();
    expect(result.dailyChange).toBeNull();
  }
  expect(evaluateReplay(data, input).activeFilterCount).toBe(0);
  expect(
    apple(data, { ema: { timeframe: "1m", period: 20, comparison: "above" } })
      .status,
  ).toBe("excluded");
});

test("price limits are inclusive and do not round the original price into a match", () => {
  const filter = { priceRange: { minimum: 2, maximum: 20 } };
  for (const price of [BigInt(2_000_000_000), BigInt(20_000_000_000)])
    expect(apple(bars(price), filter).status).toBe("match");
  for (const price of [BigInt(1_999_999_999), BigInt(20_000_000_001)])
    expect(apple(bars(price), filter).status).toBe("no-match");
});

test("daily change compares exactly at +10%, using only the preceding trading session", () => {
  const filter = { dailyChange: { minimum: 10 } };
  expect(apple(bars(BigInt(11_000_000_000)), filter)).toMatchObject({
    status: "match",
    dailyChange: { value: 10, session: "2026-09-14", previousClose: 10 },
  });
  expect(apple(bars(BigInt(10_999_999_999)), filter).status).toBe("no-match");
  expect(
    apple(bars(BigInt(9_000_000_000)), { dailyChange: { minimum: -10 } })
      .status,
  ).toBe("match");
  const data = bars(BigInt(11_000_000_000));
  expect(
    apple(
      {
        ...data,
        daily: new Map([
          [
            "AAPL",
            new Map([
              ["2026-09-11", day(BigInt(1))],
              ["2026-09-15", day(BigInt(1))],
            ]),
          ],
        ]),
      },
      filter,
    ).status,
  ).toBe("excluded");
  expect(apple(bars(BigInt(11_000_000_000), BigInt(0)), filter).status).toBe(
    "excluded",
  );
});

test("every enabled filter must match", () => {
  const result = apple(bars(BigInt(11_000_000_000)), {
    priceRange: { minimum: 2, maximum: 10 },
    dailyChange: { minimum: 20 },
  });
  expect(result).toMatchObject({
    status: "no-match",
    failedConditions: ["Price range", "Daily change"],
  });
});

test("float is strictly below the limit and never uses future publication or effective dates", () => {
  const snapshot = {
    symbol: "AAPL" as const,
    shares: 19_000_000,
    effectiveAt: "2026-09-01T00:00:00Z",
    publishedAt: "2026-09-02T00:00:00Z",
    source: "Test fixture",
  };
  const data = bars(BigInt(11_000_000_000));
  const filter = { float: { maximum: 20_000_000 } };
  expect(apple(data, filter).status).toBe("excluded");
  expect(
    apple(data, filter, { floats: [snapshot], news: new Map() }).status,
  ).toBe("match");
  expect(
    apple(data, filter, {
      floats: [{ ...snapshot, shares: 20_000_000 }],
      news: new Map(),
    }).status,
  ).toBe("no-match");
  for (const field of ["publishedAt", "effectiveAt"] as const)
    expect(
      apple(data, filter, {
        floats: [{ ...snapshot, [field]: "2026-09-16T00:00:00Z" }],
        news: new Map(),
      }).status,
    ).toBe("excluded");
  expect(apple(data, filter)).toMatchObject({
    reason: "No free-float data for this instrument. ETFs have none.",
  });
  expect(
    apple(data, filter, {
      floats: [{ ...snapshot, effectiveAt: "2026-09-16T04:00:00Z" }],
      news: new Map(),
    }),
  ).toMatchObject({
    reason:
      "No free-float value was in effect yet. The earliest saved value applies from 2026-09-16.",
  });
  expect(
    apple(data, { float: { maximum: 1 } }, { floats: [snapshot], news: new Map() }),
  ).toMatchObject({ failedConditions: ["Free float"] });
});

test("news excludes future and expired headlines; missing coverage differs from no headlines", () => {
  const article = {
    headline: "Test headline",
    url: "https://example.com/story",
    source: "Fixture",
    publishedAt: "2026-09-15T14:00:00Z",
  };
  const data = bars(BigInt(11_000_000_000));
  const filter = { news: { hours: 24 } };
  const research = (articles: (typeof article)[]): ReplayResearch => ({
    floats: [],
    news: new Map([
      [
        "AAPL",
        { status: "available", from: at - 86_400_000, through: at, articles },
      ],
    ]),
  });
  expect(apple(data, filter).status).toBe("excluded");
  expect(apple(data, filter, research([])).status).toBe("no-match");
  expect(apple(data, filter, research([article])).status).toBe("match");
  expect(
    apple(
      data,
      filter,
      research([{ ...article, publishedAt: "2026-09-15T14:30:01Z" }]),
    ).status,
  ).toBe("no-match");
  expect(
    apple(
      data,
      filter,
      research([{ ...article, publishedAt: "2026-09-14T14:29:59Z" }]),
    ).status,
  ).toBe("no-match");
  for (const publishedAt of ["2026-09-14T14:30:00Z", "2026-09-15T14:30:00Z"])
    expect(
      apple(data, filter, research([{ ...article, publishedAt }])).status,
    ).toBe("match");
});

test("disabled form fields are ignored even with invalid contents", () => {
  const fields = new FormData();
  for (const [key, value] of Object.entries({
    ...input,
    emaEnabled: "off",
    rsiEnabled: "off",
    priceEnabled: "off",
    changeEnabled: "off",
    volumeEnabled: "off",
    floatEnabled: "off",
    newsEnabled: "off",
    emaPeriod: "garbage",
    emaComparison: "above",
    emaTimeframe: "1d",
    priceMinimum: "bad",
    changeMinimum: "bad",
    floatMaximum: "bad",
    newsHours: "bad",
  }))
    fields.set(key, value);
  const parsed = parseReplayForm(fields);
  expect(parsed.success).toBe(true);
  if (parsed.success)
    expect(evaluateReplay(bars(BigInt(1)), parsed.data).activeFilterCount).toBe(
      0,
    );
  fields.set("floatEnabled", "on");
  fields.set("floatMaximum", "20");
  const withFloat = parseReplayForm(fields);
  expect(withFloat.success).toBe(true);
  if (withFloat.success) expect(withFloat.data.float?.maximum).toBe(20_000_000);
});

test("invalid thresholds and obsolete SMA payloads fail at the API boundary", () => {
  for (const filters of [
    { priceRange: { minimum: 20, maximum: 2 } },
    { priceRange: { minimum: -1, maximum: 20 } },
    { priceRange: { minimum: 2, maximum: 20.001 } },
    { dailyChange: { minimum: -101 } },
    { float: { maximum: 0 } },
    { news: { hours: 0 } },
    { news: { hours: 169 } },
    { timeframe: "1m", period: 20, comparison: "above" },
    { sma: { timeframe: "1m", period: 20, comparison: "above" } },
  ])
    expect(replayInputSchema.safeParse({ ...input, ...filters }).success).toBe(
      false,
    );
});

test("price equal to its EMA matches neither side; one billionth above matches above", () => {
  const price = BigInt(187_123_456_789);
  function flat(latest: bigint): ReplayBars {
    const minutes = new Map<number, Bar>();
    for (let minute = 1; minute <= 20; minute++) {
      const close = minute === 1 ? latest : price;
      minutes.set(at - minute * 60_000, {
        open: close,
        high: close,
        low: close,
        close,
        volume: BigInt(1),
      });
    }
    return {
      sessions,
      dailySessions,
      minutes: new Map([["AAPL", minutes]]),
      daily: new Map(),
    };
  }
  const ema = { timeframe: "1m", period: 20 } as const;
  for (const comparison of ["above", "below"] as const) {
    const row = apple(flat(price), { ema: { ...ema, comparison } });
    expect(row).toMatchObject({
      status: "no-match",
      failedConditions: ["Price/EMA"],
      ema: { value: 187.123456789 },
    });
  }
  expect(
    apple(flat(price + BigInt(1)), { ema: { ...ema, comparison: "above" } })
      .status,
  ).toBe("match");
  expect(
    apple(flat(price), { ema: { ...ema, period: 21, comparison: "above" } }),
  ).toMatchObject({ status: "excluded" });
});
