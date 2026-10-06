import { useMemo, useState } from "react";
import { CircleAlert, RefreshCw } from "lucide-react";
import { useRequireSession } from "@/hooks/use-require-session";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { PageStatus } from "@/components/page-status";
import { AppShell } from "@/components/dashboard/app-shell";
import { Notice, PageHeading, ShellLoading } from "@/components/dashboard/desk-ui";
import { AccountsStrip } from "@/components/investments/accounts-panel";
import {
  collectDataNotes,
  DataNotes,
} from "@/components/investments/data-notes";
import {
  formatDateTime,
  formatNullableMoney,
  formatPercent,
} from "@/components/investments/format";
import { HoldingsPanel } from "@/components/investments/holdings-panel";
import { EmptyState } from "@/components/investments/panel";
import { SummaryTile } from "@/components/investments/summary";
import { TransactionsPanel } from "@/components/investments/transactions-panel";

const ALL_ACCOUNTS = "all";

export default function InvestmentsPage() {
  const utils = trpc.useUtils();
  const { session, isPending: sessionLoading } = useRequireSession();
  const [selectedAccountId, setSelectedAccountId] = useState(ALL_ACCOUNTS);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const accountsQuery = trpc.investments.getAccounts.useQuery(
    { includeInactive },
    { enabled: Boolean(session) },
  );
  const accounts = useMemo(
    () => accountsQuery.data?.accounts ?? [],
    [accountsQuery.data],
  );
  const selectedAccountIsVisible = accounts.some(
    (account) => account.accountId === selectedAccountId,
  );
  const effectiveSelectedAccountId = selectedAccountIsVisible
    ? selectedAccountId
    : ALL_ACCOUNTS;
  const accountId =
    effectiveSelectedAccountId === ALL_ACCOUNTS
      ? undefined
      : effectiveSelectedAccountId;
  const holdingsQuery = trpc.investments.getHoldings.useQuery(
    { accountId, includeInactive },
    { enabled: Boolean(session) },
  );
  const transactionsQuery = trpc.investments.getTransactions.useQuery(
    { accountId, includeInactive, limit: 50, offset: 0 },
    { enabled: Boolean(session) },
  );
  const syncMutation = trpc.investments.sync.useMutation({
    onMutate: () => setPageError(null),
    onSuccess: async () => {
      await utils.investments.invalidate();
    },
    onError: (error) => {
      setPageError(error.message ?? "Investment sync failed.");
    },
  });

  const holdings = holdingsQuery.data?.holdings ?? [];
  const transactions = transactionsQuery.data?.transactions ?? [];
  const portfolioTotals = holdingsQuery.data?.totals;
  const lastSyncedAt = useMemo(() => {
    const latest = accounts
      .map((account) => account.lastSyncedAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1);
    return latest ?? null;
  }, [accounts]);
  const selectedAccount = accounts.find(
    (account) => account.accountId === effectiveSelectedAccountId,
  );
  const hasInvestmentAccounts = accounts.length > 0;
  const isFetching =
    accountsQuery.isFetching ||
    holdingsQuery.isFetching ||
    transactionsQuery.isFetching;
  const errorMessage =
    accountsQuery.error?.message ??
    holdingsQuery.error?.message ??
    transactionsQuery.error?.message ??
    pageError ??
    null;
  const notes = collectDataNotes(portfolioTotals, holdings);

  if (sessionLoading || (accountsQuery.isLoading && !accountsQuery.data)) {
    return (
      <AppShell>
        <ShellLoading label="Loading your portfolio…" />
      </AppShell>
    );
  }

  if (!session) {
    return <PageStatus label="Redirecting…" />;
  }

  return (
    <AppShell
      actions={
        <>
          {isFetching ? (
            <span className="hidden items-center gap-2 text-[12.5px] text-brass-hi sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-brass animate-pulse-dot" />
              Updating
            </span>
          ) : null}
          <label className="btn-soft hidden cursor-pointer sm:inline-flex">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
              className="size-3.5 accent-[var(--brass)]"
            />
            Show inactive
          </label>
          <Button
            type="button"
            variant="ghost"
            disabled={syncMutation.isPending || !hasInvestmentAccounts}
            onClick={() => syncMutation.mutate({})}
            className="btn-soft"
          >
            <RefreshCw
              className={`size-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`}
            />
            {syncMutation.isPending ? "Syncing…" : "Sync"}
          </Button>
        </>
      }
    >
      <PageHeading
        kicker={
          lastSyncedAt
            ? `Last synced ${formatDateTime(lastSyncedAt)}`
            : "Not synced yet"
        }
        title={
          <>
            Your <span className="italic text-brass-hi">portfolio.</span>
          </>
        }
        description="Positions and activity from your connected investment accounts. This page shows your accounts and does not place trades."
      />

      {errorMessage ? (
        <Notice tone="error" icon={<CircleAlert />}>
          {errorMessage}
        </Notice>
      ) : null}

      {!hasInvestmentAccounts ? (
        <EmptyState
          title="No investment accounts linked"
          body="Connect an investment account from the connections page, then return here after the first sync."
          actionHref="/settings/connections"
          actionLabel="Open connections"
        />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryTile
              label="Market value"
              value={formatNullableMoney(portfolioTotals?.totalValueUsd)}
              detail={
                selectedAccount
                  ? selectedAccount.accountName
                  : `${accounts.length} account${accounts.length === 1 ? "" : "s"}, ${holdings.length} holding${holdings.length === 1 ? "" : "s"}`
              }
            />
            <SummaryTile
              label="Cost basis"
              value={formatNullableMoney(portfolioTotals?.totalCostBasisUsd)}
              detail={
                portfolioTotals?.costBasisAvailable
                  ? "Reported by institution"
                  : "Incomplete"
              }
            />
            <SummaryTile
              label="Gain / loss"
              value={formatNullableMoney(
                portfolioTotals?.totalGainLossUsd,
                true,
              )}
              detail={formatPercent(portfolioTotals?.totalGainLossPct)}
              tone={
                Number(portfolioTotals?.totalGainLossUsd ?? 0) < 0
                  ? "oxide"
                  : "sage"
              }
            />
            <SummaryTile
              label="Activity"
              value={`${transactionsQuery.data?.totalCount ?? 0}`}
              detail="Investment transactions on record"
            />
          </section>

          <DataNotes notes={notes} />

          <AccountsStrip
            accounts={accounts}
            selectedAccountId={effectiveSelectedAccountId}
            onSelect={setSelectedAccountId}
          />

          <HoldingsPanel
            holdings={holdings}
            loading={holdingsQuery.isLoading}
          />

          <TransactionsPanel
            transactions={transactions}
            totalCount={transactionsQuery.data?.totalCount ?? 0}
            loading={transactionsQuery.isLoading}
          />
        </div>
      )}
    </AppShell>
  );
}
