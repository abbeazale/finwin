import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import {
  getPageSession,
  getUserProfile,
  hasCompletedOnboarding,
} from "@/lib/page-auth";
import { formatBudgetStatus } from "@/lib/budget-status";
import { trpc } from "@/lib/trpc";
import { getInitialDashboardMonth } from "@/server/dashboard/initial-month";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AppShell } from "@/components/dashboard/app-shell";
import {
  EmptyPanel,
  MonthSwitcher,
  PanelHeading,
  panelLinkClass,
} from "@/components/dashboard/desk-ui";
import { ConnectBank } from "@/components/connect-bank";
import { RefreshTransactions } from "@/components/refresh-transactions";
import {
  formatMonthHeading,
  getMonthStartForTimeZone,
} from "@/lib/date";
import { resolveProfileTimeZone } from "@/lib/locale";
import {
  DashboardOverviewCards,
  LegendDot,
  formatDelta,
  formatMoney,
  formatPercent,
  formatDateTile,
  formatSignedMoney,
  formatTooltipLabel,
  getMetricTone,
  getSignalCopy,
} from "@/components/dashboard/metrics";
import { useState } from "react";
import {
  ChevronRight,
  CircleCheck,
  CircleDollarSign,
  Settings,
  Target,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { getBankLinkNotice } from "@/lib/bank-connection-status";
import { CityGlow } from "@/components/dashboard/city-glow";

const cashflowChartConfig = {
  inflow: { label: "Inflow", color: "var(--chart-2)" },
  outflow: { label: "Outflow", color: "var(--brass-lo)" },
} satisfies ChartConfig;

type DashboardProps = {
  firstName: string;
  currency: string;
  initialMonth: string;
};

export default function Dashboard({
  firstName,
  currency,
  initialMonth,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const utils = trpc.useUtils();
  const [month, setMonth] = useState(initialMonth);
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [connectionErrorMessage, setConnectionErrorMessage] = useState<string | null>(null);

  const overviewQuery = trpc.dashboard.overview.useQuery({ month });
  const cashflowQuery = trpc.dashboard.cashflow.useQuery({ month });
  const spendingQuery = trpc.dashboard.spendingByCategory.useQuery({ month });
  const recentTransactionsQuery = trpc.dashboard.recentTransactions.useQuery({
    month,
  });
  const budgetsQuery = trpc.budgets.summary.useQuery({ month });

  const dashboardBudgetRows = (budgetsQuery.data?.groups ?? [])
    .flatMap((group) => group.rows)
    .filter((row) => Number(row.actualAmount) > 0 || row.budgetAmount !== null)
    .sort((left, right) => {
      const leftMax = Math.max(
        Number(left.actualAmount),
        Number(left.budgetAmount ?? 0),
      );
      const rightMax = Math.max(
        Number(right.actualAmount),
        Number(right.budgetAmount ?? 0),
      );
      return rightMax - leftMax;
    })
    .slice(0, 5);

  const overview = overviewQuery.data;
  const spendingRows = spendingQuery.data?.rows ?? [];
  const recentRows = recentTransactionsQuery.data?.rows ?? [];
  const topSpendRow = spendingRows[0] ?? null;
  const savingsRate = overview?.totals.savingsRate ?? null;
  const queryError =
    overviewQuery.error?.message ??
    cashflowQuery.error?.message ??
    spendingQuery.error?.message ??
    recentTransactionsQuery.error?.message ??
    budgetsQuery.error?.message ??
    null;
  const bannerMessage = pageMessage ?? queryError;

  const overviewCards = [
    {
      key: "inflow",
      label: "Money in",
      value: Number(overview?.totals.inflow ?? 0),
      delta: overview?.deltas.inflow ?? null,
      positiveTone: getMetricTone("inflow", overview?.deltas.inflow ?? null),
    },
    {
      key: "outflow",
      label: "Money out",
      value: Number(overview?.totals.outflow ?? 0),
      delta: overview?.deltas.outflow ?? null,
      positiveTone: getMetricTone("outflow", overview?.deltas.outflow ?? null),
    },
    {
      key: "net",
      label: "Net",
      value: Number(overview?.totals.netCashflow ?? 0),
      delta: overview?.deltas.netCashflow ?? null,
      positiveTone: getMetricTone(
        "netCashflow",
        overview?.deltas.netCashflow ?? null,
      ),
    },
  ];

  const cashflowChartData = (cashflowQuery.data?.days ?? []).map((day) => ({
    date: day.date,
    inflow: Number(day.inflowAmount),
    outflow: Number(day.outflowAmount),
  }));
  const hasCashflow = cashflowChartData.some(
    (day) => day.inflow > 0 || day.outflow > 0,
  );

  async function invalidateDashboard() {
    await Promise.all([
      utils.dashboard.overview.invalidate(),
      utils.dashboard.cashflow.invalidate(),
      utils.dashboard.spendingByCategory.invalidate(),
      utils.dashboard.recentTransactions.invalidate(),
      utils.budgets.summary.invalidate(),
    ]);
  }

  return (
    <AppShell
      firstName={firstName}
      actions={
        <>
          <RefreshTransactions
            onRefreshed={async (result) => {
              await invalidateDashboard();
              if (result.hasConnectionErrors) {
                setConnectionErrorMessage("One or more bank imports failed.");
                setPageMessage(null);
              } else {
                setConnectionErrorMessage(null);
                setPageMessage(
                  `Sync: +${result.added} · ~${result.modified} · -${result.removed}`,
                );
              }
            }}
          />
          <ConnectBank
            className="btn-brass-fill h-[38px] px-4"
            onConnected={async (result) => {
              await invalidateDashboard();
              const notice = getBankLinkNotice(result);
              if (notice.tone === "warn") {
                setConnectionErrorMessage(notice.text);
                setPageMessage(null);
                return;
              }
              setConnectionErrorMessage(null);
              setPageMessage(notice.text);
            }}
          />
        </>
      }
    >
      <header className="mb-10 flex flex-wrap items-end justify-between gap-8 animate-fade-slide">
        <div>
          <p className="display text-[15px] italic leading-none text-bone-faint">
            {formatMonthHeading(month)}
            {overview?.comparisonAvailable
              ? `, compared with ${formatMonthHeading(overview.comparisonMonth)}`
              : null}
          </p>
          <h1 className="display mt-4 text-[clamp(2.6rem,4.4vw,3.9rem)] leading-[1.02] text-bone">
            Welcome back,{" "}
            <span className="italic text-brass-hi">{firstName}.</span>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-[1.7] text-bone-mute">
            What came in, what went out, and where the budget is tight
            this month.
          </p>
        </div>

        <MonthSwitcher month={month} onChange={setMonth} />
      </header>

      {connectionErrorMessage ? (
        <Alert variant="destructive" className="mb-6 rounded-[14px]">
          <TriangleAlert />
          <AlertTitle>Bank import needs attention</AlertTitle>
          <AlertDescription>
            <p>
              {connectionErrorMessage}{" "}
              <Link href="/settings/connections" className="underline underline-offset-2">
                Open Connections to retry.
              </Link>
            </p>
          </AlertDescription>
        </Alert>
      ) : bannerMessage ? (
        <Alert className="mb-6 rounded-[14px]">
          <CircleCheck />
          <AlertDescription>{bannerMessage}</AlertDescription>
        </Alert>
      ) : null}

      {overview && overview.excludedCurrencyTransactionCount > 0 ? (
        <p className="mb-6 flex items-center gap-3 rounded-[14px] border border-[var(--stroke-brass-hi)] bg-[rgba(201,164,107,0.05)] px-4 py-3 text-[13px] text-brass-hi">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brass" />
          {overview.excludedCurrencyTransactionCount} transaction
          {overview.excludedCurrencyTransactionCount === 1 ? "" : "s"} in
          other currencies excluded; this dashboard is reported in{" "}
          {currency} without FX conversion.
        </p>
      ) : null}

      <DashboardOverviewCards
        cards={overviewCards}
        comparisonAvailable={overview?.comparisonAvailable ?? false}
        comparisonMonth={overview?.comparisonMonth ?? month}
        currency={currency}
        isLoading={overviewQuery.isLoading}
      />

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="desk-panel flex flex-col">
          <PanelHeading
            title="Cashflow"
            detail={
              overview
                ? `${formatSignedMoney(Number(overview.totals.netCashflow), currency)} net this month`
                : "Loading this month’s cashflow…"
            }
            action={
              <div className="flex items-center gap-4 pt-1">
                <LegendDot label="In" color="var(--chart-2)" />
                <LegendDot label="Out" color="var(--brass-lo)" />
              </div>
            }
          />
          <div className="flex-1 px-6 pb-6 pt-4">
            {cashflowQuery.isLoading ? (
              <EmptyPanel>Loading daily money in and out…</EmptyPanel>
            ) : hasCashflow ? (
              <ChartContainer
                config={cashflowChartConfig}
                className="min-h-[260px] w-full"
              >
                <BarChart
                  accessibilityLayer
                  data={cashflowChartData}
                  margin={{ left: 4, right: 4 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="2 6" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={22}
                    tickMargin={10}
                    tickFormatter={(value) => value.slice(8)}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={formatTooltipLabel}
                      />
                    }
                  />
                  <Bar
                    dataKey="inflow"
                    radius={4}
                    fill="var(--color-inflow)"
                  />
                  <Bar
                    dataKey="outflow"
                    radius={4}
                    fill="var(--color-outflow)"
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <EmptyPanel>No money in or out for this month yet.</EmptyPanel>
            )}
          </div>
        </div>

        <div className="desk-panel flex flex-col">
          <PanelHeading
            title="Recent activity"
            detail="The latest transactions this month"
            action={
              <Link href="/transactions" className={panelLinkClass}>
                See all →
              </Link>
            }
          />
          {recentTransactionsQuery.isLoading ? (
            <p className="px-6 pb-6 pt-2 text-[13px] text-bone-mute">
              Loading recent transactions…
            </p>
          ) : recentRows.length > 0 ? (
            <ul className="px-3 pb-3 pt-1">
              {recentRows.map((row) => {
                const amount = Number(row.amount);
                const positive = amount > 0;
                const tile = formatDateTile(row.date);
                return (
                  <li
                    key={row.id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-[12px] px-3 py-2.5 transition-colors hover:bg-[rgba(232,225,210,0.03)]"
                  >
                    <div className="flex size-11 flex-col items-center justify-center rounded-[11px] border border-[var(--stroke)] bg-[var(--ink-0)]">
                      <span className="text-[9.5px] leading-none text-bone-faint">
                        {tile.month}
                      </span>
                      <span className="display mt-0.5 text-[18px] leading-none text-bone">
                        {tile.day}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] text-bone">
                        {row.merchantName ?? row.name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-[12px] text-bone-faint">
                          {row.categoryName}
                        </span>
                        {row.pending ? (
                          <span className="pill pill--soft pill-amber">Pending</span>
                        ) : null}
                        {!row.accountIsActive ? (
                          <span className="pill pill--soft pill-bone">History</span>
                        ) : null}
                      </div>
                    </div>
                    <span
                      className={`num text-[13px] ${
                        positive ? "text-sage-hi" : "text-bone"
                      }`}
                    >
                      {formatSignedMoney(amount, row.currency)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-6 pb-6 pt-2 text-[13px] text-bone-mute">
              No transactions for {formatMonthHeading(month)} yet.
            </p>
          )}
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="desk-panel">
          <PanelHeading
            title="Budgets"
            detail={
              budgetsQuery.data ? (
                <>
                  <span className="text-oxide-hi">
                    {budgetsQuery.data.totals.overBudgetCount} over
                  </span>
                  {" · "}
                  <span className="text-amber">
                    {budgetsQuery.data.totals.unbudgetedCount} without a
                    target
                  </span>
                  {" · "}
                  {dashboardBudgetRows.length} shown
                </>
              ) : budgetsQuery.isLoading ? (
                "Loading budgets…"
              ) : (
                "No budget activity yet."
              )
            }
            action={
              <Link href="/budgets" className="btn-soft">
                <CircleDollarSign className="size-3.5" />
                Adjust
              </Link>
            }
          />
          {budgetsQuery.isLoading ? (
            <p className="px-6 pb-6 pt-2 text-[13px] text-bone-mute">
              Loading budget rows…
            </p>
          ) : dashboardBudgetRows.length > 0 ? (
            <div className="flex flex-col gap-5 px-6 pb-7 pt-3">
              {dashboardBudgetRows.map((row) => {
                const budget = Number(row.budgetAmount ?? 0);
                const actual = Number(row.actualAmount);
                const percent =
                  budget > 0 ? Math.min((actual / budget) * 100, 150) : 0;
                const overflow = budget > 0 && actual > budget;
                const barColor =
                  row.status === "over"
                    ? "var(--oxide)"
                    : row.status === "near_limit" ||
                        row.status === "unbudgeted"
                      ? "var(--amber)"
                      : "var(--sage)";
                const pillClass =
                  row.status === "over"
                    ? "pill-oxide"
                    : row.status === "near_limit" ||
                        row.status === "unbudgeted"
                      ? "pill-amber"
                      : "pill-sage";
                const statusLabel = formatBudgetStatus(row.status);

                return (
                  <div key={row.categoryId}>
                    <div className="mb-2.5 flex items-center justify-between gap-4">
                      <div className="flex min-w-0 items-baseline gap-3">
                        <span className="truncate text-[14px] text-bone">
                          {row.categoryName}
                        </span>
                        <span className="num shrink-0 text-[11.5px] text-bone-mute">
                          {formatMoney(actual, currency, 0)}{" "}
                          <span className="text-bone-faint">
                            of{" "}
                            {budget > 0
                              ? formatMoney(budget, currency, 0)
                              : "no target"}
                          </span>
                        </span>
                      </div>
                      <span className={`pill pill--soft ${pillClass}`}>
                        {statusLabel}
                      </span>
                    </div>
                    <div className="relative h-1.5 overflow-hidden rounded-full bg-[var(--ink-0)]">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min(percent, 100)}%`,
                          background: barColor,
                          boxShadow: `0 0 10px -2px ${barColor}`,
                        }}
                      />
                      {overflow ? (
                        <div
                          className="absolute inset-y-0 right-0 w-1 rounded-full"
                          style={{
                            background: "var(--oxide-hi)",
                            boxShadow: "0 0 8px var(--oxide-hi)",
                          }}
                        />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="px-6 pb-6 pt-2 text-[13px] text-bone-mute">
              No budgets yet. Set monthly targets on the Budgets page.
            </p>
          )}
        </div>

        <div className="desk-panel">
          <PanelHeading
            title="Where it went"
            detail={
              spendingQuery.data
                ? `${formatMoney(Number(spendingQuery.data.totals.totalTrackedSpend), currency, 0)} across ${spendingQuery.data.totals.categoryCount} categories`
                : "Loading spending by category…"
            }
            action={
              <Link href="/transactions" className={panelLinkClass}>
                Recategorize →
              </Link>
            }
          />
          {spendingQuery.isLoading ? (
            <p className="px-6 pb-6 pt-2 text-[13px] text-bone-mute">
              Loading category spending…
            </p>
          ) : spendingRows.length > 0 ? (
            <div className="flex flex-col gap-5 px-6 pb-7 pt-3">
              {spendingRows.map((row) => {
                const share = row.shareOfTotal ?? 0;
                return (
                  <div
                    key={`${row.categoryId ?? "uncategorized"}-${row.categoryName}`}
                  >
                    <div className="mb-2.5 flex items-baseline justify-between gap-4">
                      <p className="min-w-0 truncate text-[14px] text-bone">
                        {row.categoryName}
                        <span className="ml-2 text-[12px] text-bone-faint">
                          {row.groupName}
                        </span>
                      </p>
                      <span className="num shrink-0 text-[12.5px] text-bone">
                        {formatMoney(
                          Number(row.spendAmount),
                          currency,
                          0,
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--ink-0)]">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[var(--brass-lo)] to-[var(--brass-hi)]"
                          style={{
                            width: `${Math.max(share * 100, 6)}%`,
                          }}
                        />
                      </div>
                      <span className="num w-9 text-right text-[11px] text-bone-faint">
                        {share > 0 ? `${Math.round(share * 100)}%` : "0%"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="px-6 pb-6 pt-2 text-[13px] text-bone-mute">
              No spending recorded for {formatMonthHeading(month)}.
            </p>
          )}
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="desk-panel desk-panel--warm px-8 pb-32 pt-8">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 80% 120%, rgba(255,154,60,0.14), transparent 55%), radial-gradient(ellipse at 10% -20%, rgba(232,199,145,0.07), transparent 50%)",
            }}
          />
          <CityGlow />
          <div className="relative">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <h2 className="display text-[17px] italic leading-none text-brass-hi">
                The month, in brief
              </h2>
              <span className="text-[13px] text-bone-mute">
                {savingsRate === null
                  ? "No savings rate yet"
                  : `${formatPercent(savingsRate)} saved`}
              </span>
            </div>
            <p className="display mt-6 max-w-3xl text-[clamp(1.45rem,2.2vw,1.85rem)] leading-[1.35] text-bone">
              {getSignalCopy({
                month,
                currency,
                overview,
                topSpendRow,
                budgetsQueryData: budgetsQuery.data ?? null,
              })}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-2">
              <span className="pill pill--soft pill-brass">
                {overview?.comparisonAvailable
                  ? `${formatDelta(overview.deltas.netCashflow)} net vs last month`
                  : "No earlier month to compare"}
              </span>
              <span className="pill pill--soft pill-bone">
                {budgetsQuery.data
                  ? `${budgetsQuery.data.totals.overBudgetCount} over · ${budgetsQuery.data.totals.unbudgetedCount} without a target`
                  : "Loading budgets…"}
              </span>
            </div>
          </div>
        </div>

        <div className="desk-panel p-6">
          <h2 className="display px-2 pt-2 text-[24px] leading-none text-bone">
            Shortcuts
          </h2>
          <ul className="mt-5 flex flex-col gap-1">
            {shortcuts.map((action) => (
              <li key={action.label}>
                <Link
                  href={action.href}
                  className="group flex items-center gap-4 rounded-[12px] px-2 py-2.5 transition-colors hover:bg-[rgba(232,225,210,0.04)]"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-brass)] bg-[rgba(201,164,107,0.06)] text-brass transition-colors group-hover:border-[var(--stroke-brass-hi)] group-hover:text-brass-hi">
                    <action.icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] text-bone">
                      {action.label}
                    </span>
                    <span className="block truncate text-[12px] text-bone-faint">
                      {action.detail}
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-bone-faint transition-all group-hover:translate-x-0.5 group-hover:text-brass-hi" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="mt-14 flex flex-wrap items-baseline justify-between gap-4 border-t border-[var(--stroke)] pt-6">
        <span className="text-[12px] text-bone-faint">
          Figures in {currency}, from your imported transactions.
        </span>
        <span className="display text-[14px] italic leading-none text-bone-faint">
          est. mmxxvi
        </span>
      </footer>
    </AppShell>
  );
}

const shortcuts = [
  {
    icon: Wallet,
    label: "Review transactions",
    detail: "Check categories and pending items",
    href: "/transactions",
  },
  {
    icon: Target,
    label: "Adjust budgets",
    detail: "Move this month’s targets",
    href: "/budgets",
  },
  {
    icon: Settings,
    label: "Manage connections",
    detail: "Reconnect or add a bank",
    href: "/settings/connections",
  },
];

export const getServerSideProps: GetServerSideProps<DashboardProps> = async (
  context,
) => {
  const session = await getPageSession(context);

  if (!session) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  const profile = await getUserProfile(session.user.id);

  if (!hasCompletedOnboarding(profile)) {
    return { redirect: { destination: "/onboarding", permanent: false } };
  }

  const timeZone = resolveProfileTimeZone(profile?.timezone);
  const currentMonth = getMonthStartForTimeZone(new Date(), timeZone);
  const initialMonth = await getInitialDashboardMonth(
    session.user.id,
    currentMonth,
  );

  return {
    props: {
      firstName: profile?.firstName ?? "there",
      currency: profile?.currency ?? "CAD",
      initialMonth,
    },
  };
};
