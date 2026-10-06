import { useState, type FormEvent, type ReactNode } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  parseReplayForm,
  replaySessions,
  type ReplayInput,
} from "@/lib/screener-replay";
import { cn } from "@/lib/utils";

type ScreenFormProps = {
  initial: ReplayInput;
  capabilities?: { news: boolean; float: boolean };
  isFetching: boolean;
  canAdvance: boolean;
  onRun: (input: ReplayInput) => void;
  onAdvance: () => void;
};

// A filter shows its settings only while it is on. Off filters stay one line,
// which keeps the whole set readable at a glance.
function OptionalFilter({
  name,
  title,
  hint,
  description,
  initialEnabled,
  unavailable,
  onToggle,
  children,
}: {
  name: string;
  title: string;
  hint: string;
  description: string;
  initialEnabled: boolean;
  unavailable?: string;
  onToggle: (enabled: boolean) => void;
  children: ReactNode;
}) {
  const [enabled, setEnabled] = useState(initialEnabled && !unavailable);
  const blocked = Boolean(unavailable);
  return (
    <section
      className={cn(
        "panel overflow-hidden",
        enabled && "border-[var(--stroke-brass-hi)]",
      )}
      aria-labelledby={`${name}-title`}
    >
      <input type="hidden" name={name} value={enabled ? "on" : "off"} />
      <button
        type="button"
        aria-pressed={enabled}
        aria-describedby={`${name}-hint`}
        disabled={blocked}
        onClick={() => {
          setEnabled(!enabled);
          onToggle(!enabled);
        }}
        className={cn(
          "flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors",
          blocked
            ? "cursor-not-allowed opacity-60"
            : "hover:bg-[rgba(232,225,210,0.03)]",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
            enabled
              ? "border-[var(--brass)] bg-[var(--brass)] text-[var(--ink-0)]"
              : "border-[var(--stroke-3)]",
          )}
        >
          {enabled ? <Check className="size-3" strokeWidth={3} /> : null}
        </span>
        <span id={`${name}-title`} className="text-sm font-medium">
          {title}
        </span>
        <span
          id={`${name}-hint`}
          className="ml-auto hidden truncate text-xs text-muted-foreground sm:block"
        >
          {unavailable ? "Not connected" : hint}
        </span>
      </button>
      <fieldset
        disabled={!enabled}
        hidden={!enabled}
        className="min-w-0 border-t border-[var(--stroke)] px-5 pb-5 pt-4"
      >
        <legend className="sr-only">{title} settings</legend>
        <div className="flex flex-wrap gap-4">{children}</div>
        <p className="mt-3 text-xs text-muted-foreground">{description}</p>
      </fieldset>
      {unavailable ? (
        <p className="border-t border-[var(--stroke)] px-5 py-3 text-xs text-muted-foreground">
          {unavailable}
        </p>
      ) : null}
    </section>
  );
}

function Setting({
  htmlFor,
  label,
  children,
}: {
  htmlFor: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Field className="min-w-0 flex-1 basis-32 gap-1.5 sm:max-w-40">
      <FieldLabel htmlFor={htmlFor} className="text-xs font-normal">
        {label}
      </FieldLabel>
      {children}
    </Field>
  );
}

