import { expect, test } from "bun:test";
import {
  nextReplayMinute,
  parseReplayForm,
  replayInputSchema,
} from "./screener-replay";

// The persistent screen shape is the replay input without its run context.
const screenFilterSchema = {
  safeParse: (filter: object) =>
    replayInputSchema.safeParse({ session: "2026-09-15", time: "10:30", ...filter }),
};

function formData(entries: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) form.set(key, value);
  return form;
}

const baseFields = {
  session: "2026-09-15",
  time: "10:30",
  emaTimeframe: "1m",
  emaComparison: "above",
  emaPeriod: "20",
  emaEnabled: "on",
  rsiEnabled: "off",
  rsiComparison: "above",
  rsiThreshold: "50",
  rsiPeriod: "14",
  rsiTimeframe: "1m",
  volumeEnabled: "off",
  volumeMinimum: "1",
};

test("screen filter holds the persistent shape without run context", () => {
  const filter = {
    ema: { timeframe: "1m", period: 20, comparison: "above" },
  } as const;
  expect(screenFilterSchema.safeParse(filter).success).toBe(true);
  expect(
    replayInputSchema.safeParse({
      ...filter,
      session: "2026-09-15",
      time: "10:30",
    }).success,
  ).toBe(true);
  expect(replayInputSchema.safeParse(filter).success).toBe(false);
});

test("parseReplayForm accepts a valid screen and reports the first error", () => {
  const parsed = parseReplayForm(formData(baseFields));
  expect(parsed.success).toBe(true);
  if (parsed.success)
    expect(parsed.data).toMatchObject({
      session: "2026-09-15",
      time: "10:30",
      ema: { period: 20 },
    });

  const invalid = parseReplayForm(formData({ ...baseFields, emaPeriod: "0" }));
  expect(invalid.success).toBe(false);
});

test("parseReplayForm maps optional RSI and relative-volume toggles", () => {
  const withOptionals = parseReplayForm(
    formData({
      ...baseFields,
      rsiEnabled: "on",
      rsiComparison: "above",
      rsiThreshold: "70",
      rsiPeriod: "14",
      rsiTimeframe: "5m",
      volumeEnabled: "on",
      volumeMinimum: "1.5",
    }),
  );
  expect(withOptionals.success).toBe(true);
  if (withOptionals.success) {
    expect(withOptionals.data.rsi).toMatchObject({
      comparison: "above",
      threshold: 70,
    });
    expect(withOptionals.data.relativeVolume).toMatchObject({ minimum: 1.5 });
  }

  const withoutOptionals = parseReplayForm(formData(baseFields));
  expect(withoutOptionals.success).toBe(true);
  if (withoutOptionals.success) {
    expect(withoutOptionals.data.rsi).toBeUndefined();
    expect(withoutOptionals.data.relativeVolume).toBeUndefined();
  }
});

test("nextReplayMinute advances one minute and stops at the close", () => {
  expect(nextReplayMinute("2026-09-15", "10:30")).toBe("10:31");
  expect(nextReplayMinute("2026-09-15", "09:31")).toBe("09:32");
  expect(nextReplayMinute("2026-09-15", "16:00")).toBeNull();
});
