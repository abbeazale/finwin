import {
  MAX_CHART_LINES,
  type ChartInput,
  type ChartTimeframe,
} from "@/lib/screener-chart";
import type { ReplayInput, ReplaySymbol } from "@/lib/screener-replay";

// "chart" follows the candle interval; a concrete value is a fixed override.
export type LineTimeframe = "chart" | ChartTimeframe;
export type EmaLine = {
  id: "ema9" | "ema20" | "ema200" | "custom";
  period: number;
  timeframe: LineTimeframe;
  on: boolean;
};
export type ChartSettings = {
  timeframe: ChartTimeframe;
  volume: boolean;
  emas: EmaLine[];
  rsi: { on: boolean; period: number; timeframe: LineTimeframe };
};

const presetPeriods = [9, 20, 200] as const;

// Chart settings start from the applied screen once. The chart opens on 1m, so
// a screen indicator on another interval keeps it as a labeled fixed override.
export function initialChartSettings(screen: ReplayInput): ChartSettings {
  const fixed = (timeframe: ChartTimeframe): LineTimeframe =>
    timeframe === "1m" ? "chart" : timeframe;
  const emas: EmaLine[] = [
    ...presetPeriods.map((period) => ({
      id: `ema${period}` as const,
      period,
      timeframe: "chart" as const,
      on: false,
    })),
    { id: "custom", period: 50, timeframe: "chart", on: false },
  ];
  if (screen.ema) {
    const preset = emas.find(
      (line) => line.id !== "custom" && line.period === screen.ema?.period,
    );
    const line = preset ?? emas[3];
    line.period = screen.ema.period;
    line.timeframe = fixed(screen.ema.timeframe);
    line.on = true;
  }
  return {
    timeframe: "1m",
    volume: true,
    emas,
    rsi: screen.rsi
      ? {
          on: true,
          period: screen.rsi.period,
          timeframe: fixed(screen.rsi.timeframe),
        }
      : { on: false, period: 14, timeframe: "chart" },
  };
}

export function resolveTimeframe(
  settings: ChartSettings,
  timeframe: LineTimeframe,
): ChartTimeframe {
  return timeframe === "chart" ? settings.timeframe : timeframe;
}

export const lineKey = (period: number, timeframe: ChartTimeframe) =>
  `${period}:${timeframe}`;

export function activeLines(settings: ChartSettings) {
  return settings.emas.filter((line) => line.on).slice(0, MAX_CHART_LINES);
}

// Two lines can resolve to the same period and interval (custom 20 and EMA 20
// on the chart interval); the request carries each pair once.
export function toChartInput(
  symbol: ReplaySymbol,
  screen: ReplayInput,
  settings: ChartSettings,
): ChartInput {
  const ema = new Map<string, { period: number; timeframe: ChartTimeframe }>();
  for (const line of activeLines(settings)) {
    const timeframe = resolveTimeframe(settings, line.timeframe);
    ema.set(lineKey(line.period, timeframe), {
      period: line.period,
      timeframe,
    });
  }
  return {
    symbol,
    session: screen.session,
    time: screen.time,
    timeframe: settings.timeframe,
    ema: [...ema.values()],
    rsi: settings.rsi.on
      ? {
          period: settings.rsi.period,
          timeframe: resolveTimeframe(settings, settings.rsi.timeframe),
        }
      : undefined,
  };
}
