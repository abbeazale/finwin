import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  TickMarkType,
  type IChartApi,
  type ISeriesApi,
  type LogicalRange,
  type MouseEventParams,
  type SeriesType,
  type Time,
} from "lightweight-charts";
import type { ChartResult } from "@/server/screener/chart";

export type PlotLine = {
  key: string;
  label: string;
  color: string;
  style: "solid" | "dashed" | "dotted";
  indicator: number;
};

const lineStyle = {
  solid: LineStyle.Solid,
  dashed: LineStyle.LargeDashed,
  dotted: LineStyle.Dotted,
} as const;

type PriceChartProps = {
  result: ChartResult | null;
  lines: PlotLine[];
  rsi: PlotLine | null;
  volume: boolean;
  // Changing the view key (symbol, interval or session) resets the viewport.
  viewKey: string;
  resetToken: number;
  onHover: (index: number | null) => void;
};

const colors = {
  text: "#9a8f7c",
  grid: "rgba(232, 225, 210, 0.04)",
  border: "rgba(232, 225, 210, 0.10)",
  up: "#9ebaa0",
  down: "#d88662",
  upVolume: "rgba(158, 186, 160, 0.35)",
  downVolume: "rgba(216, 134, 98, 0.35)",
  crosshair: "rgba(232, 199, 145, 0.45)",
};

