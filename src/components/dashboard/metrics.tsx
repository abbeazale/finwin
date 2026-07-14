import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { formatMonthHeading, parseLocalDate } from "@/lib/date";

type OverviewCard = {
  key: string;
  label: string;
  value: number;
  delta: number | null;
  positiveTone: MetricTone;
};

export type MetricTone = "neutral" | "good" | "bad";

export function DashboardOverviewCards({
  cards,
  comparisonAvailable,
  comparisonMonth,
  currency,
  isLoading,
}: {
  cards: OverviewCard[];
  comparisonAvailable: boolean;
  comparisonMonth: string;
  currency: string;
  isLoading: boolean;
}) {
  return (
    <section className="grid gap-px bg-[var(--stroke)] lg:grid-cols-3">
      {cards.map((card, index) => {
        const trendText = formatDelta(card.delta);
        const deltaLabel = comparisonAvailable
          ? `vs ${formatMonthHeading(comparisonMonth)}`
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
                  {card.positiveTone === "neutral" ||
                  card.delta === null ? null : card.positiveTone === "good" ? (
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
  );
}

export function LegendDot({ label, color }: { label: string; color: string }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: color }}
      />
      <span className="label-eyebrow">{label}</span>
    </span>
  );
}

export function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "2-digit",
    day: "2-digit",
  }).format(parseLocalDate(value));
}

export function formatTooltipDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
  }).format(parseLocalDate(value));
}

export function formatTooltipLabel(value: ReactNode) {
  return typeof value === "string" ? formatTooltipDate(value) : value;
}

export function formatMoney(
  amount: number,
  currency: string,
  maximumFractionDigits = 2,
) {
  return formatCurrency(amount, currency, maximumFractionDigits);
}

export function formatSignedMoney(amount: number, currency: string) {
  const absValue = formatMoney(Math.abs(amount), currency, 0);
  return `${amount >= 0 ? "+" : "-"}${absValue}`;
}

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function formatDelta(value: number | null) {
  if (value === null) {
    return "No baseline";
  }

  const direction = value > 0 ? "+" : value < 0 ? "-" : "±";
  const percent = Math.abs(value) * 100;
  const digits = percent >= 10 ? 0 : 1;
  return `${direction}${percent.toFixed(digits)}%`;
}

export function getMetricTone(
  metric: "inflow" | "outflow" | "netCashflow",
  delta: number | null,
): MetricTone {
  if (delta === null || delta === 0) {
    return "neutral";
  }

  if (metric === "outflow") {
    return delta < 0 ? "good" : "bad";
  }

  return delta > 0 ? "good" : "bad";
}

export function getSignalCopy({
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
  topSpendRow: {
    categoryName: string;
    spendAmount: string;
  } | null;
  budgetsQueryData: {
    totals: {
      overBudgetCount: number;
      unbudgetedCount: number;
    };
  } | null;
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
