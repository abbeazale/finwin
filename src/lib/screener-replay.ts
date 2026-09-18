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

export const replayInputSchema = z.object({
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
  timeframe: z.enum(["1m", "5m", "1d"]),
  period: z.number().int().min(1).max(200),
  comparison: z.enum(["above", "below"]),
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
export type ReplayInput = z.infer<typeof replayInputSchema>;
