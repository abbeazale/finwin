import { z } from "zod";
import { replayInputSchema, replaySymbols } from "./screener-replay";

export const chartTimeframes = [
  "1m",
  "5m",
  "10m",
  "15m",
  "30m",
  "1h",
  "1d",
] as const;
export type ChartTimeframe = (typeof chartTimeframes)[number];

export const chartTimeframeLabels: Record<ChartTimeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "10m": "10m",
  "15m": "15m",
  "30m": "30m",
  "1h": "1h",
  "1d": "Daily",
};

// Candle width in minutes. Daily candles cover the whole regular session.
export const intradayMinutes = {
  "1m": 1,
  "5m": 5,
  "10m": 10,
  "15m": 15,
  "30m": 30,
  "1h": 60,
} as const;

export const MAX_CHART_LINES = 3;

const timeframe = z.enum(chartTimeframes);

// Chart settings are independent of the screen filters. Each indicator names a
// concrete timeframe; the UI resolves "Chart interval" before the request.
export const chartInputSchema = z.strictObject({
  symbol: z.enum(replaySymbols),
  session: replayInputSchema.shape.session,
  time: replayInputSchema.shape.time,
  timeframe,
  ema: z
    .array(
      z.strictObject({
        period: z.number().int().min(1).max(200),
        timeframe,
      }),
    )
    .max(MAX_CHART_LINES)
    .refine(
      (lines) =>
        new Set(lines.map((line) => `${line.period}:${line.timeframe}`))
          .size === lines.length,
      "Each EMA line needs a different period or interval.",
    ),
  rsi: z
    .strictObject({ period: z.number().int().min(2).max(200), timeframe })
    .optional(),
});
export type ChartInput = z.infer<typeof chartInputSchema>;
