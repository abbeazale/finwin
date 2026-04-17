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
  ArrowUp,
  CircleDollarSign,
  Clock3,
  Plus,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react";

const kpiCards = [
  {
    label: "Inflow · M",
    value: "5,240.00",
    unit: "USD",
    delta: "+8%",
    deltaLabel: "vs last month",
    positive: true,
    points: "4,17 12,16 20,18 28,14 36,13 44,7 52,16 60,6 68,8 76,4",
  },
  {
    label: "Outflow · M",
    value: "3,872.50",
    unit: "USD",
    delta: "+3%",
    deltaLabel: "vs last month",
    positive: false,
    points: "4,8 12,7 20,9 28,12 36,14 44,12 52,10 60,8 68,7 76,10",
  },
  {
    label: "Net · M",
    value: "1,367.50",
    unit: "USD",
    delta: "+22%",
    deltaLabel: "vs last month",
    positive: true,
    points: "4,15 12,13 20,14 28,10 36,11 44,8 52,9 60,6 68,5 76,3",
  },
];

const watchlist = [
  { symbol: "AAPL", price: "198.15", change: "+0.34%", positive: true },
  { symbol: "MSFT", price: "412.30", change: "+1.12%", positive: true },
  { symbol: "NVDA", price: "875.20", change: "+2.87%", positive: true },
  { symbol: "BTC", price: "71,842.00", change: "-0.53%", positive: false },
];

const insights = [
  "Restaurant spend is 18% above the trailing three-month median. A $80/mo trim restores your 20% savings rate.",
  "Transportation is your largest variable expense this month — up $120 from March.",
  "Reallocating $80/mo to the sim portfolio would model a $12K delta over 10y at 7% real.",
];

const ledger = [
  { d: "2026-04-16", m: "Whole Foods Market", a: "-42.18", c: "Groceries" },
  { d: "2026-04-16", m: "Payroll · Stripe Inc", a: "+3,240.00", c: "Income" },
  { d: "2026-04-15", m: "Blue Bottle Coffee", a: "-6.25", c: "Restaurants" },
  { d: "2026-04-15", m: "Rent · Apt 4C", a: "-1,875.00", c: "Housing" },
  { d: "2026-04-14", m: "Dividend · VTI", a: "+38.40", c: "Investment" },
  { d: "2026-04-14", m: "Shell · 12th Ave", a: "-48.90", c: "Transport" },
  { d: "2026-04-13", m: "Spotify Premium", a: "-11.99", c: "Subscription" },
] as const;

