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

type MetricTone = "neutral" | "good" | "bad";

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
    <section className="grid gap-4 lg:grid-cols-3">
      {cards.map((card, index) => {
        const featured = card.key === "net";
        const toneClass =
          card.positiveTone === "good"
            ? "text-sage-hi"
            : card.positiveTone === "bad"
              ? "text-oxide-hi"
              : "text-bone-mute";

        return (
          <div
            key={card.key}
            className={`desk-panel animate-fade-slide p-6 ${featured ? "desk-panel--warm" : ""}`}
            style={{ animationDelay: `${80 + index * 70}ms` }}
          >
            {featured ? (
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(ellipse at 85% 130%, rgba(255,154,60,0.16), transparent 60%)",
                }}
              />
            ) : null}
            <div className="relative">
              <div className="flex items-center justify-between gap-4">
                <span className="field-label">{card.label}</span>
                {featured && !isLoading ? (
                  <span
                    className={`pill pill--soft ${card.value >= 0 ? "pill-sage" : "pill-oxide"}`}
                  >
                    {card.value >= 0 ? "Ahead" : "Behind"}
                  </span>
                ) : null}
              </div>
              <div className="display mt-4 text-[clamp(2.3rem,3.3vw,3rem)] leading-none text-bone">
                {isLoading ? "…" : formatMoney(card.value, currency, 2)}
              </div>
              <div className="mt-5 flex items-center gap-2 text-[12.5px]">
                {comparisonAvailable && card.delta !== null ? (
                  <>
                    {card.delta > 0 ? (
                      <ArrowUp className={`size-3 ${toneClass}`} />
                    ) : card.delta < 0 ? (
                      <ArrowDown className={`size-3 ${toneClass}`} />
                    ) : null}
                    <span className={toneClass}>{formatDelta(card.delta)}</span>
                    <span className="text-bone-faint">
                      vs {formatMonthHeading(comparisonMonth)}
                    </span>
                  </>
                ) : (
                  <span className="text-bone-faint">
                    No earlier month to compare yet
                  </span>
                )}
              </div>
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
        className="h-2 w-2 rounded-full"
        style={{ background: color }}
      />
      <span className="text-[12px] text-bone-mute">{label}</span>
    </span>
  );
}

export function formatDateTile(value: string) {
  const date = parseLocalDate(value);
  return {
    month: new Intl.DateTimeFormat("en-CA", { month: "short" }).format(date),
    day: date.getDate(),
  };
}

function formatTooltipDate(value: string) {
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
    return "Reading this month’s transactions and budgets…";
  }

  const net = Number(overview.totals.netCashflow);
  const headline =
    net >= 0
      ? `${formatMonthHeading(month)} is running ${formatMoney(net, currency, 0)} ahead of spend so far.`
      : `${formatMonthHeading(month)} is running ${formatMoney(Math.abs(net), currency, 0)} behind inflow so far.`;

  const topLane = topSpendRow
    ? `${topSpendRow.categoryName} is the biggest category at ${formatMoney(Number(topSpendRow.spendAmount), currency, 0)}.`
    : "No single category is leading the month yet.";

  const budgetSignal = budgetsQueryData
    ? `${budgetsQueryData.totals.overBudgetCount} categories are over target and ${budgetsQueryData.totals.unbudgetedCount} still need a plan.`
    : "Budgets are still loading.";

  return `${headline} ${topLane} ${budgetSignal}`;
}
