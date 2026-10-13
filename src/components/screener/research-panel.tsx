import { useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  chartTimeframeLabels,
  chartTimeframes,
  MAX_CHART_LINES,
  type ChartTimeframe,
} from "@/lib/screener-chart";
import type { ReplayInput, ReplaySymbol } from "@/lib/screener-replay";
import type { ChartResult } from "@/server/screener/chart";
import type { ReplayResult } from "@/server/screener/replay";
import { cn } from "@/lib/utils";
import {
  activeLines,
  lineKey,
  resolveTimeframe,
  type ChartSettings,
  type EmaLine,
  type LineTimeframe,
} from "./chart-settings";
import { replayDecimal } from "./format";
import type { PlotLine } from "./price-chart";

// The chart library needs the browser; it loads only when a symbol is chosen.
const PriceChart = dynamic(() => import("./price-chart"), {
  ssr: false,
  loading: () => <div className="h-[460px]" />,
});

// Line style as well as colour tells the lines apart.
const lineStyles: Record<EmaLine["id"], Pick<PlotLine, "color" | "style">> = {
  ema9: { color: "#e8c791", style: "solid" },
  ema20: { color: "#e8e1d2", style: "solid" },
  ema200: { color: "#d49a4a", style: "dashed" },
  custom: { color: "#9a8f7c", style: "dotted" },
};
const rsiColor = "#c9a46b";

const newYork = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", ...options });
const nyClock = newYork({ hour: "2-digit", minute: "2-digit", hour12: false });
const nyDate = newYork({ year: "numeric", month: "2-digit", day: "2-digit" });
const shares = new Intl.NumberFormat("en-US");

function dateOf(ms: number) {
  // en-US gives MM/DD/YYYY; present ISO-style session dates.
  const [month, day, year] = nyDate.format(ms).split("/");
  return `${year}-${month}-${day}`;
}
function interval(result: ChartResult, start: number, end: number) {
  if (result.timeframe === "1d") return `${dateOf(start)} regular session`;
  const minutes = (end - start) / 60_000;
  const short =
    result.timeframe !== "1m" &&
    minutes < { "5m": 5, "10m": 10, "15m": 15, "30m": 30, "1h": 60 }[result.timeframe];
  return `${dateOf(start)} ${nyClock.format(start)}–${nyClock.format(end)}${short ? ` (${minutes}-minute closing candle)` : ""}`;
}
function stamp(ms: number) {
  return `${dateOf(ms)} ${nyClock.format(ms)}`;
}
function timeframeLabel(timeframe: ChartTimeframe) {
  return timeframe === "1d" ? "daily" : timeframe;
}

function TimeframeSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: LineTimeframe;
  onChange: (value: LineTimeframe) => void;
}) {
  return (
    <NativeSelect
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value as LineTimeframe)}
      className="h-8 text-xs"
    >
      <NativeSelectOption value="chart">Chart interval</NativeSelectOption>
      {chartTimeframes.map((timeframe) => (
        <NativeSelectOption key={timeframe} value={timeframe}>
          Fixed {chartTimeframeLabels[timeframe]}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

// Period inputs commit on blur or Enter, never on each partial keystroke.
function PeriodInput({
  id,
  label,
  value,
  min,
  onCommit,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setDraft(String(value));
  }
  const valid = (text: string) => {
    const number = Number(text);
    return Number.isInteger(number) && number >= min && number <= 200;
  };
  function commit() {
    if (valid(draft)) onCommit(Number(draft));
    else setDraft(String(value));
  }
  return (
    <Input
      id={id}
      aria-label={label}
      type="number"
      min={min}
      max={200}
      step={1}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
      }}
      aria-invalid={!valid(draft)}
      className="h-8 w-20 text-xs"
    />
  );
}

function Toggle({
  pressed,
  disabled,
  onClick,
  swatch,
  children,
}: {
  pressed: boolean;
  disabled?: boolean;
  onClick: () => void;
  swatch?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brass-hi)]",
        pressed
          ? "border-[var(--stroke-brass-hi)] bg-[rgba(201,164,107,0.1)] text-bone"
          : "border-[var(--stroke-2)] text-bone-mute hover:text-bone",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {swatch ? (
        <span
          aria-hidden
          className="h-0.5 w-3 rounded-full"
          style={{ background: swatch, opacity: pressed ? 1 : 0.5 }}
        />
      ) : null}
      {children}
    </button>
  );
}

type ResearchPanelProps = {
  symbol: ReplaySymbol;
  screen: ReplayInput;
  row: ReplayResult["rows"][number] | undefined;
  screenDatasets: Pick<ReplayResult, "emaDataset" | "rsiDataset"> | undefined;
  settings: ChartSettings;
  onSettings: (settings: ChartSettings) => void;
  onReset: () => void;
  onClose: () => void;
  data: ChartResult | undefined;
  error: string | null;
  isFetching: boolean;
  onRetry: () => void;
};

