import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CircleAlert,
  Landmark,
  RefreshCw,
  ShieldAlert,
  WalletCards,
} from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { PageStatus } from "@/components/page-status";
import { formatCurrency } from "@/lib/currency";

type Account = RouterOutputs["investments"]["getAccounts"]["accounts"][number];
type Holding = RouterOutputs["investments"]["getHoldings"]["holdings"][number];
type InvestmentTransaction =
  RouterOutputs["investments"]["getTransactions"]["transactions"][number];

const ALL_ACCOUNTS = "all";

export default function InvestmentsPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: session, isPending: sessionLoading } = useSession();
  const [selectedAccountId, setSelectedAccountId] = useState(ALL_ACCOUNTS);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionLoading && !session) {
      router.push("/login");
    }
  }, [router, session, sessionLoading]);

  const accountsQuery = trpc.investments.getAccounts.useQuery(
    { includeInactive },
    { enabled: Boolean(session) },
  );
  const accounts = useMemo(() => accountsQuery.data?.accounts ?? [], [accountsQuery.data]);
  const selectedAccountIsVisible = accounts.some((account) => account.accountId === selectedAccountId);
  const effectiveSelectedAccountId = selectedAccountIsVisible ? selectedAccountId : ALL_ACCOUNTS;
  const accountId = effectiveSelectedAccountId === ALL_ACCOUNTS ? undefined : effectiveSelectedAccountId;
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
  const selectedAccount = accounts.find((account) => account.accountId === effectiveSelectedAccountId);
  const stalePriceCount = holdings.filter((holding) => isStaleDate(holding.institutionPriceAsOf)).length;
  const missingCostBasisCount = holdings.filter((holding) => holding.costBasisNative === null).length;
  const closePriceFallbackCount = holdings.filter((holding) => holding.priceSource === "close").length;
  const missingPriceCount = holdings.filter((holding) => holding.priceSource === "missing").length;
  const hasInvestmentAccounts = accounts.length > 0;

  if (sessionLoading || (accountsQuery.isLoading && !accountsQuery.data)) {
    return <PageStatus label="Opening portfolio ledger..." />;
  }

  if (!session) {
    return <PageStatus label="Redirecting..." />;
  }

  return (
    <div className="relative min-h-screen bg-ink-0 text-bone">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute right-[8%] top-[-12rem] h-[28rem] w-[36rem] blur-3xl"
          style={{ background: "radial-gradient(ellipse, rgba(122,154,126,0.08), transparent 62%)" }}
        />
        <div
          className="absolute bottom-[-16rem] left-[-4rem] h-[32rem] w-[42rem] blur-3xl"
          style={{ background: "radial-gradient(ellipse, rgba(201,164,107,0.08), transparent 60%)" }}
        />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 py-10 sm:px-10">
        <header className="mb-8 flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/dashboard"
              className="label-eyebrow inline-flex items-center gap-2 transition-colors hover:text-brass-hi"
            >
              <ArrowLeft className="size-3" />
              Back to desk
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              {accountsQuery.isFetching || holdingsQuery.isFetching || transactionsQuery.isFetching ? (
                <span className="label-eyebrow flex items-center gap-2 text-brass-hi">
                  <span className="h-1 w-1 rounded-full bg-brass animate-pulse-dot" />
                  Updating
                </span>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={syncMutation.isPending || !hasInvestmentAccounts}
                onClick={() => syncMutation.mutate({})}
                className="h-9 rounded border-[var(--stroke-brass-hi)] bg-[rgba(201,164,107,0.08)] px-3 text-[12px] text-brass-hi hover:bg-[rgba(201,164,107,0.14)]"
              >
                <RefreshCw className={`size-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                Sync
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <span className="label-eyebrow-brass">§ Investments</span>
              <h1 className="display mt-3 text-[clamp(2rem,4vw,3.3rem)] leading-[1] text-bone">
                Portfolio <span className="italic text-brass-hi">ledger.</span>
              </h1>
              <p className="mt-4 max-w-2xl text-[13px] leading-[1.7] text-bone-mute">
                Read-only positions and account activity from connected investment accounts.
                Prices, quantities, and cost basis stay tied to the institution sync.
              </p>
            </div>

            <div className="grid min-w-[18rem] gap-2 rounded-md border border-[var(--stroke)] bg-[var(--ink-1)] p-3 cove sm:grid-cols-[1fr_auto]">
              <label className="grid gap-1">
                <span className="label-eyebrow text-bone-faint">Account</span>
                <select
                  value={effectiveSelectedAccountId}
                  onChange={(event) => setSelectedAccountId(event.target.value)}
                  className="filter-select min-h-9"
                >
                  <option value={ALL_ACCOUNTS}>All investment accounts</option>
                  {accounts.map((account) => (
                    <option key={account.accountId} value={account.accountId}>
                      {formatAccountOption(account)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-end gap-2 pb-2 text-[12px] text-bone-mute">
                <input
                  type="checkbox"
                  checked={includeInactive}
                  onChange={(event) => setIncludeInactive(event.target.checked)}
                  className="size-4 accent-[var(--brass)]"
                />
                Inactive
              </label>
            </div>
          </div>
        </header>

        {(accountsQuery.error || holdingsQuery.error || transactionsQuery.error || pageError) ? (
          <p className="mb-6 flex items-center gap-3 rounded-md border border-[rgba(194,106,72,0.3)] bg-[rgba(194,106,72,0.06)] px-4 py-2.5 text-[12px] text-oxide-hi">
            <CircleAlert className="size-3.5 shrink-0" />
            {accountsQuery.error?.message ??
              holdingsQuery.error?.message ??
              transactionsQuery.error?.message ??
              pageError ??
              "Unknown investment error."}
          </p>
        ) : null}

        {!hasInvestmentAccounts ? (
          <EmptyState
            title="No investment accounts linked"
            body="Connect an investment account from the connections page, then return here after the first sync."
            actionHref="/settings/connections"
            actionLabel="Open connections"
          />
        ) : (
          <main className="grid gap-6">
            <section className="grid gap-4 lg:grid-cols-4">
              <SummaryTile
                label="Market value"
                value={formatNullableMoney(portfolioTotals?.totalValueUsd)}
                detail={selectedAccount ? selectedAccount.accountName : "Visible holdings"}
              />
              <SummaryTile
                label="Cost basis"
                value={formatNullableMoney(portfolioTotals?.totalCostBasisUsd)}
                detail={portfolioTotals?.costBasisAvailable ? "Reported by institution" : "Incomplete"}
              />
              <SummaryTile
                label="Gain / loss"
                value={formatNullableMoney(portfolioTotals?.totalGainLossUsd, true)}
                detail={formatPercent(portfolioTotals?.totalGainLossPct)}
                tone={Number(portfolioTotals?.totalGainLossUsd ?? 0) < 0 ? "oxide" : "sage"}
              />
              <SummaryTile
                label="Last sync"
                value={lastSyncedAt ? formatDateTime(lastSyncedAt) : "Never"}
                detail={`${holdings.length} holdings · ${transactionsQuery.data?.totalCount ?? 0} tx`}
              />
            </section>

            {portfolioTotals?.excludedHoldingCount ? (
              <Notice
                icon={<ShieldAlert className="size-4" />}
                text={`${portfolioTotals.excludedHoldingCount} holding${portfolioTotals.excludedHoldingCount === 1 ? "" : "s"} are visible below but excluded from USD market-value totals because price or FX data is missing.`}
              />
            ) : null}
            {portfolioTotals?.staleFxRateCount ? (
              <Notice
                icon={<CircleAlert className="size-4" />}
                text={`${portfolioTotals.staleFxRateCount} holding${portfolioTotals.staleFxRateCount === 1 ? " uses" : "s use"} FX rates older than 7 days.`}
              />
            ) : null}
            {missingCostBasisCount > 0 ? (
              <Notice
                icon={<CircleAlert className="size-4" />}
                text={`${missingCostBasisCount} holding${missingCostBasisCount === 1 ? "" : "s"} are missing institution cost basis, so gain/loss is suppressed instead of shown as zero.`}
              />
            ) : null}
            {closePriceFallbackCount > 0 ? (
              <Notice
                icon={<CircleAlert className="size-4" />}
                text={`${closePriceFallbackCount} holding${closePriceFallbackCount === 1 ? " is" : "s are"} using security close price because the institution holding price is zero or missing.`}
              />
            ) : null}
            {missingPriceCount > 0 ? (
              <Notice
                icon={<CircleAlert className="size-4" />}
                text={`${missingPriceCount} holding${missingPriceCount === 1 ? "" : "s"} are missing a usable institution or security close price.`}
              />
            ) : null}
            {stalePriceCount > 0 ? (
              <Notice
                icon={<CircleAlert className="size-4" />}
                text={`${stalePriceCount} holding${stalePriceCount === 1 ? " has" : "s have"} price data older than 7 days.`}
              />
            ) : null}

            <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
              <HoldingsPanel holdings={holdings} loading={holdingsQuery.isLoading} />
              <AccountsPanel accounts={accounts} />
            </section>

            <TransactionsPanel transactions={transactions} loading={transactionsQuery.isLoading} />
          </main>
        )}
      </div>
    </div>
  );
}

function HoldingsPanel({ holdings, loading }: { holdings: Holding[]; loading: boolean }) {
  return (
    <section className="overflow-hidden rounded-md border border-[var(--stroke)] bg-[var(--ink-1)] cove">
      <div className="flex items-center gap-2.5 border-b border-[var(--stroke)] px-5 py-4">
        <WalletCards className="size-4 text-brass-hi" />
        <span className="label-eyebrow-brass">Holdings</span>
        <span className="label-eyebrow ml-auto text-bone-faint">{holdings.length} rows</span>
      </div>
      {loading ? (
        <PanelStatus label="Loading holdings..." />
      ) : holdings.length === 0 ? (
        <PanelStatus label="No holdings reported for the selected account scope." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[12px]">
            <thead className="border-b border-[var(--stroke)] text-bone-faint">
              <tr>
                <th className="px-5 py-3 font-normal">Security</th>
                <th className="px-3 py-3 font-normal">Shares</th>
                <th className="px-3 py-3 font-normal">Price</th>
                <th className="px-3 py-3 font-normal">Market value</th>
                <th className="px-3 py-3 font-normal">Cost basis</th>
                <th className="px-3 py-3 font-normal">Gain/loss</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--stroke)]">
              {holdings.map((holding) => (
                <tr key={holding.holdingId} className="align-top">
                  <td className="px-5 py-4">
                    <div className="font-medium text-bone">
                      {holding.tickerSymbol ?? holding.securityName ?? "Unlabeled security"}
                    </div>
                    <div className="mt-1 text-bone-faint">
                      {holding.securityName ?? holding.securityType ?? "Unknown type"}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {holding.isCashEquivalent ? <MiniPill label="Cash" /> : null}
                      {holding.excludedFromUsd ? <MiniPill label={holding.nativeCurrency ?? "FX"} tone="amber" /> : null}
                      {holding.fxRateStale ? <MiniPill label="Stale FX" tone="amber" /> : null}
                      {holding.priceSource === "close" ? <MiniPill label="Close" tone="amber" /> : null}
                      {holding.priceSource === "missing" ? <MiniPill label="No price" tone="oxide" /> : null}
                      {isStaleDate(holding.institutionPriceAsOf) ? <MiniPill label="Stale price" tone="oxide" /> : null}
                    </div>
                  </td>
                  <td className="px-3 py-4 font-mono text-bone-mute">{trimDecimal(holding.quantity)}</td>
                  <td className="px-3 py-4">
                    <div>{formatNativeMoney(holding.institutionPriceNative, holding.priceCurrency)}</div>
                    <div className="mt-1 text-bone-faint">
                      {formatPriceDetail(holding.priceSource, holding.institutionPriceAsOf)}
                    </div>
                  </td>
                  <td className="px-3 py-4">{formatNativeMoney(holding.marketValueNative, holding.marketValueCurrency)}</td>
                  <td className="px-3 py-4">{formatNativeMoney(holding.costBasisNative, holding.costBasisCurrency)}</td>
                  <td className="px-3 py-4">
                    <div className={Number(holding.gainLossUsd ?? 0) < 0 ? "text-oxide-hi" : "text-sage-hi"}>
                      {formatNullableMoney(holding.gainLossUsd, true)}
                    </div>
                    <div className="mt-1 text-bone-faint">{formatPercent(holding.gainLossPct)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AccountsPanel({ accounts }: { accounts: Account[] }) {
  return (
    <section className="rounded-md border border-[var(--stroke)] bg-[var(--ink-1)] cove">
      <div className="flex items-center gap-2.5 border-b border-[var(--stroke)] px-5 py-4">
        <Landmark className="size-4 text-brass-hi" />
        <span className="label-eyebrow-brass">Accounts</span>
      </div>
      <div className="divide-y divide-[var(--stroke)]">
        {accounts.map((account) => (
          <div key={account.accountId} className="px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[13px] font-medium text-bone">{account.accountName}</p>
                <p className="mt-1 text-[12px] text-bone-faint">
                  {account.accountSubtype ?? "Investment"}{account.accountMask ? ` · ${account.accountMask}` : ""}
                </p>
              </div>
              {!account.isActive ? <MiniPill label="Inactive" tone="oxide" /> : null}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
              <MetricCell label="Value" value={formatNullableMoney(account.totalValueUsd)} />
              <MetricCell label="Holdings" value={`${account.holdingCount}`} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TransactionsPanel({
  transactions,
  loading,
}: {
  transactions: InvestmentTransaction[];
  loading: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-md border border-[var(--stroke)] bg-[var(--ink-1)] cove">
      <div className="flex items-center gap-2.5 border-b border-[var(--stroke)] px-5 py-4">
        <RefreshCw className="size-4 text-brass-hi" />
        <span className="label-eyebrow-brass">Investment transactions</span>
        <span className="label-eyebrow ml-auto text-bone-faint">{transactions.length} shown</span>
      </div>
      {loading ? (
        <PanelStatus label="Loading activity..." />
      ) : transactions.length === 0 ? (
        <PanelStatus label="No investment transactions reported for the selected account scope." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-[12px]">
            <thead className="border-b border-[var(--stroke)] text-bone-faint">
              <tr>
                <th className="px-5 py-3 font-normal">Date</th>
                <th className="px-3 py-3 font-normal">Activity</th>
                <th className="px-3 py-3 font-normal">Security</th>
                <th className="px-3 py-3 font-normal">Quantity</th>
                <th className="px-3 py-3 font-normal">Price</th>
                <th className="px-3 py-3 font-normal">Cash impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--stroke)]">
              {transactions.map((transaction) => (
                <tr key={transaction.transactionId}>
                  <td className="px-5 py-4 text-bone-mute">{transaction.date}</td>
                  <td className="px-3 py-4">
                    <div className="font-medium text-bone">{transaction.name}</div>
                    <div className="mt-1 text-bone-faint">
                      {transaction.type}{transaction.subtype ? ` · ${transaction.subtype}` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    {transaction.tickerSymbol ?? transaction.securityName ?? "Cash movement"}
                  </td>
                  <td className="px-3 py-4 font-mono text-bone-mute">{trimDecimal(transaction.quantity)}</td>
                  <td className="px-3 py-4">{formatNativeMoney(transaction.price, transaction.nativeCurrency)}</td>
                  <td className="px-3 py-4">
                    <div className={Number(transaction.cashImpact ?? 0) < 0 ? "text-oxide-hi" : "text-sage-hi"}>
                      {formatNativeMoney(transaction.cashImpact, transaction.nativeCurrency, true)}
                    </div>
                    {transaction.fees ? (
                      <div className="mt-1 text-bone-faint">Fees {formatNativeMoney(transaction.fees, transaction.nativeCurrency)}</div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SummaryTile({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string | null;
  tone?: "sage" | "oxide";
}) {
  return (
    <div className="rounded-md border border-[var(--stroke)] bg-[var(--ink-1)] p-4 cove">
      <p className="label-eyebrow text-bone-faint">{label}</p>
      <p className={`mt-3 font-mono text-[22px] ${tone === "oxide" ? "text-oxide-hi" : tone === "sage" ? "text-sage-hi" : "text-bone"}`}>
        {value}
      </p>
      <p className="mt-2 truncate text-[12px] text-bone-mute">{detail ?? "-"}</p>
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label-eyebrow text-bone-faint">{label}</p>
      <p className="mt-1 font-mono text-[13px] text-bone">{value}</p>
    </div>
  );
}

function MiniPill({ label, tone = "bone" }: { label: string; tone?: "bone" | "amber" | "oxide" }) {
  const className = tone === "oxide"
    ? "border-[rgba(194,106,72,0.35)] text-oxide-hi"
    : tone === "amber"
      ? "border-[rgba(212,154,74,0.35)] text-amber"
      : "border-[var(--stroke-2)] text-bone-mute";

  return (
    <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] ${className}`}>
      {label}
    </span>
  );
}

function Notice({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-[var(--stroke-brass)] bg-[rgba(201,164,107,0.06)] px-4 py-3 text-[12px] text-brass-hi">
      <span className="shrink-0">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function EmptyState({
  title,
  body,
  actionHref,
  actionLabel,
}: {
  title: string;
  body: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <section className="rounded-md border border-[var(--stroke)] bg-[var(--ink-1)] px-6 py-10 text-center cove">
      <p className="label-eyebrow-brass">{title}</p>
      <p className="mx-auto mt-3 max-w-md text-[13px] leading-6 text-bone-mute">{body}</p>
      <Link
        href={actionHref}
        className="mt-6 inline-flex h-9 items-center rounded border border-[var(--stroke-brass-hi)] bg-[rgba(201,164,107,0.08)] px-3 text-[12px] text-brass-hi transition-colors hover:bg-[rgba(201,164,107,0.14)]"
      >
        {actionLabel}
      </Link>
    </section>
  );
}

function PanelStatus({ label }: { label: string }) {
  return <div className="px-5 py-12 text-center text-[13px] text-bone-mute">{label}</div>;
}

function formatAccountOption(account: Account) {
  const suffix = account.accountMask ? ` · ${account.accountMask}` : "";
  return `${account.accountName}${suffix}${account.isActive ? "" : " · inactive"}`;
}

function formatNullableMoney(value: string | null | undefined, signed = false) {
  if (value === null || value === undefined) return "-";
  const numeric = Number(value);
  const prefix = signed && numeric > 0 ? "+" : "";
  return `${prefix}${formatMoney(numeric)}`;
}

function formatNativeMoney(value: string | null | undefined, currency: string | null, signed = false) {
  if (value === null || value === undefined) return "-";
  const numeric = Number(value);
  const prefix = signed && numeric > 0 ? "+" : "";
  return `${prefix}${formatMoney(numeric)}${currency && currency !== "USD" ? ` ${currency}` : ""}`;
}

function formatPriceDetail(source: Holding["priceSource"], asOf: string | null | undefined) {
  const label = source === "close" ? "Close" : source === "institution" ? "Institution" : "No price";
  return asOf ? `${label} · ${asOf}` : label;
}

function formatMoney(value: number) {
  return formatCurrency(value, "USD", 2, "en-US");
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function trimDecimal(value: string | null | undefined) {
  if (!value) return "-";
  return value.replace(/\.?0+$/, "");
}

function isStaleDate(value: string | null | undefined) {
  if (!value) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  const now = new Date();
  const days = (now.getTime() - date.getTime()) / 86_400_000;
  return days > 7;
}