export function ScreenForm({
  initial,
  capabilities,
  isFetching,
  canAdvance,
  onRun,
  onAdvance,
}: ScreenFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [activeCount, setActiveCount] = useState(
    [
      initial.priceRange,
      initial.dailyChange,
      initial.relativeVolume,
      initial.news,
      initial.float,
      initial.ema,
      initial.rsi,
    ].filter(Boolean).length,
  );
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseReplayForm(new FormData(event.currentTarget));
    if (!parsed.success) {
      setFormError(parsed.error);
      return;
    }
    setFormError(null);
    onRun(parsed.data);
  }
  function countToggle(enabled: boolean) {
    setActiveCount((count) => count + (enabled ? 1 : -1));
  }
  return (
    <form onSubmit={handleSubmit} className="flex min-w-0 flex-col gap-4">
      <div className="panel sticky top-[76px] z-10 flex flex-wrap items-end gap-3 bg-[rgba(17,17,16,0.85)] p-4 backdrop-blur-xl">
        <Setting htmlFor="session" label="Session">
          <NativeSelect id="session" name="session" defaultValue={initial.session}>
            {replaySessions.map((date) => (
              <NativeSelectOption key={date} value={date}>
                {date}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Setting>
        <Setting htmlFor="time" label="Time, New York">
          <Input
            id="time"
            name="time"
            type="time"
            min="09:31"
            max="16:00"
            step={60}
            defaultValue={initial.time}
            required
          />
        </Setting>
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={isFetching} className="btn-brass-fill h-[38px] px-4">
            {isFetching ? "Running..." : "Run screen"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="btn-soft"
            disabled={isFetching || !canAdvance}
            onClick={onAdvance}
          >
            +1 minute
          </Button>
        </div>
        <p className="ml-auto text-xs text-muted-foreground">
          {activeCount === 0
            ? "No filters on · every instrument listed"
            : `${activeCount} filter${activeCount === 1 ? "" : "s"} on · all must match`}
        </p>
      </div>
      <div className="gap-2 lg:columns-2 [&>section]:mb-2 [&>section]:break-inside-avoid">
        <OptionalFilter
          name="priceEnabled"
          title="Price range"
          hint="Between two prices"
          initialEnabled={Boolean(initial.priceRange)}
          onToggle={countToggle}
          description="Both limits count as a match. Prices are in USD."
        >
          <Setting htmlFor="priceMinimum" label="Minimum ($)">
            <Input
              id="priceMinimum"
              name="priceMinimum"
              type="number"
              min={0}
              max={1_000_000}
              step={0.01}
              defaultValue={initial.priceRange?.minimum ?? 2}
              required
            />
          </Setting>
          <Setting htmlFor="priceMaximum" label="Maximum ($)">
            <Input
              id="priceMaximum"
              name="priceMaximum"
              type="number"
              min={0.01}
              max={1_000_000}
              step={0.01}
              defaultValue={initial.priceRange?.maximum ?? 20}
              required
            />
          </Setting>
        </OptionalFilter>
        <OptionalFilter
          name="changeEnabled"
          title="Daily change"
          hint="Up from yesterday's close"
          initialEnabled={Boolean(initial.dailyChange)}
          onToggle={countToggle}
          description="Change from the previous session’s close. Replay prices are unadjusted, so splits can distort this percentage."
        >
          <Setting htmlFor="changeMinimum" label="Minimum (%)">
            <Input
              id="changeMinimum"
              name="changeMinimum"
              type="number"
              min={-100}
              max={100_000}
              step={0.001}
              defaultValue={initial.dailyChange?.minimum ?? 10}
              required
            />
          </Setting>
        </OptionalFilter>
        <OptionalFilter
          name="volumeEnabled"
          title="Relative volume"
          hint="Busier than usual"
          initialEnabled={Boolean(initial.relativeVolume)}
          onToggle={countToggle}
          description="Volume so far against the average through this time in 20 prior sessions. 5× is five times usual activity. MINI feed only."
        >
          <Setting htmlFor="volumeMinimum" label="Minimum (×)">
            <Input
              id="volumeMinimum"
              name="volumeMinimum"
              type="number"
              min={0}
              max={1000}
              step={0.001}
              defaultValue={initial.relativeVolume?.minimum ?? 5}
              required
            />
          </Setting>
        </OptionalFilter>
        <OptionalFilter
          name="newsEnabled"
          title="Recent news"
          hint="Headline before this minute"
          initialEnabled={Boolean(initial.news)}
          onToggle={countToggle}
          description="Needs a symbol-linked headline published inside this window, before the replay time. A headline is not proof of a catalyst. Source: Finnhub."
          unavailable={
            !capabilities
              ? "Checking the news connection…"
              : !capabilities.news
                ? "Connect Finnhub to screen historical news."
                : undefined
          }
        >
          <Setting htmlFor="newsHours" label="Within (hours)">
            <Input
              id="newsHours"
              name="newsHours"
              type="number"
              min={1}
              max={168}
              step={1}
              defaultValue={initial.news?.hours ?? 24}
              required
            />
          </Setting>
        </OptionalFilter>
        <OptionalFilter
          name="floatEnabled"
          title="Free float"
          hint="Small tradable supply"
          initialEnabled={Boolean(initial.float)}
          onToggle={countToggle}
          description="Shares available for public trading, without insiders, holders of 5% or more and locked-up shares. Source: Massive. Each value applies from its effective date, and FinWin keeps a daily copy, so earlier replay times can have no value."
          unavailable={
            !capabilities
              ? "Checking float coverage…"
              : !capabilities.float
                ? "Free-float data is not connected. Shares outstanding cannot stand in for free float."
                : undefined
          }
        >
          <Setting htmlFor="floatMaximum" label="Below (M shares)">
            <Input
              id="floatMaximum"
              name="floatMaximum"
              type="number"
              min={0.001}
              max={1_000_000}
              step={0.001}
              defaultValue={initial.float ? initial.float.maximum / 1_000_000 : 20}
              required
            />
          </Setting>
        </OptionalFilter>
        <OptionalFilter
          name="emaEnabled"
          title="Price versus EMA"
          hint="Above or below the average"
          initialEnabled={Boolean(initial.ema)}
          onToggle={countToggle}
          description="Compares the latest completed price with an exponential moving average. The EMA starts from the average of its first candles and restarts after a missing candle."
        >
          <Setting htmlFor="emaComparison" label="Price is">
            <NativeSelect
              id="emaComparison"
              name="emaComparison"
              defaultValue={initial.ema?.comparison ?? "above"}
            >
              <NativeSelectOption value="above">Above EMA</NativeSelectOption>
              <NativeSelectOption value="below">Below EMA</NativeSelectOption>
            </NativeSelect>
          </Setting>
          <Setting htmlFor="emaTimeframe" label="Candles">
            <NativeSelect
              id="emaTimeframe"
              name="emaTimeframe"
              defaultValue={initial.ema?.timeframe ?? "1m"}
            >
              <NativeSelectOption value="1m">1 minute</NativeSelectOption>
              <NativeSelectOption value="5m">5 minutes</NativeSelectOption>
              <NativeSelectOption value="1d">Daily</NativeSelectOption>
            </NativeSelect>
          </Setting>
          <Setting htmlFor="emaPeriod" label="Period">
            <Input
              id="emaPeriod"
              name="emaPeriod"
              type="number"
              min={1}
              max={200}
              step={1}
              defaultValue={initial.ema?.period ?? 20}
              list="ema-presets"
              required
            />
            <datalist id="ema-presets">
              <option value={9} />
              <option value={20} />
              <option value={200} />
            </datalist>
          </Setting>
        </OptionalFilter>
        <OptionalFilter
          name="rsiEnabled"
          title="RSI"
          hint="Momentum against a level"
          initialEnabled={Boolean(initial.rsi)}
          onToggle={countToggle}
          description="RSI uses its own candle interval, independent of the EMA filter."
        >
          <Setting htmlFor="rsiComparison" label="RSI is">
            <NativeSelect
              id="rsiComparison"
              name="rsiComparison"
              defaultValue={initial.rsi?.comparison ?? "above"}
            >
              <NativeSelectOption value="above">Above</NativeSelectOption>
              <NativeSelectOption value="below">Below</NativeSelectOption>
            </NativeSelect>
          </Setting>
          <Setting htmlFor="rsiThreshold" label="Threshold">
            <Input
              id="rsiThreshold"
              name="rsiThreshold"
              type="number"
              min={0}
              max={100}
              step="any"
              defaultValue={initial.rsi?.threshold ?? 50}
              required
            />
          </Setting>
          <Setting htmlFor="rsiPeriod" label="Period">
            <Input
              id="rsiPeriod"
              name="rsiPeriod"
              type="number"
              min={2}
              max={200}
              step={1}
              defaultValue={initial.rsi?.period ?? 14}
              required
            />
          </Setting>
          <Setting htmlFor="rsiTimeframe" label="Candles">
            <NativeSelect
              id="rsiTimeframe"
              name="rsiTimeframe"
              defaultValue={initial.rsi?.timeframe ?? "1m"}
            >
              <NativeSelectOption value="1m">1 minute</NativeSelectOption>
              <NativeSelectOption value="5m">5 minutes</NativeSelectOption>
              <NativeSelectOption value="1d">Daily</NativeSelectOption>
            </NativeSelect>
          </Setting>
        </OptionalFilter>
      </div>
      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}
    </form>
  );
}
