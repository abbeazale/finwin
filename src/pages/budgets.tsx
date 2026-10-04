import { useMemo, useState } from "react";
import { CircleAlert, Expand } from "lucide-react";
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
import { PageStatus } from "@/components/page-status";
import { formatMonthHeading } from "@/lib/date";
import { AppShell } from "@/components/dashboard/app-shell";
import {
  EmptyPanel,
  MonthSwitcher,
  Notice,
  PageHeading,
  PanelHeading,
  ShellLoading,
} from "@/components/dashboard/desk-ui";
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
    return (
      <AppShell>
        <ShellLoading label="Loading your budgets…" />
      </AppShell>
    );
  }

  if (!session) {
    return <PageStatus label="Redirecting…" />;
  }

  return (
    <AppShell
      actions={
        summaryQuery.isFetching ? (
          <span className="hidden items-center gap-2 text-[12.5px] text-brass-hi sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-brass animate-pulse-dot" />
            Updating
          </span>
        ) : null
      }
    >
      <PageHeading
        kicker={
          getDaysLeftInMonth(month) > 0
            ? `${getDaysLeftInMonth(month)} day${getDaysLeftInMonth(month) === 1 ? "" : "s"} left in ${formatMonthHeading(month)}`
            : formatMonthHeading(month)
        }
        title={
          <>
            The month&rsquo;s{" "}
            <span className="italic text-brass-hi">budget.</span>
          </>
        }
        description="Set a monthly target for each category, then watch what you spend against it before the month closes."
        aside={<MonthSwitcher month={month} onChange={setSelectedMonth} />}
      />

      {budgetContextQuery.error || summaryQuery.error || pageError ? (
        <Notice tone="error" icon={<CircleAlert />}>
          {budgetContextQuery.error?.message ??
            summaryQuery.error?.message ??
            pageError ??
            "Unknown error."}
        </Notice>
      ) : null}

      {summary && summary.excludedCurrencyTransactionCount > 0 ? (
        <Notice tone="brass" icon={<CircleAlert />}>
          {summary.excludedCurrencyTransactionCount} transaction
          {summary.excludedCurrencyTransactionCount === 1 ? "" : "s"} in other
          currencies excluded; this budget is reported in {currency} without
          FX conversion.
        </Notice>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="desk-panel">
          <PanelHeading
            title="This month"
            detail={`Budget and spending for ${formatMonthHeading(month)}`}
          />
          <div className="px-6 pb-6 pt-4">
            {summary ? (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5">
                  <SummaryMetric
                    label="Budgeted"
                    value={formatMoney(
                      Number(summary.totals.totalBudgeted),
                      currency,
                    )}
                  />
                  <SummaryMetric
                    label="Spent"
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
                  <div className="mb-4 h-px bg-[var(--stroke)]" />
                  <p className="field-label mb-3">Biggest spends this month</p>
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
                    <ul className="flex flex-col gap-2.5">
                      {topSpends.map((tx) => (
                        <li
                          key={tx.id}
                          className="flex items-center justify-between gap-4"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[13px] text-bone">
                              {tx.merchantName ?? tx.name}
                            </p>
                            <p className="text-[12px] text-bone-faint">
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
                    <p className="text-[13px] text-bone-faint">
                      No transactions this month yet.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5">
                {Array.from({ length: 5 }, (_, i) => (
                  <div
                    key={i}
                    className="rounded-[14px] border border-[var(--stroke)] bg-[rgba(10,10,9,0.55)] px-4 py-4"
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
          className={`desk-panel transition-colors ${chartData.length > 0 ? "cursor-pointer hover:border-[var(--stroke-3)]" : ""}`}
          onClick={() => chartData.length > 0 && setChartModalOpen(true)}
        >
          <PanelHeading
            title="Budget against spending"
            detail="Top 6 categories. Click to see them all."
            action={
              chartData.length > 0 ? (
                <Expand className="mt-1 size-4 shrink-0 text-bone-faint" />
              ) : null
            }
          />
          <div className="px-6 pb-6 pt-4">
            {chartData.length > 0 ? (
              <ChartContainer
                config={budgetChartConfig}
                className="min-h-[220px] w-full"
              >
                <BarChart accessibilityLayer data={chartData}>
                  <CartesianGrid vertical={false} strokeDasharray="2 6" />
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
                    maxBarSize={36}
                    fill="var(--color-budget)"
                  />
                  <Bar
                    dataKey="actual"
                    radius={4}
                    maxBarSize={36}
                    fill="var(--color-actual)"
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <EmptyPanel className="min-h-[220px]">
                The chart appears once a category has spending or a target.
              </EmptyPanel>
            )}
          </div>
        </div>
      </section>

      <section className="mt-6 flex flex-col gap-6">
        {summary
          ? summary.groups.map((group) => {
              const budgetedRows = group.rows.filter(
                (r) => r.budgetAmount !== null,
              );
              const unbudgetedRows = group.rows.filter(
                (r) => r.budgetAmount === null,
              );
              return (
                <div key={group.groupName} className="desk-panel">
                  <PanelHeading
                    title={group.groupName}
                    detail={`${budgetedRows.length} with a target${
                      unbudgetedRows.length > 0
                        ? `, ${unbudgetedRows.length} without`
                        : ""
                    }`}
                  />
                  <div className="px-6 pb-6 pt-4">
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

      <ChartModal
        open={chartModalOpen}
        onClose={() => setChartModalOpen(false)}
        data={allChartData}
        month={month}
      />
    </AppShell>
  );
}

function getCurrentMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}-01`;
}
