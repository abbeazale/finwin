import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  Expand,
  Target,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { useRequireSession } from "@/hooks/use-require-session";
import { trpc } from "@/lib/trpc";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { PageStatus } from "@/components/page-status";
import { formatMonthHeading, shiftMonthStart } from "@/lib/date";
import {
  AddCategorySection,
  BudgetCategoryCard,
  BudgetGroupSkeleton,
  ChartModal,
  SummaryMetric,
  abbreviateCategory,
  budgetChartConfig,
  formatMoney,
  formatSignedMoney,
  getDaysLeftInMonth,
  getLastDayOfMonth,
} from "@/components/budgets/budget-components";

export default function BudgetsPage() {
  const utils = trpc.useUtils();
  const { session, isPending: sessionLoading } = useRequireSession();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [chartModalOpen, setChartModalOpen] = useState(false);
  const budgetContextQuery = trpc.budgets.context.useQuery(undefined, {
    enabled: Boolean(session),
  });
  const month =
    selectedMonth ??
    budgetContextQuery.data?.currentMonth ??
    getCurrentMonthStart();

  const summaryQuery = trpc.budgets.summary.useQuery(
    { month },
    { enabled: Boolean(session && budgetContextQuery.data) },
  );
  const upsertBudget = trpc.budgets.upsertMonthlyBudget.useMutation({
    onMutate: () => setPageError(null),
    onSuccess: async () => {
      await utils.budgets.summary.invalidate();
    },
    onError: (error) => {
      setPageError(error.message ?? "Unable to save budget.");
    },
  });
  const deleteBudget = trpc.budgets.deleteMonthlyBudget.useMutation({
    onMutate: () => setPageError(null),
    onSuccess: async () => {
      await utils.budgets.summary.invalidate();
    },
    onError: (error) => {
      setPageError(error.message ?? "Unable to delete budget.");
    },
  });

  const topSpendQuery = trpc.transactions.list.useQuery(
    {
      dateFrom: month,
      dateTo: getLastDayOfMonth(month),
      includeInactiveAccounts: true,
      currency: budgetContextQuery.data?.currency,
      sortBy: "amount_asc",
      limit: 5,
    },
    { enabled: Boolean(session && budgetContextQuery.data) },
  );

  const topSpends = useMemo(() => {
    return (topSpendQuery.data?.rows ?? []).filter(
      (row) => Number(row.amount) < 0,
    );
  }, [topSpendQuery.data]);

  const summary = summaryQuery.data;
  const currency =
    summary?.currency ?? budgetContextQuery.data?.currency ?? "CAD";

  const allChartData = useMemo(() => {
    const rows = summary?.groups.flatMap((group) => group.rows) ?? [];
    return rows
      .filter(
        (row) =>
          Number(row.actualAmount) > 0 || Number(row.budgetAmount ?? 0) > 0,
      )
      .sort((l, r) => {
        const lMax = Math.max(
          Number(l.actualAmount),
          Number(l.budgetAmount ?? 0),
        );
        const rMax = Math.max(
          Number(r.actualAmount),
          Number(r.budgetAmount ?? 0),
        );
        return rMax - lMax;
      })
      .map((row) => ({
        category: abbreviateCategory(row.categoryName),
        budget: Number(row.budgetAmount ?? 0),
        actual: Number(row.actualAmount),
      }));
  }, [summary]);

  const chartData = useMemo(() => allChartData.slice(0, 6), [allChartData]);

  if (
    sessionLoading ||
    budgetContextQuery.isLoading ||
    (summaryQuery.isLoading && !summary)
  ) {
    return <PageStatus label="Balancing the month…" />;
  }

  if (!session) {
    return <PageStatus label="Redirecting…" />;
  }

  return (
    <div className="relative min-h-screen bg-ink-0 text-bone">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute -top-36 right-[10%] h-[30rem] w-[30rem] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(232,199,145,0.05), transparent 65%)",
          }}
        />
        <div
          className="absolute -bottom-44 left-0 h-[30rem] w-[48rem] blur-3xl"
          style={{
            background:
              "radial-gradient(ellipse, rgba(255,154,60,0.04), transparent 60%)",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 py-10 sm:px-10">
        <header className="mb-10 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard"
              className="label-eyebrow inline-flex items-center gap-2 transition-colors hover:text-brass-hi"
            >
              <ArrowLeft className="size-3" />
              Back to desk
            </Link>
            <div className="flex items-center gap-3">
              <span className="label-eyebrow">Ledger · 03 / 05</span>
              {summaryQuery.isFetching ? (
                <span className="label-eyebrow flex items-center gap-2 text-brass-hi">
                  <span className="h-1 w-1 rounded-full bg-brass animate-pulse-dot" />
                  Updating
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <span className="label-eyebrow-brass">§ Budgets</span>
              <h1 className="display mt-3 text-[clamp(2rem,4vw,3.3rem)] leading-[1] text-bone">
                Monthly{" "}
                <span className="italic text-brass-hi">discipline.</span>
              </h1>
              <p className="mt-4 max-w-2xl text-[13px] leading-[1.7] text-bone-mute">
                A budgeting desk built from live ledger movement. Set the
                envelope, watch the drift, and tighten what matters before the
                month closes.
              </p>
            </div>

            <div className="flex items-center gap-1 overflow-hidden rounded-md border border-[var(--stroke)] bg-[var(--ink-1)] p-1 cove">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setSelectedMonth(shiftMonthStart(month, -1))}
                className="size-9 rounded text-bone-mute shadow-none hover:bg-[var(--ink-3)] hover:text-bone"
              >
                <ArrowLeft className="size-3.5" />
              </Button>
              <div className="min-w-[10rem] px-3 text-center">
                <p className="label-eyebrow text-bone-faint">Selected month</p>
                <p className="mt-1 text-[13px] text-bone">
                  {formatMonthHeading(month)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setSelectedMonth(shiftMonthStart(month, 1))}
                className="size-9 rounded text-bone-mute shadow-none hover:bg-[var(--ink-3)] hover:text-bone"
              >
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </header>

        {budgetContextQuery.error || summaryQuery.error || pageError ? (
          <p className="mb-8 flex items-center gap-3 rounded-md border border-[rgba(194,106,72,0.3)] bg-[rgba(194,106,72,0.06)] px-4 py-2.5 text-[12px] text-oxide-hi">
            <CircleAlert className="size-3.5 shrink-0" />
            {budgetContextQuery.error?.message ??
              summaryQuery.error?.message ??
              pageError ??
              "Unknown error."}
          </p>
        ) : null}

        {summary && summary.excludedCurrencyTransactionCount > 0 ? (
          <p className="mb-8 flex items-center gap-3 rounded-md border border-[var(--stroke-brass-hi)] bg-[rgba(201,164,107,0.05)] px-4 py-2.5 text-[12px] text-brass-hi">
            <CircleAlert className="size-3.5 shrink-0" />
            {summary.excludedCurrencyTransactionCount} transaction
            {summary.excludedCurrencyTransactionCount === 1 ? "" : "s"} in other
            currencies excluded; this budget is reported in {currency} without
            FX conversion.
          </p>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="overflow-hidden rounded-md border border-[var(--stroke)] bg-[var(--ink-1)] cove">
            <div className="flex items-center gap-2.5 border-b border-[var(--stroke)] px-5 py-4">
              <Target className="size-4 text-brass-hi" />
              <span className="label-eyebrow-brass">Month snapshot</span>
              <span className="label-eyebrow ml-auto text-bone-faint">
                {formatMonthHeading(month)}
              </span>
            </div>
            <div className="p-5">
              {summary ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <SummaryMetric
                      label="Budgeted"
                      value={formatMoney(
                        Number(summary.totals.totalBudgeted),
                        currency,
                      )}
                    />
                    <SummaryMetric
                      label="Actual"
                      value={formatMoney(
                        Number(summary.totals.totalActual),
                        currency,
                      )}
                    />
                    <SummaryMetric
                      label="Remaining"
                      value={formatSignedMoney(
                        Number(summary.totals.totalRemaining),
                        currency,
                      )}
                      tone={
                        Number(summary.totals.totalRemaining) < 0
                          ? "oxide"
                          : "sage"
                      }
                    />
                    <SummaryMetric
                      label="Flags"
                      value={`${summary.totals.overBudgetCount} over`}
                      sub={`${summary.totals.unbudgetedCount} unbudgeted`}
                    />
                    <SummaryMetric
                      label="Days left"
                      value={`${getDaysLeftInMonth(month)}`}
                      sub={formatMonthHeading(month)}
                    />
                  </div>

                  <div className="mt-5">
                    <div className="mb-3 h-px bg-[var(--stroke)]" />
                    <p className="label-eyebrow mb-3 text-bone-faint">
                      Top spends this month
                    </p>
                    {topSpendQuery.isLoading ? (
                      <div className="flex flex-col gap-2">
                        {Array.from({ length: 5 }, (_, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between gap-4"
                          >
                            <div className="h-2.5 w-40 animate-pulse rounded bg-[var(--ink-3)]" />
                            <div className="h-2.5 w-16 animate-pulse rounded bg-[var(--ink-3)]" />
                          </div>
                        ))}
                      </div>
                    ) : topSpends.length > 0 ? (
                      <ul className="flex flex-col gap-2">
                        {topSpends.map((tx) => (
                          <li
                            key={tx.id}
                            className="flex items-center justify-between gap-4"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-[13px] text-bone">
                                {tx.merchantName ?? tx.name}
                              </p>
                              <p className="text-[11px] text-bone-faint">
                                {tx.date}
                                {tx.categoryName ? ` · ${tx.categoryName}` : ""}
                              </p>
                            </div>
                            <span className="num shrink-0 text-[13px] tabular-nums text-bone">
                              {formatMoney(
                                Math.abs(Number(tx.amount)),
                                currency,
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[13px] text-bone-ghost">
                        No transactions this month yet.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div
                      key={i}
                      className="rounded-md border border-[var(--stroke)] bg-[var(--ink-0)] px-4 py-4"
                    >
                      <div className="h-2 w-16 animate-pulse rounded bg-[var(--ink-3)]" />
                      <div className="mt-3 h-5 w-24 animate-pulse rounded bg-[var(--ink-3)]" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div
            className={`overflow-hidden rounded-md border border-[var(--stroke)] bg-[var(--ink-1)] cove transition-colors ${chartData.length > 0 ? "cursor-pointer hover:border-[var(--stroke-2)]" : ""}`}
            onClick={() => chartData.length > 0 && setChartModalOpen(true)}
          >
            <div className="flex items-start justify-between border-b border-[var(--stroke)] px-5 py-4">
              <div>
                <span className="label-eyebrow-brass">
                  Where the pressure sits
                </span>
                <p className="mt-1 text-[12px] text-bone-faint">
                  Top 6 categories · click to expand all
                </p>
              </div>
              {chartData.length > 0 && (
                <Expand className="mt-0.5 size-3.5 shrink-0 text-bone-faint" />
              )}
            </div>
            <div className="p-5">
              {chartData.length > 0 ? (
                <ChartContainer
                  config={budgetChartConfig}
                  className="min-h-[220px] w-full"
                >
                  <BarChart accessibilityLayer data={chartData}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="category"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar
                      dataKey="budget"
                      radius={4}
                      fill="var(--color-budget)"
                    />
                    <Bar
                      dataKey="actual"
                      radius={4}
                      fill="var(--color-actual)"
                    />
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="flex min-h-[220px] items-center justify-center rounded-md border border-dashed border-[var(--stroke)] bg-[var(--ink-0)] px-6 text-center text-[13px] text-bone-mute">
                  Chart appears once categories have spend or planned targets.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-8 flex flex-col gap-6">
          {summary
            ? summary.groups.map((group) => {
                const budgetedRows = group.rows.filter(
                  (r) => r.budgetAmount !== null,
                );
                const unbudgetedRows = group.rows.filter(
                  (r) => r.budgetAmount === null,
                );
                return (
                  <div
                    key={group.groupName}
                    className="overflow-hidden rounded-md border border-[var(--stroke)] bg-[var(--ink-1)] cove"
                  >
                    <div className="border-b border-[var(--stroke)] px-5 py-4">
                      <span className="label-eyebrow-brass">
                        § {group.groupName}
                      </span>
                      <p className="mt-1 text-[12px] text-bone-faint">
                        Monthly targets for the {group.groupName.toLowerCase()}{" "}
                        lane.
                      </p>
                    </div>
                    <div className="p-5">
                      {budgetedRows.length > 0 ? (
                        <div className="grid gap-4 lg:grid-cols-2">
                          {budgetedRows.map((row) => (
                            <BudgetCategoryCard
                              key={row.categoryId}
                              row={row}
                              month={month}
                              currency={currency}
                              onSave={(amount) => {
                                upsertBudget.mutate({
                                  categoryId: row.categoryId,
                                  month,
                                  amount,
                                });
                              }}
                              onDelete={() => {
                                deleteBudget.mutate({
                                  categoryId: row.categoryId,
                                  month,
                                });
                              }}
                              isSaving={
                                upsertBudget.isPending &&
                                upsertBudget.variables?.categoryId ===
                                  row.categoryId
                              }
                              isDeleting={
                                deleteBudget.isPending &&
                                deleteBudget.variables?.categoryId ===
                                  row.categoryId
                              }
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-[13px] text-bone-mute">
                          No budgets set for this group yet.
                        </p>
                      )}

                      {unbudgetedRows.length > 0 ? (
                        <AddCategorySection
                          unbudgetedRows={unbudgetedRows}
                          currency={currency}
                          onSave={(categoryId, amount) => {
                            upsertBudget.mutate({ categoryId, month, amount });
                          }}
                          isSaving={upsertBudget.isPending}
                        />
                      ) : null}
                    </div>
                  </div>
                );
              })
            : Array.from({ length: 3 }, (_, i) => (
                <BudgetGroupSkeleton key={i} />
              ))}
        </section>
      </div>

      <ChartModal
        open={chartModalOpen}
        onClose={() => setChartModalOpen(false)}
        data={allChartData}
        month={month}
      />
    </div>
  );
}

function getCurrentMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}-01`;
}
