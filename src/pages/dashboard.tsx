import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import {
  getPageSession,
  getUserProfile,
  hasCompletedOnboarding,
} from "@/lib/page-auth";
import { signOut } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardHeader } from "@/components/dashboard/header";
import { useRouter } from "next/router";
import { useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CircleDollarSign,
  Settings,
  Target,
  Wallet,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const cashflowChartConfig = {
  inflow: { label: "Inflow", color: "var(--chart-2)" },
  outflow: { label: "Outflow", color: "var(--chart-5)" },
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
  const router = useRouter();
  const utils = trpc.useUtils();
  const [month, setMonth] = useState(initialMonth);
  const [pageMessage, setPageMessage] = useState<string | null>(null);
  const [connectionErrorBanner, setConnectionErrorBanner] = useState(false);
  const [isPending, startTransition] = useTransition();
  const initials = firstName.slice(0, 2).toUpperCase();

  const overviewQuery = trpc.dashboard.overview.useQuery({ month });
  const cashflowQuery = trpc.dashboard.cashflow.useQuery({ month });
  const spendingQuery = trpc.dashboard.spendingByCategory.useQuery({ month });
  const recentTransactionsQuery = trpc.dashboard.recentTransactions.useQuery({ month });
  const budgetsQuery = trpc.budgets.summary.useQuery({ month });

  const dashboardBudgetRows = (budgetsQuery.data?.groups ?? [])
    .flatMap((group) => group.rows)
    .filter((row) => Number(row.actualAmount) > 0 || row.budgetAmount !== null)
    .sort((left, right) => {
      const leftMax = Math.max(Number(left.actualAmount), Number(left.budgetAmount ?? 0));
      const rightMax = Math.max(Number(right.actualAmount), Number(right.budgetAmount ?? 0));
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
      label: "Inflow · M",
      value: Number(overview?.totals.inflow ?? 0),
      delta: overview?.deltas.inflow ?? null,
      positiveTone: getMetricTone("inflow", overview?.deltas.inflow ?? null),
    },
    {
      key: "outflow",
      label: "Outflow · M",
      value: Number(overview?.totals.outflow ?? 0),
      delta: overview?.deltas.outflow ?? null,
      positiveTone: getMetricTone("outflow", overview?.deltas.outflow ?? null),
    },
    {
      key: "net",
      label: "Net · M",
      value: Number(overview?.totals.netCashflow ?? 0),
      delta: overview?.deltas.netCashflow ?? null,
      positiveTone: getMetricTone("netCashflow", overview?.deltas.netCashflow ?? null),
    },
  ];

  const cashflowChartData = (cashflowQuery.data?.days ?? []).map((day) => ({
    date: day.date,
    inflow: Number(day.inflowAmount),
    outflow: Number(day.outflowAmount),
  }));
  const hasCashflow = cashflowChartData.some((day) => day.inflow > 0 || day.outflow > 0);

  async function invalidateDashboard() {
    await Promise.all([
      utils.dashboard.overview.invalidate(),
      utils.dashboard.cashflow.invalidate(),
      utils.dashboard.spendingByCategory.invalidate(),
      utils.dashboard.recentTransactions.invalidate(),
      utils.budgets.summary.invalidate(),
    ]);
  }

  async function logout() {
    setPageMessage(null);
    startTransition(async () => {
      const { error: signOutError } = await signOut();
      if (signOutError) {
        setPageMessage(signOutError.message ?? "Unable to log out.");
        return;
      }
      router.push("/login");
    });
  }

  return (
    <div className="relative min-h-screen bg-ink-0 text-bone">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute -top-40 right-[8%] h-[34rem] w-[34rem] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(232,199,145,0.05), transparent 65%)" }}
        />
        <div
          className="absolute -bottom-48 left-0 h-[32rem] w-[50rem] blur-3xl"
          style={{ background: "radial-gradient(ellipse, rgba(255,154,60,0.04), transparent 60%)" }}
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1480px]">
        <DashboardSidebar
          firstName={firstName}
          initials={initials}
          isPending={isPending}
          onLogout={logout}
        />

        <main className="flex-1 overflow-hidden">
          <DashboardHeader
            firstName={firstName}
            initials={initials}
            isPending={isPending}
            onLogout={logout}
            onRefreshed={async (result) => {
              await invalidateDashboard();
              if (result.hasConnectionErrors) {
                setConnectionErrorBanner(true);
                setPageMessage(null);
              } else {
                setConnectionErrorBanner(false);
                setPageMessage(`Sync: +${result.added} · ~${result.modified} · -${result.removed}`);
              }
            }}
            onConnected={async ({ accountCount }) => {
              await invalidateDashboard();
              setPageMessage(`Linked ${accountCount} account${accountCount === 1 ? "" : "s"}.`);
            }}
          />

          <div className="px-6 py-8 lg:px-10 lg:py-10">
            <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
              <div>
                <div className="mb-3 flex items-center gap-3">
                  <span className="label-eyebrow">Desk · {formatMonthHeading(month)}</span>
                  <span className="label-eyebrow">·</span>
                  <span className="label-eyebrow">
                    {overview?.comparisonAvailable
                      ? `vs ${formatMonthHeading(overview.comparisonMonth)}`
                      : "Live month view"}
                  </span>
                </div>
                <h1 className="display text-[clamp(2.4rem,4vw,3.4rem)] leading-[1] text-bone">
                  Ledger in <span className="italic text-brass-hi">focus.</span>
                </h1>
                <p className="mt-3 max-w-2xl text-[13px] text-bone-mute">
                  Real cashflow, recent activity, and budget pressure for {firstName}&rsquo;s current operating month.
                </p>
              </div>

              <div className="flex items-center gap-3 rounded-[2px] border border-[var(--stroke-2)] bg-[var(--ink-1)] px-3 py-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-[2px] text-bone-mute hover:bg-[var(--ink-2-solid)] hover:text-bone"
                  onClick={() => setMonth((current) => shiftMonth(current, -1))}
                >
                  <ArrowLeft className="size-3.5" />
                  <span className="sr-only">Previous month</span>
                </Button>
                <div className="min-w-[10rem] text-center">
                  <div className="label-eyebrow-brass">Operating month</div>
                  <div className="mt-1 text-[13px] text-bone">{formatMonthHeading(month)}</div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-[2px] text-bone-mute hover:bg-[var(--ink-2-solid)] hover:text-bone"
                  onClick={() => setMonth((current) => shiftMonth(current, 1))}
                >
                  <ArrowRight className="size-3.5" />
                  <span className="sr-only">Next month</span>
                </Button>
              </div>
            </header>

            {connectionErrorBanner ? (
              <p className="mb-6 flex items-center gap-3 rounded-[2px] border border-[rgba(232,140,72,0.4)] bg-[rgba(232,140,72,0.05)] px-4 py-2.5 text-[12px] text-amber">
                <span className="h-1.5 w-1.5 rounded-full bg-amber animate-pulse-dot" />
                One or more connections need attention —{" "}
                <Link href="/settings/connections" className="underline underline-offset-2 hover:text-bone">
                  visit Connections to re-link.
                </Link>
              </p>
            ) : bannerMessage ? (
              <p className="mb-6 flex items-center gap-3 rounded-[2px] border border-[var(--stroke-brass-hi)] bg-[rgba(201,164,107,0.05)] px-4 py-2.5 text-[12px] text-brass-hi">
                <span className="h-1.5 w-1.5 rounded-full bg-brass animate-pulse-dot" />
                {bannerMessage}
              </p>
            ) : null}

            <section className="grid gap-px bg-[var(--stroke)] lg:grid-cols-3">
              {overviewCards.map((card, index) => {
                const trendText = formatDelta(card.delta);
                const isLoading = overviewQuery.isLoading;
                const deltaLabel = overview?.comparisonAvailable
                  ? `vs ${formatMonthHeading(overview.comparisonMonth)}`
                  : "No prior month yet";

                return (
                  <div
                    key={card.key}
                    className="group relative bg-ink-0 p-6 transition-colors hover:bg-[var(--ink-1)]"
                  >
                    <div className="absolute left-0 top-0 h-px w-0 bg-brass transition-all duration-500 group-hover:w-full" />
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="label-eyebrow">{card.label}</span>
                        <div className="mt-3 flex items-baseline gap-2">
                          <span className="display text-[44px] leading-none text-bone">
                            {isLoading ? "…" : formatMoney(card.value, currency, 2)}
                          </span>
                        </div>
                      </div>
                      <div className="rounded-[2px] border border-[var(--stroke)] bg-[var(--ink-1)] px-3 py-2 text-right">
                        <div className="label-eyebrow-brass">Change</div>
                        <div className="mt-1 flex items-center justify-end gap-2 text-[12px]">
                          {card.positiveTone === "neutral" || card.delta === null ? null : card.positiveTone === "good" ? (
                            <ArrowUp className="size-3 text-sage-hi" />
                          ) : (
                            <ArrowDown className="size-3 text-oxide-hi" />
                          )}
                          <span
                            className={
                              card.positiveTone === "good"
                                ? "text-sage-hi"
                                : card.positiveTone === "bad"
                                  ? "text-oxide-hi"
                                  : "text-bone-faint"
                            }
                          >
                            {trendText}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-6 flex items-center gap-3 border-t border-[var(--stroke)] pt-3">
                      <span
                        className={`pill ${
                          card.positiveTone === "good"
                            ? "pill-sage"
                            : card.positiveTone === "bad"
                              ? "pill-oxide"
                              : "pill-bone"
                        }`}
                      >
                        {trendText}
                      </span>
                      <span className="label-eyebrow">{deltaLabel}</span>
                      {index === 2 ? (
                        <span className="label-eyebrow ml-auto text-brass-hi">
                          {card.value >= 0 ? "Net positive" : "Net negative"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </section>

            <section className="mt-10 grid gap-10 xl:grid-cols-[1.3fr_1fr]">
              <div className="flex flex-col rounded-[2px] border border-[var(--stroke)] bg-[var(--ink-1)] cove">
                <div className="flex items-center justify-between border-b border-[var(--stroke)] px-6 py-4">
                  <div>
                    <span className="label-eyebrow-brass">Cashflow · {formatMonthHeading(month)}</span>
                    <p className="mt-1 text-[13px] text-bone">
                      {overview
                        ? `${formatSignedMoney(Number(overview.totals.netCashflow), currency)} net this month`
                        : "Loading live month cashflow…"}
                    </p>
                  </div>
                  <div className="flex items-center gap-5">
                    <LegendDot label="Inflow" color="var(--chart-2)" />
                    <LegendDot label="Outflow" color="var(--chart-5)" />
                  </div>
                </div>
                <div className="px-6 py-6">
                  {cashflowQuery.isLoading ? (
                    <div className="flex min-h-[260px] items-center justify-center rounded-[2px] border border-dashed border-[var(--stroke)] bg-[var(--ink-0)] px-6 text-center text-[13px] text-bone-mute">
                      Loading daily inflow and outflow…
                    </div>
                  ) : hasCashflow ? (
                    <ChartContainer config={cashflowChartConfig} className="min-h-[260px] w-full">
                      <BarChart accessibilityLayer data={cashflowChartData} margin={{ left: 4, right: 4 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          minTickGap={22}
                          tickMargin={10}
                          tickFormatter={(value) => value.slice(8)}
                        />
                        <ChartTooltip
                          content={<ChartTooltipContent labelFormatter={formatTooltipLabel} />}
                        />
                        <Bar dataKey="inflow" radius={3} fill="var(--color-inflow)" />
                        <Bar dataKey="outflow" radius={3} fill="var(--color-outflow)" />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <div className="flex min-h-[260px] items-center justify-center rounded-[2px] border border-dashed border-[var(--stroke)] bg-[var(--ink-0)] px-6 text-center text-[13px] text-bone-mute">
                      No qualifying cashflow rows for this month yet.
                    </div>
                  )}
                </div>
                <div className="horizon h-px" />
              </div>

              <div className="flex flex-col rounded-[2px] border border-[var(--stroke)] bg-[var(--ink-1)] cove">
                <div className="flex items-center justify-between border-b border-[var(--stroke)] px-6 py-4">
                  <span className="label-eyebrow-brass">Ledger · recent</span>
                  <Link href="/transactions" className="label-eyebrow transition-colors hover:text-brass-hi">
                    Full tape →
                  </Link>
                </div>
                {recentTransactionsQuery.isLoading ? (
                  <div className="px-6 py-6 text-[13px] text-bone-mute">Loading recent transactions…</div>
                ) : recentRows.length > 0 ? (
                  <ul className="divide-y divide-[var(--stroke)]">
                    {recentRows.map((row) => {
                      const amount = Number(row.amount);
                      const positive = amount > 0;
                      return (
                        <li
                          key={row.id}
                          className="group grid grid-cols-[80px_1fr_auto] items-center gap-3 px-6 py-3 transition-colors hover:bg-[var(--ink-2-solid)]"
                        >
                          <span className="num text-[10px] text-bone-faint">{formatShortDate(row.date)}</span>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] text-bone">
                              {row.merchantName ?? row.name}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className="label-eyebrow">{row.categoryName}</span>
                              {row.pending ? <span className="pill pill-amber">Pending</span> : null}
                              {!row.accountIsActive ? <span className="pill pill-bone">History</span> : null}
                            </div>
                          </div>
                          <span
                            className={`num text-[13px] ${
                              positive ? "text-sage-hi" : "text-oxide-hi"
                            }`}
                          >
                            {formatSignedMoney(amount, row.currency)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="px-6 py-6 text-[13px] text-bone-mute">
                    No recent ledger rows for {formatMonthHeading(month)}.
                  </div>
                )}
              </div>
            </section>

            <section className="mt-10 grid gap-10 xl:grid-cols-[1.3fr_1fr]">
              <div className="rounded-[2px] border border-[var(--stroke)] bg-[var(--ink-1)] cove">
                <div className="flex items-center justify-between border-b border-[var(--stroke)] px-6 py-4">
                  <div>
                    <span className="label-eyebrow-brass">
                      Budget envelopes · {formatMonthHeading(month)}
                    </span>
                    <p className="mt-1 text-[12px] text-bone-mute">
                      {budgetsQuery.data ? (
                        <>
                          <span className="text-oxide-hi">
                            {budgetsQuery.data.totals.overBudgetCount} over
                          </span>{" "}
                          ·{" "}
                          <span className="text-amber">
                            {budgetsQuery.data.totals.unbudgetedCount} unbudgeted
                          </span>{" "}
                          ·{" "}
                          <span className="text-brass-hi">
                            {dashboardBudgetRows.length} active rows
                          </span>
                        </>
                      ) : budgetsQuery.isLoading ? (
                        "Loading live budget pressure…"
                      ) : (
                        "No budget activity yet."
                      )}
                    </p>
                  </div>
                  <Link href="/budgets" className="btn-ghost h-9">
                    <CircleDollarSign className="size-3.5" />
                    Adjust
                  </Link>
                </div>
                {budgetsQuery.isLoading ? (
                  <div className="px-6 py-5">
                    <span className="label-eyebrow">Loading budget rows…</span>
                  </div>
                ) : dashboardBudgetRows.length > 0 ? (
                  <div className="divide-y divide-[var(--stroke)]">
                    {dashboardBudgetRows.map((row) => {
                      const budget = Number(row.budgetAmount ?? 0);
                      const actual = Number(row.actualAmount);
                      const percent = budget > 0 ? Math.min((actual / budget) * 100, 150) : 0;
                      const overflow = budget > 0 && actual > budget;
                      const barColor =
                        row.status === "over"
                          ? "var(--oxide)"
                          : row.status === "near_limit" || row.status === "unbudgeted"
                            ? "var(--amber)"
                            : "var(--sage)";
                      const pillClass =
                        row.status === "over"
                          ? "pill-oxide"
                          : row.status === "near_limit" || row.status === "unbudgeted"
                            ? "pill-amber"
                            : "pill-sage";
                      const statusLabel = formatBudgetStatus(row.status);

                      return (
                        <div key={row.categoryId} className="px-6 py-4">
                          <div className="mb-2.5 flex items-center justify-between gap-4">
                            <div className="flex items-baseline gap-3">
                              <span className="text-[13px] text-bone">{row.categoryName}</span>
                              <span className="num text-[11px] text-bone-faint">
                                {formatMoney(actual, currency, 0)}{" "}
                                <span className="text-bone-ghost">
                                  / {budget > 0 ? formatMoney(budget, currency, 0) : "No target"}
                                </span>
                              </span>
                            </div>
                            <span className={`pill ${pillClass}`}>{statusLabel}</span>
                          </div>
                          <div className="relative h-1 overflow-hidden rounded-[1px] bg-[var(--ink-0)]">
                            <div
                              className="absolute inset-y-0 left-0 transition-all duration-700"
                              style={{
                                width: `${Math.min(percent, 100)}%`,
                                background: `linear-gradient(90deg, ${barColor}, ${barColor} 60%)`,
                                boxShadow: `0 0 8px -2px ${barColor}`,
                              }}
                            />
                            {overflow ? (
                              <div
                                className="absolute inset-y-0 right-0 w-0.5"
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
                  <div className="px-6 py-6">
                    <p className="text-[13px] text-bone-mute">
                      No budget rows yet. Set monthly targets from the budgets desk.
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-[2px] border border-[var(--stroke)] bg-[var(--ink-1)] cove">
                <div className="flex items-center justify-between border-b border-[var(--stroke)] px-6 py-4">
                  <div>
                    <span className="label-eyebrow-brass">Spend lanes</span>
                    <p className="mt-1 text-[12px] text-bone-faint">
                      {spendingQuery.data
                        ? `${formatMoney(Number(spendingQuery.data.totals.totalTrackedSpend), currency, 0)} across ${spendingQuery.data.totals.categoryCount} categories`
                        : "Loading category pressure…"}
                    </p>
                  </div>
                  <Link href="/transactions" className="label-eyebrow transition-colors hover:text-brass-hi">
                    Reclassify →
                  </Link>
                </div>
                {spendingQuery.isLoading ? (
                  <div className="px-6 py-6 text-[13px] text-bone-mute">Loading category spending…</div>
                ) : spendingRows.length > 0 ? (
                  <div className="divide-y divide-[var(--stroke)]">
                    {spendingRows.map((row) => {
                      const share = row.shareOfTotal ?? 0;
                      return (
                        <div key={`${row.categoryId ?? "uncategorized"}-${row.categoryName}`} className="px-6 py-4">
                          <div className="mb-2 flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="truncate text-[13px] text-bone">{row.categoryName}</p>
                              <span className="label-eyebrow">{row.groupName}</span>
                            </div>
                            <span className="num text-[12px] text-bone">
                              {formatMoney(Number(row.spendAmount), currency, 0)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="relative h-1.5 flex-1 overflow-hidden rounded-[1px] bg-[var(--ink-0)]">
                              <div
                                className="absolute inset-y-0 left-0 rounded-[1px] bg-brass"
                                style={{ width: `${Math.max(share * 100, 6)}%` }}
                              />
                            </div>
                            <span className="num text-[10px] text-bone-faint">
                              {share > 0 ? `${Math.round(share * 100)}%` : "0%"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-6 py-6 text-[13px] text-bone-mute">
                    No category spend pressure for {formatMonthHeading(month)}.
                  </div>
                )}
              </div>
            </section>

            <section className="mt-10 grid gap-10 xl:grid-cols-[2fr_1fr]">
              <div className="relative overflow-hidden rounded-[2px] border border-[var(--stroke-brass-hi)] bg-[var(--ink-1)] p-8 cove-hi">
                <div
                  className="absolute inset-0 opacity-40"
                  style={{
                    background:
                      "radial-gradient(ellipse at 80% 120%, rgba(255,154,60,0.18), transparent 55%), radial-gradient(ellipse at 10% -20%, rgba(232,199,145,0.08), transparent 50%)",
                  }}
                />
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-[2px] border border-[var(--stroke-brass-hi)] bg-[rgba(201,164,107,0.08)] text-brass-hi">
                      <CircleDollarSign className="size-3.5" />
                    </span>
                    <span className="label-eyebrow-brass">Desk signal · deterministic read</span>
                  </div>
                  <span className="label-eyebrow">
                    {savingsRate === null
                      ? "No savings rate yet"
                      : `${formatPercent(savingsRate)} saved`}
                  </span>
                </div>
                <p className="relative mt-6 max-w-3xl font-[family-name:var(--font-display)] text-[22px] leading-[1.4] tracking-tight text-bone">
                  {getSignalCopy({
                    month,
                    currency,
                    overview,
                    topSpendRow,
                    budgetsQueryData: budgetsQuery.data ?? null,
                  })}
                </p>
                <div className="relative mt-6 flex flex-wrap items-center gap-3 border-t border-[var(--stroke)] pt-4">
                  <span className="pill pill-bone">
                    {overview?.comparisonAvailable
                      ? `${formatDelta(overview.deltas.netCashflow)} net shift`
                      : "First comparable month pending"}
                  </span>
                  <span className="pill pill-bone">
                    {budgetsQuery.data
                      ? `${budgetsQuery.data.totals.overBudgetCount} over · ${budgetsQuery.data.totals.unbudgetedCount} unbudgeted`
                      : "Budget pressure loading"}
                  </span>
                </div>
              </div>

              <div className="rounded-[2px] border border-[var(--stroke)] bg-[var(--ink-1)] p-8 cove">
                <span className="label-eyebrow-brass">Quick hands</span>
                <ul className="mt-6 flex flex-col gap-2">
                  {[
                    { icon: Wallet, label: "Review ledger", href: "/transactions", key: "L" },
                    { icon: Target, label: "Adjust envelope", href: "/budgets", key: "B" },
                    { icon: Settings, label: "Manage connections", href: "/settings/connections", key: "C" },
                  ].map((action) => (
                    <li key={action.label}>
                      <Button
                        asChild
                        type="button"
                        variant="ghost"
                        className="group h-auto w-full justify-between rounded-[2px] border border-transparent px-3 py-2 text-left shadow-none hover:border-[var(--stroke-2)] hover:bg-[var(--ink-2-solid)]"
                      >
                        <Link href={action.href}>
                          <span className="flex items-center gap-3 text-[13px] text-bone">
                            <action.icon className="size-3.5 text-bone-mute group-hover:text-brass-hi" />
                            {action.label}
                          </span>
                          <span className="font-[family-name:var(--font-mono)] text-[10px] text-bone-faint">
                            ⌘{action.key}
                          </span>
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <footer className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--stroke)] pt-6">
              <span className="label-eyebrow">Month · {formatMonthHeading(month)}</span>
              <span className="label-eyebrow">Live ledger · Plaid-backed</span>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

function LegendDot({ label, color }: { label: string; color: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      <span className="label-eyebrow">{label}</span>
    </span>
  );
}

function formatMonthHeading(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-CA", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function formatShortDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-CA", {
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(year, month - 1, day));
}

function formatTooltipDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatTooltipLabel(value: React.ReactNode) {
  return typeof value === "string" ? formatTooltipDate(value) : value;
}

function shiftMonth(value: string, offset: number) {
  const [year, month] = value.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));

  return `${shifted.getUTCFullYear()}-${`${shifted.getUTCMonth() + 1}`.padStart(2, "0")}-01`;
}

function formatBudgetStatus(status: string) {
  switch (status) {
    case "on_track":
      return "On track";
    case "near_limit":
      return "Near limit";
    case "over":
      return "Over";
    case "unbudgeted":
      return "Unbudgeted";
    default:
      return "No budget";
  }
}

function formatMoney(amount: number, currency: string, maximumFractionDigits = 2) {
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency,
      minimumFractionDigits: maximumFractionDigits === 0 ? 0 : 2,
      maximumFractionDigits,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(maximumFractionDigits)}`;
  }
}

function formatSignedMoney(amount: number, currency: string) {
  const absValue = formatMoney(Math.abs(amount), currency, 0);
  return `${amount >= 0 ? "+" : "-"}${absValue}`;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDelta(value: number | null) {
  if (value === null) {
    return "No baseline";
  }

  const direction = value > 0 ? "+" : value < 0 ? "-" : "±";
  const percent = Math.abs(value) * 100;
  const digits = percent >= 10 ? 0 : 1;
  return `${direction}${percent.toFixed(digits)}%`;
}

function getMetricTone(
  metric: "inflow" | "outflow" | "netCashflow",
  delta: number | null,
) {
  if (delta === null || delta === 0) {
    return "neutral";
  }

  if (metric === "outflow") {
    return delta < 0 ? "good" : "bad";
  }

  return delta > 0 ? "good" : "bad";
}

function getSignalCopy({
  month,
  currency,
  overview,
  topSpendRow,
  budgetsQueryData,
}: {
  month: string;
  currency: string;
  overview:
    | {
        totals: {
          inflow: string;
          outflow: string;
          netCashflow: string;
          savingsRate: number | null;
        };
      }
    | undefined;
  topSpendRow:
    | {
        categoryName: string;
        spendAmount: string;
      }
    | null;
  budgetsQueryData:
    | {
        totals: {
          overBudgetCount: number;
          unbudgetedCount: number;
        };
      }
    | null;
}) {
  if (!overview) {
    return "Pulling the live month read from imported transactions and budget pressure.";
  }

  const net = Number(overview.totals.netCashflow);
  const headline =
    net >= 0
      ? `${formatMonthHeading(month)} is running ${formatMoney(net, currency, 0)} ahead of spend so far.`
      : `${formatMonthHeading(month)} is running ${formatMoney(Math.abs(net), currency, 0)} behind inflow so far.`;

  const topLane = topSpendRow
    ? `${topSpendRow.categoryName} is the largest spend lane at ${formatMoney(Number(topSpendRow.spendAmount), currency, 0)}.`
    : "No spend lane is dominating the month yet.";

  const budgetSignal = budgetsQueryData
    ? `${budgetsQueryData.totals.overBudgetCount} categories are over target and ${budgetsQueryData.totals.unbudgetedCount} still need a plan.`
    : "Budget pressure is still loading.";

  return `${headline} ${topLane} ${budgetSignal}`;
}

function getMonthStartForTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";

  return `${year}-${month}-01`;
}

export const getServerSideProps: GetServerSideProps<DashboardProps> = async (context) => {
  const session = await getPageSession(context);

  if (!session) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  const profile = await getUserProfile(session.user.id);

  if (!hasCompletedOnboarding(profile)) {
    return { redirect: { destination: "/onboarding", permanent: false } };
  }

  const timeZone = profile?.timezone ?? "America/Toronto";

  return {
    props: {
      firstName: profile?.firstName ?? "there",
      currency: profile?.currency ?? "CAD",
      initialMonth: getMonthStartForTimeZone(new Date(), timeZone),
    },
  };
};
