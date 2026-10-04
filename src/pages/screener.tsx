import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageStatus } from "@/components/page-status";
import { AppShell } from "@/components/dashboard/app-shell";
import { PageHeading, ShellLoading } from "@/components/dashboard/desk-ui";
import { ResultsTable } from "@/components/screener/results-table";
import { ScreenForm } from "@/components/screener/screen-form";
import { useRequireSession } from "@/hooks/use-require-session";
import { nextReplayMinute, type ReplayInput } from "@/lib/screener-replay";
import { trpc } from "@/lib/trpc";

const initialScreen: ReplayInput = {
  session: "2026-09-15",
  time: "10:30",
};

export default function ScreenerPage() {
  const { session, isPending } = useRequireSession();
  const [screen, setScreen] = useState(initialScreen);
  const capabilities = trpc.screener.capabilities.useQuery(undefined, {
    enabled: Boolean(session),
    retry: false,
    staleTime: 60_000,
  });
  const replay = trpc.screener.replay.useQuery(screen, {
    enabled: Boolean(session),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  function handleRun(next: ReplayInput) {
    if (JSON.stringify(next) === JSON.stringify(screen)) void replay.refetch();
    setScreen(next);
  }

  function handleAdvance() {
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
              completed candles only. Intraday prices and volume come from
              EQUS.MINI; daily indicators come from EQUS.SUMMARY of prior
              sessions.
            </p>
            <p>
              Prices are unadjusted and volume covers the MINI feed only. News
              comes from Finnhub’s archive, filtered by publication time; later
              archive corrections can still be present.
            </p>
            <p>
              Paper trading is unavailable in replay, and full US stock coverage
              is not connected yet.
            </p>
          </div>
        </details>
        <ScreenForm
          key={JSON.stringify(screen)}
          initial={screen}
          capabilities={capabilities.data}
          isFetching={replay.isFetching}
          canAdvance={screen.time !== "16:00"}
          onRun={handleRun}
          onAdvance={handleAdvance}
        />
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
          {result && !replay.error ? <ResultsTable result={result} /> : null}
        </section>
      </div>
    </AppShell>
  );
}
