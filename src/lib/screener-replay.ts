import { z } from "zod";

export const replaySymbols = ["AAPL", "MSFT", "NVDA", "SPY", "IWM"] as const;
export type ReplaySymbol = (typeof replaySymbols)[number];

// Bounded sample calendar, not a general exchange calendar. No early closes in
// this interval; September 7 is Labor Day. All dates are in daylight time.
export const replaySessions: string[] = [];
for (
  let day = Date.parse("2026-08-03T00:00:00Z");
  day < Date.parse("2026-09-16T00:00:00Z");
  day += 86_400_000
) {
  const date = new Date(day);
  const key = date.toISOString().slice(0, 10);
  if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6 && key !== "2026-09-07")
    replaySessions.push(key);
}

const screenFilterSchema = z.strictObject({
  ema: z
    .object({
      timeframe: z.enum(["1m", "5m", "1d"]),
      period: z.number().int().min(1).max(200),
      comparison: z.enum(["above", "below"]),
    })
    .optional(),
  priceRange: z
    .object({
      minimum: z.number().min(0).max(1_000_000).multipleOf(0.01),
      maximum: z.number().positive().max(1_000_000).multipleOf(0.01),
    })
    .refine((value) => value.minimum <= value.maximum, {
      message: "Minimum price must not exceed maximum price.",
      path: ["maximum"],
    })
    .optional(),
  dailyChange: z
    .object({ minimum: z.number().min(-100).max(100_000).multipleOf(0.001) })
    .optional(),
  float: z
    .object({ maximum: z.number().int().positive().max(1_000_000_000_000) })
    .optional(),
  news: z.object({ hours: z.number().int().min(1).max(168) }).optional(),
  rsi: z
    .object({
      timeframe: z.enum(["1m", "5m", "1d"]),
      period: z.number().int().min(2).max(200),
      comparison: z.enum(["above", "below"]),
      threshold: z.number().min(0).max(100),
    })
    .optional(),
  relativeVolume: z
    .object({ minimum: z.number().min(0).max(1000).multipleOf(0.001) })
    .optional(),
});
export type ScreenFilter = z.infer<typeof screenFilterSchema>;

export const replayInputSchema = screenFilterSchema.extend({
  session: z
    .string()
    .refine(
      (value) => replaySessions.includes(value),
      "Choose a session in the cached sample.",
    ),
  time: z
    .string()
    .regex(
      /^(09:(3[1-9]|[45]\d)|1[0-5]:[0-5]\d|16:00)$/,
      "Choose 09:31 through 16:00 New York time.",
    ),
});
export type ReplayInput = z.infer<typeof replayInputSchema>;

const replayClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// Next whole minute after the given replay session/time, or null at 16:00.
// All replay sessions are EDT, so the fixed -04:00 offset matches the contract.
export function nextReplayMinute(session: string, time: string): string | null {
  if (time === "16:00") return null;
  const next = new Date(`${session}T${time}:00-04:00`);
  next.setTime(next.getTime() + 60_000);
  return replayClock.format(next);
}

function formNumber(value: FormDataEntryValue | null): number {
  return value === null || value === "" ? Number.NaN : Number(value);
}

// Parse the replay form's FormData into a validated ReplayInput. Kept in the
// shared lib so the page stays thin and saved screens can reuse the filter
// shape without copying field names.
export function parseReplayForm(
  fields: FormData,
): { success: true; data: ReplayInput } | { success: false; error: string } {
  const result = replayInputSchema.safeParse({
    session: fields.get("session"),
    time: fields.get("time"),
    ema:
      fields.get("emaEnabled") !== "on"
        ? undefined
        : {
            timeframe: fields.get("emaTimeframe"),
            comparison: fields.get("emaComparison"),
            period: formNumber(fields.get("emaPeriod")),
          },
    priceRange:
      fields.get("priceEnabled") === "on"
        ? {
            minimum: formNumber(fields.get("priceMinimum")),
            maximum: formNumber(fields.get("priceMaximum")),
          }
        : undefined,
    dailyChange:
      fields.get("changeEnabled") === "on"
        ? {
            minimum: formNumber(fields.get("changeMinimum")),
          }
        : undefined,
    float:
      fields.get("floatEnabled") === "on"
        ? {
            maximum: formNumber(fields.get("floatMaximum")) * 1_000_000,
          }
        : undefined,
    news:
      fields.get("newsEnabled") === "on"
        ? {
            hours: formNumber(fields.get("newsHours")),
          }
        : undefined,
    rsi:
      fields.get("rsiEnabled") !== "on"
        ? undefined
        : {
            timeframe: fields.get("rsiTimeframe"),
            period: formNumber(fields.get("rsiPeriod")),
            comparison: fields.get("rsiComparison"),
            threshold: formNumber(fields.get("rsiThreshold")),
          },
    relativeVolume:
      fields.get("volumeEnabled") === "on"
        ? { minimum: formNumber(fields.get("volumeMinimum")) }
        : undefined,
  });
  if (!result.success)
    return { success: false, error: result.error.issues[0].message };
  return { success: true, data: result.data };
}
