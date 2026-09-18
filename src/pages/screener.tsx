import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageStatus } from "@/components/page-status";
import { useRequireSession } from "@/hooks/use-require-session";
import {
  replayInputSchema,
  replaySessions,
  type ReplayInput,
} from "@/lib/screener-replay";
import { trpc } from "@/lib/trpc";

const initialScreen: ReplayInput = {
  session: "2026-09-15",
  time: "10:30",
  timeframe: "1m",
  period: 20,
  comparison: "above",
};
const clock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const decimal = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

export default function ScreenerPage() {
  const { session, isPending } = useRequireSession();
  const [screen, setScreen] = useState(initialScreen);
  const [formError, setFormError] = useState<string | null>(null);
  const replay = trpc.screener.replay.useQuery(screen, {
    enabled: Boolean(session),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  function runScreen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const numberField = (name: string) => {
      const value = fields.get(name);
      return value === null || value === "" ? Number.NaN : Number(value);
    };
    const result = replayInputSchema.safeParse({
      session: fields.get("session"),
      time: fields.get("time"),
      timeframe: fields.get("timeframe"),
      comparison: fields.get("comparison"),
      period: numberField("period"),
      rsi:
        fields.get("rsiComparison") === "off"
          ? undefined
          : {
              timeframe: fields.get("rsiTimeframe"),
              period: numberField("rsiPeriod"),
              comparison: fields.get("rsiComparison"),
              threshold: numberField("rsiThreshold"),
            },
      relativeVolume:
        fields.get("volumeEnabled") === "on"
          ? { minimum: numberField("volumeMinimum") }
          : undefined,
    });
    if (!result.success) {
      setFormError(result.error.issues[0].message);
      return;
    }
    setFormError(null);
    if (JSON.stringify(result.data) === JSON.stringify(screen))
      void replay.refetch();
    setScreen(result.data);
  }

  if (isPending) return <PageStatus label="Preparing the screener..." />;
  if (!session) return <PageStatus label="Redirecting..." />;
  const result = replay.data;

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:underline"
          >
            Back to desk
          </Link>
          <p className="text-sm text-muted-foreground">
            Historical replay · Five-symbol preview
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Stock screener
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            Combine moving averages, RSI and same-time volume across five
            recorded instruments. Every result belongs to the selected
            historical minute.
          </p>
        </header>
        <Alert>
          <AlertTitle>Recorded prices, no live quotes</AlertTitle>
          <AlertDescription>
            Price is the last completed one-minute close. Indicators use
            completed candles only. Intraday prices and volume use EQUS.MINI;
            daily indicators use EQUS.SUMMARY from prior sessions. Prices are
            unadjusted, and volume covers the MINI feed only. Paper trading is
            unavailable in replay.
          </AlertDescription>
        </Alert>
        <form
          key={JSON.stringify(screen)}
          onSubmit={runScreen}
          className="flex flex-col gap-6 rounded-lg border p-6"
        >
          <h2 className="text-lg font-medium">Price versus SMA</h2>
          <FieldGroup className="sm:grid sm:grid-cols-2 lg:grid-cols-5">
            <Field>
              <FieldLabel htmlFor="session">Session</FieldLabel>
              <NativeSelect
                id="session"
                name="session"
                defaultValue={screen.session}
              >
                {replaySessions.map((date) => (
                  <NativeSelectOption key={date} value={date}>
                    {date}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="time">Time, New York</FieldLabel>
              <Input
                id="time"
                name="time"
                type="time"
                min="09:31"
                max="16:00"
                step={60}
                defaultValue={screen.time}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="comparison">Price is</FieldLabel>
              <NativeSelect
                id="comparison"
                name="comparison"
                defaultValue={screen.comparison}
              >
                <NativeSelectOption value="above">Above SMA</NativeSelectOption>
                <NativeSelectOption value="below">Below SMA</NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="timeframe">Candle interval</FieldLabel>
              <NativeSelect
                id="timeframe"
                name="timeframe"
                defaultValue={screen.timeframe}
              >
                <NativeSelectOption value="1m">1 minute</NativeSelectOption>
                <NativeSelectOption value="5m">5 minutes</NativeSelectOption>
                <NativeSelectOption value="1d">Daily</NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="period">SMA period</FieldLabel>
              <Input
                id="period"
                name="period"
                type="number"
                min={1}
                max={200}
                step={1}
                defaultValue={screen.period}
                list="sma-presets"
                required
              />
              <datalist id="sma-presets">
                <option value={9} />
                <option value={20} />
                <option value={200} />
              </datalist>
            </Field>
          </FieldGroup>
          <div className="flex flex-col gap-4 border-t pt-6">
            <h2 className="text-lg font-medium">Optional conditions</h2>
            <p className="text-sm text-muted-foreground">
              Every enabled condition must match. RSI uses its own candle
              interval. Relative volume compares activity through this minute
              with the same time in 20 prior sessions.
            </p>
            <FieldGroup className="sm:grid sm:grid-cols-2 lg:grid-cols-4">
              <Field>
                <FieldLabel htmlFor="rsiComparison">RSI condition</FieldLabel>
                <NativeSelect
                  id="rsiComparison"
                  name="rsiComparison"
                  defaultValue={screen.rsi?.comparison ?? "off"}
                >
                  <NativeSelectOption value="off">Off</NativeSelectOption>
                  <NativeSelectOption value="above">
                    Above threshold
                  </NativeSelectOption>
                  <NativeSelectOption value="below">
                    Below threshold
                  </NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="rsiThreshold">RSI threshold</FieldLabel>
                <Input
                  id="rsiThreshold"
                  name="rsiThreshold"
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  defaultValue={screen.rsi?.threshold ?? 50}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="rsiPeriod">RSI period</FieldLabel>
                <Input
                  id="rsiPeriod"
                  name="rsiPeriod"
                  type="number"
                  min={2}
                  max={200}
                  step={1}
                  defaultValue={screen.rsi?.period ?? 14}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="rsiTimeframe">
                  RSI candle interval
                </FieldLabel>
                <NativeSelect
                  id="rsiTimeframe"
                  name="rsiTimeframe"
                  defaultValue={screen.rsi?.timeframe ?? "1m"}
                >
                  <NativeSelectOption value="1m">1 minute</NativeSelectOption>
                  <NativeSelectOption value="5m">5 minutes</NativeSelectOption>
                  <NativeSelectOption value="1d">Daily</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="volumeEnabled">
                  Relative volume condition
                </FieldLabel>
                <NativeSelect
                  id="volumeEnabled"
                  name="volumeEnabled"
                  defaultValue={screen.relativeVolume ? "on" : "off"}
                >
                  <NativeSelectOption value="off">Off</NativeSelectOption>
                  <NativeSelectOption value="on">
                    At least the minimum
                  </NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="volumeMinimum">
                  Minimum relative volume
                </FieldLabel>
                <Input
                  id="volumeMinimum"
                  name="volumeMinimum"
                  type="number"
                  min={0}
                  max={1000}
                  step={0.001}
                  defaultValue={screen.relativeVolume?.minimum ?? 1}
                />
              </Field>
            </FieldGroup>
          </div>
          {formError ? (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={replay.isFetching}>
              Run screen
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={replay.isFetching || screen.time === "16:00"}
              onClick={() => {
                const next = new Date(
                  `${screen.session}T${screen.time}:00-04:00`,
                );
                next.setTime(next.getTime() + 60_000);
                setFormError(null);
                setScreen({ ...screen, time: clock.format(next) });
              }}
            >
              Advance result 1 minute
            </Button>
            <p className="text-sm text-muted-foreground">
              AAPL · MSFT · NVDA · SPY · IWM
            </p>
          </div>
        </form>
        <section
          aria-labelledby="results-heading"
          aria-busy={replay.isFetching}
          className="flex flex-col gap-4"
        >
          <h2 id="results-heading" className="text-xl font-medium">
            Replay results
          </h2>
          {replay.isFetching ? (
            <p role="status">Calculating historical matches...</p>
          ) : null}
          {replay.error ? (
            <Alert variant="destructive">
              <AlertTitle>Replay unavailable</AlertTitle>
              <AlertDescription>{replay.error.message}</AlertDescription>
            </Alert>
          ) : null}
          {result && !replay.error ? (
            <>
              <div
                className="flex flex-wrap items-center justify-between gap-3"
                aria-live="polite"
              >
                <p>
                  {result.matchCount} matching · {result.excludedCount} excluded
                  for missing data ·{" "}
                  {5 - result.matchCount - result.excludedCount} not matching
                </p>
                <p className="text-sm text-muted-foreground">
                  {result.input.session} · {result.input.time} New York
                </p>
              </div>
              <Table>
                <TableCaption>
                  Price {result.input.comparison} SMA {result.input.period} ·{" "}
                  {result.input.timeframe} candles · SMA source{" "}
                  {result.smaDataset} · Price source {result.dataset} · USD.
                  {result.input.rsi
                    ? ` RSI ${result.input.rsi.period} ${result.input.rsi.comparison} ${result.input.rsi.threshold} on ${result.input.rsi.timeframe}, source ${result.rsiDataset}.`
                    : ""}
                  {result.input.relativeVolume
                    ? ` Relative volume at least ${result.input.relativeVolume.minimum}×, EQUS.MINI only.`
                    : ""}
                  Display values are rounded; comparisons use full precision.
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Instrument</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">SMA</TableHead>
                    {result.input.rsi ? (
                      <TableHead className="text-right">RSI</TableHead>
                    ) : null}
                    {result.input.relativeVolume ? (
                      <TableHead className="text-right">
                        Relative volume
                      </TableHead>
                    ) : null}
                    <TableHead>Why / candle completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((row) => (
                    <TableRow key={row.symbol}>
                      <TableCell className="font-medium">
                        {row.symbol}
                      </TableCell>
                      <TableCell>
                        {row.status === "match"
                          ? "Matches"
                          : row.status === "no-match"
                            ? "Does not match"
                            : "Excluded"}
                      </TableCell>
                      {row.status === "excluded" ? (
                        <TableCell
                          colSpan={
                            3 +
                            Number(Boolean(result.input.rsi)) +
                            Number(Boolean(result.input.relativeVolume))
                          }
                          className="whitespace-normal"
                        >
                          {row.reason}
                        </TableCell>
                      ) : (
                        <>
                          <TableCell className="text-right tabular-nums">
                            {decimal.format(row.price)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {decimal.format(row.sma)}
                          </TableCell>
                          {row.rsi ? (
                            <TableCell className="text-right tabular-nums">
                              {decimal.format(row.rsi.value)}
                            </TableCell>
                          ) : null}
                          {row.relativeVolume ? (
                            <TableCell className="text-right tabular-nums">
                              {decimal.format(row.relativeVolume.value)}×
                              <span className="block text-xs text-muted-foreground">
                                {row.relativeVolume.currentVolume.toLocaleString(
                                  "en-US",
                                )}{" "}
                                /{" "}
                                {decimal.format(
                                  row.relativeVolume.baselineVolume,
                                )}{" "}
                                avg
                              </span>
                            </TableCell>
                          ) : null}
                          <TableCell className="whitespace-normal text-muted-foreground">
                            <span className="block">
                              {row.failedConditions.length
                                ? `Not met: ${row.failedConditions.join(", ")}`
                                : "All conditions met"}
                            </span>
                            Price close{" "}
                            {clock.format(new Date(row.priceCandleEnd))} · SMA
                            candle {row.indicatorCandleEnd.slice(0, 10)}{" "}
                            {clock.format(new Date(row.indicatorCandleEnd))} New
                            York
                            {row.rsi ? (
                              <span className="block">
                                RSI candle {row.rsi.candleEnd.slice(0, 10)}{" "}
                                {clock.format(new Date(row.rsi.candleEnd))} New
                                York · Seed from{" "}
                                {row.rsi.seedStart.slice(0, 10)}{" "}
                                {clock.format(new Date(row.rsi.seedStart))}
                              </span>
                            ) : null}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
