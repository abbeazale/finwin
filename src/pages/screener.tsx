import { useState } from "react";
import { skipToken } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageStatus } from "@/components/page-status";
import { AppShell } from "@/components/dashboard/app-shell";
import { PageHeading, ShellLoading } from "@/components/dashboard/desk-ui";
import {
  initialChartSettings,
  toChartInput,
  type ChartSettings,
} from "@/components/screener/chart-settings";
import { ResearchPanel } from "@/components/screener/research-panel";
import { ResultsTable } from "@/components/screener/results-table";
import { ScreenForm } from "@/components/screener/screen-form";
import { useRequireSession } from "@/hooks/use-require-session";
import { sessionsBetween } from "@/lib/market-calendar";
import {
  nextReplayMinute,
  type ReplayInput,
  type ReplaySymbol,
} from "@/lib/screener-replay";
import { trpc } from "@/lib/trpc";

export default function ScreenerPage() {
  const { session, isPending } = useRequireSession();
  const [chosen, setScreen] = useState<ReplayInput | null>(null);
  // Chart state lives outside the keyed form so screen changes keep the
  // selection and the chart settings the user has explored.
  const [selected, setSelected] = useState<ReplaySymbol | null>(null);
  const [chartSettings, setChartSettings] = useState<ChartSettings | null>(
    null,
  );
  const capabilities = trpc.screener.capabilities.useQuery(undefined, {
    enabled: Boolean(session),
    retry: false,
    staleTime: 60_000,
  });
  // Until the user runs a screen, start at 10:30 on the latest stored session.
  const stored = capabilities.data?.sessions ?? null;
  const screen: ReplayInput | null =
    chosen ?? (stored ? { session: stored.through, time: "10:30" } : null);
  const sessions = stored
    ? sessionsBetween(stored.from, stored.through).reverse()
    : [];
  const replay = trpc.screener.replay.useQuery(screen ?? skipToken, {
    enabled: Boolean(session),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const chart = trpc.screener.chart.useQuery(
    session && screen && selected && chartSettings
      ? toChartInput(selected, screen, chartSettings)
      : skipToken,
    { retry: false, staleTime: Infinity, refetchOnWindowFocus: false },
  );

  function handleSelect(symbol: ReplaySymbol) {
    if (!screen) return;
    if (!chartSettings) setChartSettings(initialChartSettings(screen));
    setSelected(symbol);
  }

  function handleRun(next: ReplayInput) {
    if (JSON.stringify(next) === JSON.stringify(screen)) void replay.refetch();
    setScreen(next);
  }

  function handleAdvance() {
    if (!screen) return;
    const next = nextReplayMinute(screen.session, screen.time);
    if (!next) return;
    setScreen({ ...screen, time: next });
  }

  if (isPending) {
    return (
      <AppShell>
        <ShellLoading label="Preparing the screener…" />
      </AppShell>
    );
  }
  if (!session) return <PageStatus label="Redirecting…" />;
  const result = replay.data;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeading
          kicker="Historical replay of AAPL, MSFT, NVDA, SPY and IWM"
          title={
            <>
              Stock <span className="italic text-brass-hi">screener.</span>
            </>
          }
          description="Pick a past trading minute and a set of filters, and see which instruments matched at that moment."
        />
        {/* The data limits matter, but they are reference material. They open
            on demand instead of standing between the user and the controls. */}
        <details className="panel -mt-4 px-5 py-4 text-sm">
          <summary className="cursor-pointer text-muted-foreground marker:text-[var(--bone-faint)]">
            Recorded prices, no live quotes — how the replay data works
          </summary>
          <div className="mt-3 flex flex-col gap-2 text-muted-foreground">
            <p>
              Price is the last completed one-minute close, and indicators use
              completed candles only. Prices and volume come from Massive
              minute bars, regular session only; daily indicators and daily
              change use Massive daily bars of earlier sessions. New sessions
              arrive after each market close.
            </p>
            <p>
              Intraday indicators start from the 60 sessions before the chosen
              day, daily indicators from the 300 before it. Prices are
              unadjusted. News comes from Finnhub’s archive, filtered by
              publication time; later archive corrections can still be present.
            </p>
            <p>
              Paper trading is unavailable in replay, and full US stock coverage
              is not connected yet.
            </p>
          </div>
        </details>
        {capabilities.data && !stored ? (
          <Alert variant="destructive">
            <AlertTitle>Market data unavailable</AlertTitle>
            <AlertDescription>
              The market-data server could not be reached or has no stored
              sessions yet. Check that it is running and online.
            </AlertDescription>
          </Alert>
        ) : null}
        {screen ? (
          <ScreenForm
            key={JSON.stringify(screen)}
            initial={screen}
            sessions={sessions}
            capabilities={capabilities.data}
            isFetching={replay.isFetching}
            canAdvance={nextReplayMinute(screen.session, screen.time) !== null}
            onRun={handleRun}
            onAdvance={handleAdvance}
          />
        ) : null}
        <section
          aria-labelledby="results-heading"
          aria-busy={replay.isFetching}
          className="flex min-w-0 flex-col gap-4"
        >
          <h2 id="results-heading" className="sr-only">
            Replay results
          </h2>
          {replay.isFetching ? (
            <p role="status" className="text-sm text-muted-foreground">
              Calculating historical matches...
            </p>
          ) : null}
          {replay.error ? (
            <Alert variant="destructive">
              <AlertTitle>Replay unavailable</AlertTitle>
              <AlertDescription>{replay.error.message}</AlertDescription>
            </Alert>
          ) : null}
          {result && !replay.error ? (
            <ResultsTable
              result={result}
              selected={selected}
              onSelect={handleSelect}
            />
          ) : null}
          {result && !replay.error && !selected ? (
            <p className="text-sm text-muted-foreground">
              Select a symbol to see its price history up to this minute.
            </p>
          ) : null}
        </section>
        {screen && selected && chartSettings ? (
          <ResearchPanel
            symbol={selected}
            screen={screen}
            row={result?.rows.find((row) => row.symbol === selected)}
            screenDatasets={result}
            settings={chartSettings}
            onSettings={setChartSettings}
            onReset={() => setChartSettings(initialChartSettings(screen))}
            onClose={() => setSelected(null)}
            data={chart.data}
            error={chart.error?.message ?? null}
            isFetching={chart.isFetching}
            onRetry={() => void chart.refetch()}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