export function ResearchPanel({
  symbol,
  screen,
  row,
  screenDatasets,
  settings,
  onSettings,
  onReset,
  onClose,
  data,
  error,
  isFetching,
  onRetry,
}: ResearchPanelProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [resetToken, setResetToken] = useState(0);
  const active = activeLines(settings);
  const full = active.length >= MAX_CHART_LINES;

  function updateLine(id: EmaLine["id"], change: Partial<EmaLine>) {
    onSettings({
      ...settings,
      emas: settings.emas.map((line) =>
        line.id === id ? { ...line, ...change } : line,
      ),
    });
  }

  // Map each active line to its indicator in this exact response.
  const indicatorIndex = (kind: "ema" | "rsi", period: number, tf: ChartTimeframe) =>
    data?.indicators.findIndex(
      (indicator) =>
        indicator.kind === kind &&
        indicator.period === period &&
        indicator.timeframe === tf,
    ) ?? -1;
  const plotLines = useMemo<PlotLine[]>(
    () =>
      active.flatMap((line) => {
        const timeframe = resolveTimeframe(settings, line.timeframe);
        const indicator = indicatorIndex("ema", line.period, timeframe);
        if (indicator < 0) return [];
        return [
          {
            key: `${line.id}:${lineKey(line.period, timeframe)}`,
            label: `EMA ${line.period}${line.timeframe === "chart" ? "" : ` ${timeframeLabel(timeframe)}`}`,
            indicator,
            ...lineStyles[line.id],
          },
        ];
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, settings],
  );
  const rsiTimeframe = resolveTimeframe(settings, settings.rsi.timeframe);
  const rsiLine = useMemo<PlotLine | null>(() => {
    if (!settings.rsi.on) return null;
    const indicator = indicatorIndex("rsi", settings.rsi.period, rsiTimeframe);
    return indicator < 0
      ? null
      : {
          key: lineKey(settings.rsi.period, rsiTimeframe),
          label: `RSI ${settings.rsi.period}`,
          color: rsiColor,
          style: "solid",
          indicator,
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, settings]);

  const candleIndex =
    data && hovered !== null && hovered >= 0 && hovered < data.candles.length
      ? hovered
      : data
        ? data.candles.length - 1
        : -1;
  const candle = data && candleIndex >= 0 ? data.candles[candleIndex] : null;
  const viewKey = `${symbol}|${settings.timeframe}|${screen.session}`;

  function indicatorSummary(
    label: string,
    indicator: ChartResult["indicators"][number] | undefined,
  ) {
    if (!indicator) return null;
    const native = timeframeLabel(indicator.timeframe);
    const latest = indicator.latest;
    if (!latest)
      return `${label} (${native}): no completed ${native} candle in the sample yet.`;
    if (latest.state === "missing")
      return `${label} (${native}): the latest ${native} candle, ending ${stamp(latest.end)}, is missing; the line restarts after it.`;
    if (latest.state === "warming")
      return `${label} (${native}): warming up. It needs ${indicator.kind === "rsi" ? indicator.period + 1 : indicator.period} consecutive ${native} candles since ${stamp(latest.seedStart)}.`;
    return `${label} (${native}) ${replayDecimal.format(latest.value)} at ${stamp(latest.end)}, seeded from ${stamp(latest.seedStart)}.`;
  }

  return (
    <section
      aria-labelledby="research-heading"
      className="panel flex min-w-0 flex-col gap-4 p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="research-heading" className="display text-[26px] leading-none">
            {symbol}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Recorded prices through {screen.session} {screen.time} New York.
            Nothing after this minute is shown.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="btn-soft"
          onClick={onClose}
          aria-label={`Close ${symbol} chart`}
        >
          <X className="size-4" />
          Close
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <div
          role="group"
          aria-label="Candle interval"
          className="flex flex-wrap items-center gap-1.5"
        >
          {chartTimeframes.map((timeframe) => (
            <Toggle
              key={timeframe}
              pressed={settings.timeframe === timeframe}
              onClick={() => onSettings({ ...settings, timeframe })}
            >
              {chartTimeframeLabels[timeframe]}
            </Toggle>
          ))}
        </div>
        <div
          role="group"
          aria-label="Indicators"
          className="flex flex-wrap items-center gap-1.5"
        >
          {settings.emas
            .filter((line) => line.id !== "custom")
            .map((line) => (
              <Toggle
                key={line.id}
                pressed={line.on}
                disabled={!line.on && full}
                swatch={lineStyles[line.id].color}
                onClick={() => updateLine(line.id, { on: !line.on })}
              >
                EMA {line.period}
              </Toggle>
            ))}
          <Toggle
            pressed={settings.emas[3].on}
            disabled={!settings.emas[3].on && full}
            swatch={lineStyles.custom.color}
            onClick={() => updateLine("custom", { on: !settings.emas[3].on })}
          >
            EMA {settings.emas[3].period}
          </Toggle>
          <Toggle
            pressed={settings.rsi.on}
            swatch={rsiColor}
            onClick={() =>
              onSettings({
                ...settings,
                rsi: { ...settings.rsi, on: !settings.rsi.on },
              })
            }
          >
            RSI {settings.rsi.period}
          </Toggle>
          <Toggle
            pressed={settings.volume}
            onClick={() => onSettings({ ...settings, volume: !settings.volume })}
          >
            Volume
          </Toggle>
          <Button
            type="button"
            variant="ghost"
            className="btn-soft ml-auto h-8 text-xs"
            onClick={() => setResetToken((token) => token + 1)}
          >
            Reset view
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="btn-soft h-8 text-xs"
            onClick={onReset}
          >
            Reset chart settings
          </Button>
        </div>
        {full ? (
          <p className="text-xs text-muted-foreground">
            Up to {MAX_CHART_LINES} EMA lines at once. Turn one off to add
            another.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {settings.emas
            .filter((line) => line.on || line.id === "custom")
            .map((line) => (
              <div key={line.id} className="flex items-center gap-2 text-xs">
                <label
                  htmlFor={`${line.id}-timeframe`}
                  className="text-muted-foreground"
                >
                  {line.id === "custom" ? "Custom EMA" : `EMA ${line.period}`}
                </label>
                {line.id === "custom" ? (
                  <PeriodInput
                    id="custom-period"
                    label="Custom EMA period"
                    value={line.period}
                    min={1}
                    onCommit={(period) => updateLine("custom", { period })}
                  />
                ) : null}
                <TimeframeSelect
                  id={`${line.id}-timeframe`}
                  value={line.timeframe}
                  onChange={(timeframe) => updateLine(line.id, { timeframe })}
                />
              </div>
            ))}
          {settings.rsi.on ? (
            <div className="flex items-center gap-2 text-xs">
              <label htmlFor="rsi-timeframe" className="text-muted-foreground">
                RSI
              </label>
              <PeriodInput
                id="rsi-period"
                label="RSI period"
                value={settings.rsi.period}
                min={2}
                onCommit={(period) =>
                  onSettings({ ...settings, rsi: { ...settings.rsi, period } })
                }
              />
              <TimeframeSelect
                id="rsi-timeframe"
                value={settings.rsi.timeframe}
                onChange={(timeframe) =>
                  onSettings({
                    ...settings,
                    rsi: { ...settings.rsi, timeframe },
                  })
                }
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="relative min-w-0" aria-busy={isFetching}>
        <div className="mb-2 flex min-h-5 flex-wrap gap-x-4 text-xs tabular-nums text-bone-mute">
          {data && candle ? (
            <>
              <span className="text-bone">
                {interval(data, candle.start, candle.end)}
              </span>
              {candle.status === "available" ? (
                <span>
                  O {replayDecimal.format(candle.open)} H{" "}
                  {replayDecimal.format(candle.high)} L{" "}
                  {replayDecimal.format(candle.low)} C{" "}
                  {replayDecimal.format(candle.close)}
                  {candle.close >= candle.open ? " ▲" : " ▼"} · Vol{" "}
                  {candle.volume === null ? "unavailable" : shares.format(candle.volume)}
                </span>
              ) : (
                <span>Missing candle: a required minute was not recorded.</span>
              )}
              {plotLines.map((line) => {
                const point = data.indicators[line.indicator]?.points[candleIndex];
                return (
                  <span key={line.key} style={{ color: line.color }}>
                    {line.label}{" "}
                    {point?.state === "available"
                      ? replayDecimal.format(point.value)
                      : point?.state === "missing"
                        ? "gap"
                        : "warming up"}
                  </span>
                );
              })}
            </>
          ) : null}
        </div>
        <PriceChart
          result={data ?? null}
          lines={plotLines}
          rsi={rsiLine}
          volume={settings.volume}
          viewKey={viewKey}
          resetToken={resetToken}
          onHover={setHovered}
        />
        {!data ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            {error ? (
              <div role="alert" className="flex flex-col items-center gap-2">
                <span>Chart unavailable. {error}</span>
                <Button
                  type="button"
                  variant="ghost"
                  className="btn-soft"
                  onClick={onRetry}
                >
                  Try again
                </Button>
              </div>
            ) : (
              <span role="status">Loading {symbol} price history…</span>
            )}
          </div>
        ) : null}
      </div>

      {data ? (
        <div className="flex flex-col gap-2 text-xs text-muted-foreground">
          <p aria-live="polite">
            {data.latestExpected?.status === "missing"
              ? `The latest ${timeframeLabel(data.timeframe)} candle, ending ${stamp(data.latestExpected.end)}, is missing. `
              : ""}
            {data.candles.length === 0
              ? `No completed ${timeframeLabel(data.timeframe)} candle yet at this replay time.`
              : `Latest available candle ends ${data.latestAvailable ? stamp(data.latestAvailable.end) : "—"}.`}{" "}
            {data.indicators
              .map((indicator) =>
                indicatorSummary(
                  `${indicator.kind.toUpperCase()} ${indicator.period}`,
                  indicator,
                ),
              )
              .join(" ")}
          </p>
          <ScreenContext
            screen={screen}
            row={row}
            datasets={screenDatasets}
          />
          <p>
            Regular-session candles from {data.dataset} minute bars, in{" "}
            {data.currency}, {data.adjustment}. Volume is shares per candle,
            {" "}
            {data.volumeScope}. Daily candles and daily lines use only earlier
            sessions and cover {data.coverage.from} to {data.coverage.through}.
            Charts by{" "}
            <a
              href="https://www.tradingview.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              TradingView
            </a>
            .
          </p>
          <CandleTable result={data} />
        </div>
      ) : null}
    </section>
  );
}

// The applied screen's values stay separate from chart exploration. They agree
// with a chart line only for the same interval, period, feed and seed history.
function ScreenContext({
  screen,
  row,
  datasets,
}: {
  screen: ReplayInput;
  row: ReplayResult["rows"][number] | undefined;
  datasets: Pick<ReplayResult, "emaDataset" | "rsiDataset"> | undefined;
}) {
  if (!screen.ema && !screen.rsi) return null;
  if (!row) return null;
  if (row.status === "excluded")
    return <p>Screen: excluded at this time. {row.reason}</p>;
  const parts: string[] = [];
  if (screen.ema && row.ema)
    parts.push(
      `price ${screen.ema.comparison} EMA ${screen.ema.period} (${timeframeLabel(screen.ema.timeframe)}) = ${replayDecimal.format(row.ema.value)}, candle ${stamp(Date.parse(row.ema.candleEnd))}, seeded ${stamp(Date.parse(row.ema.seedStart))}, ${datasets?.emaDataset}`,
    );
  if (screen.rsi && row.rsi)
    parts.push(
      `RSI ${screen.rsi.period} (${timeframeLabel(screen.rsi.timeframe)}) ${screen.rsi.comparison} ${screen.rsi.threshold} = ${row.rsi.value.toFixed(2)}, candle ${stamp(Date.parse(row.rsi.candleEnd))}, ${datasets?.rsiDataset}`,
    );
  return (
    <p>
      Screen at {screen.time}: {parts.join("; ")}.
      {screen.ema?.timeframe === "1d" || screen.rsi?.timeframe === "1d"
        ? " The screen's daily values use EQUS.SUMMARY closes; chart daily lines use regular-session MINI candles, so they can differ."
        : ""}
    </p>
  );
}

const TABLE_ROWS = 60;

function CandleTable({ result }: { result: ChartResult }) {
  const [open, setOpen] = useState(false);
  const rows = result.candles.slice(-TABLE_ROWS).reverse();
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer">
        Candle data (latest {Math.min(TABLE_ROWS, result.candles.length)})
      </summary>
      {open ? (
        <div className="mt-2 max-h-80 overflow-auto">
          <table className="w-full text-left tabular-nums">
            <caption className="sr-only">
              {result.symbol} {timeframeLabel(result.timeframe)} candles, newest
              first
            </caption>
            <thead>
              <tr>
                <th scope="col" className="py-1 pr-3 font-medium">Candle</th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">Open</th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">High</th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">Low</th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">Close</th>
                <th scope="col" className="py-1 text-right font-medium">Volume</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((candle) => (
                <tr key={candle.start} className="border-t border-[var(--stroke)]">
                  <th scope="row" className="py-1 pr-3 font-normal">
                    {interval(result, candle.start, candle.end)}
                  </th>
                  {candle.status === "available" ? (
                    <>
                      <td className="py-1 pr-3 text-right">{replayDecimal.format(candle.open)}</td>
                      <td className="py-1 pr-3 text-right">{replayDecimal.format(candle.high)}</td>
                      <td className="py-1 pr-3 text-right">{replayDecimal.format(candle.low)}</td>
                      <td className="py-1 pr-3 text-right">{replayDecimal.format(candle.close)}</td>
                      <td className="py-1 text-right">
                        {candle.volume === null ? "Unavailable" : shares.format(candle.volume)}
                      </td>
                    </>
                  ) : (
                    <td colSpan={5} className="py-1">
                      Missing: a required minute was not recorded.
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </details>
  );
}