const newYork = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", ...options });
const nyClock = newYork({ hour: "2-digit", minute: "2-digit", hour12: false });
const nyDay = newYork({ month: "short", day: "numeric" });
const nyFull = newYork({
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// Intraday points sit at their UTC completion instant; daily points use the
// session date. Labels are always formatted in New York time.
function formatTime(time: Time) {
  if (typeof time === "number") return nyFull.format(time * 1000);
  if (typeof time === "string") return time;
  return `${time.year}-${String(time.month).padStart(2, "0")}-${String(time.day).padStart(2, "0")}`;
}
function formatTick(time: Time, type: TickMarkType) {
  if (typeof time !== "number") return formatTime(time);
  return type === TickMarkType.Time || type === TickMarkType.TimeWithSeconds
    ? nyClock.format(time * 1000)
    : nyDay.format(time * 1000);
}

function timeOf(result: ChartResult, candle: ChartResult["candles"][number]) {
  return (
    result.timeframe === "1d"
      ? new Date(candle.start).toISOString().slice(0, 10)
      : Math.round(candle.end / 1000)
  ) as Time;
}

function lineData(result: ChartResult, line: PlotLine, times: Time[]) {
  const points = result.indicators[line.indicator]?.points ?? [];
  return points.map((point, index) => {
    if (point.state !== "available") return { time: times[index] };
    const next = points[index + 1];
    // Lines draw each segment in the colour of its first point. A transparent
    // final point of a run hides the segment that would bridge a reset.
    const breaks = next?.state === "available" && next.run !== point.run;
    return {
      time: times[index],
      value: point.value,
      ...(breaks ? { color: "transparent" } : {}),
    };
  });
}

// Show the current session prefix, or the latest 60 daily candles.
function resetView(chart: IChartApi, result: ChartResult) {
  const last = result.candles.length - 1;
  if (last < 0) return;
  let from = Math.max(0, last - 59);
  if (result.timeframe !== "1d") {
    const sessionStart = Date.parse(`${result.session}T09:30:00-04:00`);
    const first = result.candles.findIndex(
      (candle) => candle.start >= sessionStart,
    );
    if (first >= 0) from = Math.min(first, Math.max(0, last - 29));
  }
  chart.timeScale().setVisibleLogicalRange({ from: from - 0.5, to: last + 3 });
}

export default function PriceChart({
  result,
  lines,
  rsi,
  volume,
  viewKey,
  resetToken,
  onHover,
}: PriceChartProps) {
  const container = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const extraRef = useRef(new Map<string, ISeriesApi<SeriesType>>());
  const appliedView = useRef<string | null>(null);
  const hover = useRef(onHover);
  useEffect(() => {
    hover.current = onHover;
  }, [onHover]);

  // One chart instance for the component's lifetime.
  useEffect(() => {
    if (!container.current) return;
    const chart = createChart(container.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: colors.text,
        fontFamily: "inherit",
        attributionLogo: true,
        panes: { separatorColor: colors.border },
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: colors.crosshair },
        horzLine: { color: colors.crosshair },
      },
      rightPriceScale: { borderColor: colors.border },
      timeScale: {
        borderColor: colors.border,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: formatTick,
      },
      localization: { timeFormatter: formatTime },
    });
    // Hollow rising candles and filled falling candles carry direction
    // without relying on colour alone.
    candlesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: "transparent",
      borderUpColor: colors.up,
      wickUpColor: colors.up,
      downColor: colors.down,
      borderDownColor: colors.down,
      wickDownColor: colors.down,
      priceLineVisible: false,
    });
    const handleMove = (param: MouseEventParams) => {
      hover.current(
        param.logical === undefined || param.point === undefined
          ? null
          : Math.round(param.logical),
      );
    };
    chart.subscribeCrosshairMove(handleMove);
    chartRef.current = chart;
    const extra = extraRef.current;
    return () => {
      chart.unsubscribeCrosshairMove(handleMove);
      extra.clear();
      chart.remove();
      chartRef.current = null;
      candlesRef.current = null;
    };
  }, []);

  // Data and series changes reuse the chart; only line series come and go.
  useEffect(() => {
    const chart = chartRef.current;
    const candles = candlesRef.current;
    if (!chart || !candles) return;
    const extra = extraRef.current;
    const timeScale = chart.timeScale();
    const before: LogicalRange | null = timeScale.getVisibleLogicalRange();
    const following = timeScale.scrollPosition() > -1;

    // Volume and RSI panes are rebuilt together so they keep their order.
    const wanted = new Set<string>([
      ...lines.map((line) => `line:${line.key}`),
      ...(volume ? ["volume"] : []),
      ...(rsi ? [`rsi:${rsi.key}`] : []),
    ]);
    const paneChanged =
      extra.has("volume") !== volume ||
      [...extra.keys()].some(
        (key) => key.startsWith("rsi:") && key !== `rsi:${rsi?.key}`,
      ) ||
      (rsi !== null && !extra.has(`rsi:${rsi.key}`));
    for (const [key, series] of extra)
      if (
        !wanted.has(key) ||
        (paneChanged && (key === "volume" || key.startsWith("rsi:")))
      ) {
        chart.removeSeries(series);
        extra.delete(key);
      }
    for (const line of lines) {
      const key = `line:${line.key}`;
      if (!extra.has(key))
        extra.set(
          key,
          chart.addSeries(LineSeries, {
            color: line.color,
            lineWidth: 2,
            lineStyle: lineStyle[line.style],
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
            title: line.label,
          }),
        );
    }
    if (volume && !extra.has("volume"))
      extra.set(
        "volume",
        chart.addSeries(
          HistogramSeries,
          {
            priceFormat: { type: "volume" },
            priceLineVisible: false,
            lastValueVisible: false,
          },
          1,
        ),
      );
    if (rsi && !extra.has(`rsi:${rsi.key}`)) {
      const series = chart.addSeries(
        LineSeries,
        {
          color: rsi.color,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          crosshairMarkerVisible: false,
          title: rsi.label,
          autoscaleInfoProvider: () => ({
            priceRange: { minValue: 0, maxValue: 100 },
          }),
        },
        volume ? 2 : 1,
      );
      for (const price of [30, 70])
        series.createPriceLine({
          price,
          color: colors.border,
          lineStyle: LineStyle.Dashed,
          lineWidth: 1,
          axisLabelVisible: false,
          title: "",
        });
      extra.set(`rsi:${rsi.key}`, series);
    }
    const panes = chart.panes();
    panes[0]?.setStretchFactor(3);
    for (const pane of panes.slice(1)) pane.setStretchFactor(1);

    // Never show an old chart under a new key: clear until data arrives.
    if (!result) {
      candles.setData([]);
      for (const series of extra.values()) series.setData([]);
      return;
    }
    const times = result.candles.map((candle) => timeOf(result, candle));
    candles.setData(
      result.candles.map((candle, index) =>
        candle.status === "available"
          ? {
              time: times[index],
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
            }
          : { time: times[index] },
      ),
    );
    for (const line of lines)
      extra.get(`line:${line.key}`)?.setData(lineData(result, line, times));
    extra.get("volume")?.setData(
      result.candles.map((candle, index) =>
        candle.status === "available" && candle.volume !== null
          ? {
              time: times[index],
              value: candle.volume,
              color:
                candle.close >= candle.open
                  ? colors.upVolume
                  : colors.downVolume,
            }
          : { time: times[index] },
      ),
    );
    if (rsi) extra.get(`rsi:${rsi.key}`)?.setData(lineData(result, rsi, times));

    if (appliedView.current !== viewKey) {
      resetView(chart, result);
      appliedView.current = viewKey;
    } else if (!following && before) {
      timeScale.setVisibleLogicalRange(before);
    }
  }, [result, lines, rsi, volume, viewKey]);

  useEffect(() => {
    if (resetToken && chartRef.current && result)
      resetView(chartRef.current, result);
    // Only an explicit Reset view request moves the viewport here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken]);

  return (
    <div
      ref={container}
      className="h-[460px] w-full"
      onMouseLeave={() => onHover(null)}
      aria-hidden
    />
  );
}