export default function Dashboard({
  firstName,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const currentMonth = getCurrentMonthStart();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [insightIndex, setInsightIndex] = useState(0);
  const initials = firstName.slice(0, 2).toUpperCase();
  const budgetsQuery = trpc.budgets.summary.useQuery({ month: currentMonth });
  const dashboardBudgetRows = (budgetsQuery.data?.groups ?? [])
    .flatMap((group) => group.rows)
    .filter((row) => Number(row.actualAmount) > 0 || row.budgetAmount !== null)
    .sort((left, right) => {
      const leftMax = Math.max(Number(left.actualAmount), Number(left.budgetAmount ?? 0));
      const rightMax = Math.max(Number(right.actualAmount), Number(right.budgetAmount ?? 0));
      return rightMax - leftMax;
    })
    .slice(0, 5);

  async function logout() {
    setError(null);
    startTransition(async () => {
      const { error: signOutError } = await signOut();
      if (signOutError) {
        setError(signOutError.message ?? "Unable to log out.");
        return;
      }
      router.push("/login");
    });
  }

  return (
    <div className="relative min-h-screen bg-ink-0 text-bone">
      {/* Ambient atmosphere */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 right-[8%] h-[34rem] w-[34rem] rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(232,199,145,0.05), transparent 65%)" }} />
        <div className="absolute -bottom-48 left-0 h-[32rem] w-[50rem] blur-3xl" style={{ background: "radial-gradient(ellipse, rgba(255,154,60,0.04), transparent 60%)" }} />
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
            onRefreshed={(t) => {
              router.replace(router.asPath);
              setError(`Sync: +${t.added} · ~${t.modified} · -${t.removed}`);
            }}
            onConnected={({ accountCount }) => {
              router.replace(router.asPath);
              setError(`Linked ${accountCount} account${accountCount === 1 ? "" : "s"}.`);
            }}
          />

          {/* Content */}
          <div className="px-6 py-8 lg:px-10 lg:py-10">
            {/* Greeting + period picker */}
            <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
              <div>
                <div className="mb-3 flex items-center gap-3">
                  <span className="label-eyebrow">Good evening, {firstName}</span>
                  <span className="label-eyebrow">·</span>
                  <span className="label-eyebrow">Thu · 2026-04-16</span>
                </div>
                <h1 className="display text-[clamp(2.4rem,4vw,3.4rem)] leading-[1] text-bone">
                  The desk is <span className="italic text-brass-hi">ready.</span>
                </h1>
              </div>
              <div className="flex items-center gap-2 rounded-[2px] border border-[var(--stroke-2)] bg-[var(--ink-1)] p-1">
                {["W", "M", "Q", "YTD"].map((p, i) => (
                  <Button
                    key={p}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={`h-8 rounded-[2px] px-3 text-[11px] uppercase tracking-[0.12em] shadow-none hover:bg-transparent ${
                      i === 1
                        ? "bg-[rgba(201,164,107,0.12)] text-brass-hi"
                        : "text-bone-mute hover:text-bone"
                    }`}
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </header>

            {error ? (
              <p className="mb-6 flex items-center gap-3 rounded-[2px] border border-[var(--stroke-brass-hi)] bg-[rgba(201,164,107,0.05)] px-4 py-2.5 text-[12px] text-brass-hi">
                <span className="h-1.5 w-1.5 rounded-full bg-brass animate-pulse-dot" />
                {error}
              </p>
            ) : null}

            {/* KPI strip */}
            <section className="grid gap-px bg-[var(--stroke)] lg:grid-cols-3">
              {kpiCards.map((card, i) => (
                <div
                  key={card.label}
                  className="group relative bg-ink-0 p-6 transition-colors hover:bg-[var(--ink-1)]"
                >
                  <div className="absolute left-0 top-0 h-px w-0 bg-brass transition-all duration-500 group-hover:w-full" />
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="label-eyebrow">{card.label}</span>
                      <div className="mt-3 flex items-baseline gap-2">
                        <span className="display text-[44px] leading-none text-bone">${card.value}</span>
                        <span className="num text-[11px] text-bone-faint">{card.unit}</span>
                      </div>
                    </div>
                    <svg className="h-10 w-24" viewBox="0 0 80 22" fill="none" aria-hidden>
                      <polyline
                        points={card.points}
                        stroke={card.positive ? "var(--sage-hi)" : "var(--oxide-hi)"}
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div className="mt-6 flex items-center gap-3 border-t border-[var(--stroke)] pt-3">
                    <span className={`pill ${card.positive ? "pill-sage" : "pill-oxide"}`}>
                      {card.positive ? <ArrowUp className="size-2.5" /> : <ArrowDown className="size-2.5" />}
                      {card.delta}
                    </span>
                    <span className="label-eyebrow">{card.deltaLabel}</span>
                    {i === 2 ? (
                      <span className="label-eyebrow ml-auto text-brass-hi">Net positive</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </section>

            {/* 2-col: cashflow chart + ledger */}
            <section className="mt-10 grid gap-10 xl:grid-cols-[1.3fr_1fr]">
              {/* Cashflow chart */}
              <div className="flex flex-col rounded-[2px] border border-[var(--stroke)] bg-[var(--ink-1)] cove">
                <div className="flex items-center justify-between border-b border-[var(--stroke)] px-6 py-4">
                  <div>
                    <span className="label-eyebrow-brass">Cashflow · 7d</span>
                    <p className="mt-1 text-[13px] text-bone">Net +$1,367.50 this period</p>
                  </div>
                  <div className="flex items-center gap-5">
                    <LegendDot label="Inflow" color="var(--sage-hi)" />
                    <LegendDot label="Outflow" color="var(--oxide-hi)" />
                  </div>
                </div>
                <div className="px-6 py-8">
                  <div className="flex h-[240px] items-end gap-5">
                    {[
                      { day: "Mon", inflow: 10, outflow: 34 },
                      { day: "Tue", inflow: 22, outflow: 18 },
                      { day: "Wed", inflow: 48, outflow: 28 },
                      { day: "Thu", inflow: 18, outflow: 60 },
                      { day: "Fri", inflow: 78, outflow: 22 },
                      { day: "Sat", inflow: 12, outflow: 40 },
                      { day: "Sun", inflow: 6, outflow: 16 },
                    ].map((d) => (
                      <div key={d.day} className="flex flex-1 flex-col items-center justify-end gap-3">
                        <div className="flex h-[180px] w-full items-end justify-center gap-1.5">
                          <div
                            className="w-3 rounded-t-[1px]"
                            style={{
                              height: `${d.inflow}%`,
                              background: "linear-gradient(180deg, var(--sage-hi), var(--sage))",
                              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)",
                            }}
                          />
                          <div
                            className="w-3 rounded-t-[1px]"
                            style={{
                              height: `${d.outflow}%`,
                              background: "linear-gradient(180deg, var(--oxide-hi), var(--oxide))",
                              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)",
                            }}
                          />
                        </div>
                        <span className="label-eyebrow">{d.day}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="horizon h-px" />
              </div>

              {/* Ledger */}
              <div className="flex flex-col rounded-[2px] border border-[var(--stroke)] bg-[var(--ink-1)] cove">
                <div className="flex items-center justify-between border-b border-[var(--stroke)] px-6 py-4">
                  <span className="label-eyebrow-brass">Ledger · recent</span>
                  <Link href="/transactions" className="label-eyebrow transition-colors hover:text-brass-hi">
                    Full tape →
                  </Link>
                </div>
                <ul className="divide-y divide-[var(--stroke)]">
                  {ledger.map((row) => {
                    const positive = row.a.startsWith("+");
                    return (
                      <li
                        key={row.d + row.m}
                        className="group grid grid-cols-[80px_1fr_auto] items-center gap-3 px-6 py-3 transition-colors hover:bg-[var(--ink-2-solid)]"
                      >
                        <span className="num text-[10px] text-bone-faint">{row.d.slice(5)}</span>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] text-bone">{row.m}</p>
                          <span className="label-eyebrow">{row.c}</span>
                        </div>
                        <span
                          className={`num text-[13px] ${
                            positive ? "text-sage-hi" : "text-oxide-hi"
                          }`}
                        >
                          {row.a}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>

            {/* Budget + Watchlist */}
            <section className="mt-10 grid gap-10 xl:grid-cols-[1.3fr_1fr]">
              {/* Budgets */}
              <div className="rounded-[2px] border border-[var(--stroke)] bg-[var(--ink-1)] cove">
                <div className="flex items-center justify-between border-b border-[var(--stroke)] px-6 py-4">
                  <div>
                    <span className="label-eyebrow-brass">
                      Budget envelopes · {formatBudgetMonth(currentMonth)}
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
                                {formatDashboardMoney(actual)}{" "}
                                <span className="text-bone-ghost">
                                  / {budget > 0 ? formatDashboardMoney(budget) : "No target"}
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

              {/* Watchlist */}
              <div className="rounded-[2px] border border-[var(--stroke)] bg-[var(--ink-1)] cove">
                <div className="flex items-center justify-between border-b border-[var(--stroke)] px-6 py-4">
                  <span className="label-eyebrow-brass">Watchlist</span>
                  <div className="flex items-center gap-2">
                    <Clock3 className="size-3 text-bone-faint" />
                    <span className="label-eyebrow">DELAYED 15M</span>
                  </div>
                </div>
                <ul className="divide-y divide-[var(--stroke)]">
                  {watchlist.map((asset) => (
                    <li
                      key={asset.symbol}
                      className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 px-6 py-4 transition-colors hover:bg-[var(--ink-2-solid)]"
                    >
                      <span className="font-[family-name:var(--font-mono)] text-[12px] tracking-[0.06em] text-bone">
                        {asset.symbol}
                      </span>
                      <span className="num text-[13px] text-bone-mute">${asset.price}</span>
                      <span
                        className={`num text-[12px] ${
                          asset.positive ? "text-sage-hi" : "text-oxide-hi"
                        }`}
                      >
                        {asset.change}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-[var(--stroke)] p-3">
                  <Button type="button" variant="ghost" className="btn-ghost h-10 w-full justify-center shadow-none">
                    Enter simulated portfolio
                    <span aria-hidden>→</span>
                  </Button>
                </div>
              </div>
            </section>

            {/* Insight + command hint */}
            <section className="mt-10 grid gap-10 xl:grid-cols-[2fr_1fr]">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setInsightIndex((p) => (p + 1) % insights.length)}
                className="group relative h-auto w-full overflow-hidden rounded-[2px] border border-[var(--stroke-brass-hi)] bg-[var(--ink-1)] p-8 text-left shadow-none hover:bg-[var(--ink-1)] brackets cove-hi"
              >
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
                      <Sparkles className="size-3.5" />
                    </span>
                    <span className="label-eyebrow-brass">Intelligence · live read</span>
                  </div>
                  <span className="num text-[10px] text-bone-faint">
                    {String(insightIndex + 1).padStart(2, "0")} / {String(insights.length).padStart(2, "0")}
                  </span>
                </div>
                <p className="relative mt-6 max-w-2xl font-[family-name:var(--font-display)] text-[22px] leading-[1.4] tracking-tight text-bone">
                  “{insights[insightIndex]}”
                </p>
                <div className="relative mt-6 flex items-center justify-between border-t border-[var(--stroke)] pt-4">
                  <span className="label-eyebrow">Deterministic floor · AI overlay</span>
                  <span className="label-eyebrow transition-colors group-hover:text-brass-hi">Tap for next →</span>
                </div>
              </Button>

              <div className="rounded-[2px] border border-[var(--stroke)] bg-[var(--ink-1)] p-8 cove">
                <span className="label-eyebrow-brass">Quick hands</span>
                <ul className="mt-6 flex flex-col gap-2">
                  {[
                    { icon: Plus, label: "Log transaction", kbd: "N" },
                    { icon: Target, label: "Adjust envelope", kbd: "B" },
                    { icon: Sparkles, label: "Open simulator", kbd: "S" },
                    { icon: Wallet, label: "Review ledger", kbd: "L" },
                  ].map((a) => (
                    <li key={a.label}>
                      <Button
                        type="button"
                        variant="ghost"
                        className="group h-auto w-full justify-between rounded-[2px] border border-transparent px-3 py-2 text-left shadow-none hover:border-[var(--stroke-2)] hover:bg-[var(--ink-2-solid)]"
                      >
                        <span className="flex items-center gap-3 text-[13px] text-bone">
                          <a.icon className="size-3.5 text-bone-mute group-hover:text-brass-hi" />
                          {a.label}
                        </span>
                        <span className="font-[family-name:var(--font-mono)] text-[10px] text-bone-faint">⌘{a.kbd}</span>
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* Footer sign-off */}
            <footer className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--stroke)] pt-6">
              <span className="label-eyebrow">System · Plaid cursor @ 14:02 UTC</span>
              <span className="label-eyebrow">End of tape — {new Date().getFullYear()}</span>
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

function getCurrentMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}-01`;
}

function formatBudgetMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-CA", {
    month: "long",
  }).format(new Date(year, month - 1, 1));
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

function formatDashboardMoney(value: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export const getServerSideProps: GetServerSideProps<{
  firstName: string;
}> = async (context) => {
  const session = await getPageSession(context);

  if (!session) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  const profile = await getUserProfile(session.user.id);

  if (!hasCompletedOnboarding(profile)) {
    return { redirect: { destination: "/onboarding", permanent: false } };
  }

  return {
    props: {
      firstName: profile?.firstName ?? "there",
    },
  };
};
