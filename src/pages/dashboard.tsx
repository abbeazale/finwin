import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import {
  getPageSession,
  getUserProfile,
  hasCompletedOnboarding,
} from "@/lib/page-auth";
import { signOut } from "@/lib/auth-client";
import Link from "next/link";
import { ConnectBank } from "@/components/connect-bank";
import { RefreshTransactions } from "@/components/refresh-transactions";
import { useRouter } from "next/router";
import { useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  CircleDollarSign,
  LayoutDashboard,
  Plus,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";

const navItems: {
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
  href?: string;
}[] = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Transactions", icon: Wallet, active: false },
  { label: "Budgets", icon: Target, active: false },
  { label: "Reports", icon: TrendingUp, active: false },
  { label: "Settings", icon: Settings, active: false, href: "/settings/connections" },
];

const kpiCards = [
  {
    label: "Money In",
    value: "$5,240.00",
    delta: "+8% vs last month",
    positive: true,
    points: "4,17 12,16 20,18 28,14 36,13 44,7 52,16 60,6 68,8 76,4",
  },
  {
    label: "Money Out",
    value: "$3,872.50",
    delta: "+3% vs last month",
    positive: false,
    points: "4,8 12,7 20,9 28,12 36,14 44,12 52,10 60,8 68,7 76,10",
  },
];

const budgetRows = [
  {
    category: "Groceries",
    spent: 420,
    budget: 500,
    status: "On track",
    color: "bg-[#00D3F3]",
    pill: "text-[#34d399] bg-[#34d39914]",
  },
  {
    category: "Restaurants",
    spent: 285,
    budget: 300,
    status: "Near limit",
    color: "bg-[#fbbf24]",
    pill: "text-[#fbbf24] bg-[#fbbf2414]",
  },
  {
    category: "Entertainment",
    spent: 125,
    budget: 150,
    status: "On track",
    color: "bg-[#60a5fa]",
    pill: "text-[#34d399] bg-[#34d39914]",
  },
  {
    category: "Transportation",
    spent: 310,
    budget: 250,
    status: "Over budget",
    color: "bg-[#f87171]",
    pill: "text-[#f87171] bg-[#f8717114]",
  },
  {
    category: "Shopping",
    spent: 220,
    budget: 200,
    status: "Above budget",
    color: "bg-[#fb7185]",
    pill: "text-[#fb7185] bg-[#fb718514]",
  },
];

const watchlist = [
  { symbol: "AAPL", price: "$198.15", change: "+0.34%" },
  { symbol: "MSFT", price: "$412.30", change: "+1.12%" },
  { symbol: "NVDA", price: "$875.20", change: "+2.87%" },
  { symbol: "BTC", price: "$71,842.00", change: "-0.53%", negative: true },
];

const insights = [
  "You spent 18% more on restaurants than last month.",
  "Transportation is your largest expense category this month.",
  "Cutting restaurant spend by $80 would improve your savings rate noticeably.",
];

export default function Dashboard({
  firstName,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [insightIndex, setInsightIndex] = useState(0);
  const initials = firstName.slice(0, 2).toUpperCase();

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
    <div className="min-h-screen bg-[#050a1a] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px]">
        <aside className="hidden w-[220px] shrink-0 flex-col border-r border-white/5 bg-[#070d1f] lg:flex">
          <div className="border-b border-white/5 px-6 py-5">
            <p className="text-[28px] leading-none tracking-[-0.02em]">
              Fin<span className="text-[#00d3f3]">Win</span>
            </p>
          </div>
          <nav className="flex flex-1 flex-col gap-1 p-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const className = `flex h-10 items-center gap-3 rounded-[10px] px-3 text-left text-[13px] transition ${
                item.active
                  ? "bg-[#00d3f31a] text-[#00d3f3]"
                  : "text-[#6a7282] hover:bg-white/5 hover:text-[#d1d5dc]"
              }`;
              const content = (
                <>
                  <Icon className="size-4" />
                  <span>{item.label}</span>
                  {item.active ? <span className="ml-auto size-1.5 rounded-full bg-[#00d3f3]" /> : null}
                </>
              );
              return item.href ? (
                <Link key={item.label} href={item.href} className={className}>
                  {content}
                </Link>
              ) : (
                <button key={item.label} type="button" className={className}>
                  {content}
                </button>
              );
            })}
          </nav>
          <div className="border-t border-white/5 p-3">
            <div className="flex items-center gap-3 rounded-[10px] px-3 py-3">
              <div className="flex size-8 items-center justify-center rounded-full border border-[#00d3f34d] bg-[#00d3f333] text-[11px] text-[#00d3f3]">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-[#d1d5dc]">{firstName}</p>
                <p className="truncate text-[11px] text-[#4a5565]">finwin@user.com</p>
              </div>
              <button
                type="button"
                className="text-[11px] text-[#4a5565] hover:text-[#d1d5dc]"
                onClick={logout}
                disabled={isPending}
              >
                {isPending ? "..." : "Log out"}
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 p-4 lg:p-6">
          <div className="mx-auto w-full max-w-[900px] space-y-4 lg:space-y-6">
            <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="text-2xl font-medium tracking-[-0.02em]">Dashboard</h1>
                <p className="mt-1 text-[13px] text-[#6a7282]">
                  Your financial snapshot for this month
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-white/10 bg-[#0a1628] px-3 text-[#d1d5dc]"
                >
                  March 2026
                  <ChevronRight className="size-3 rotate-90" />
                </button>
                <ConnectBank
                  onConnected={({ accountCount }) => {
                    router.replace(router.asPath);
                    setError(`Connected ${accountCount} account${accountCount === 1 ? "" : "s"}.`);
                  }}
                />
                <RefreshTransactions
                  onRefreshed={(t) => {
                    router.replace(router.asPath);
                    setError(
                      `Synced: +${t.added} added, ~${t.modified} modified, -${t.removed} removed.`,
                    );
                  }}
                />
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-white/10 bg-[#0a1628] px-3 text-[#d1d5dc]"
                >
                  <Plus className="size-3.5" />
                  Add transaction
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-white/10 bg-[#0a1628] px-3 text-[#d1d5dc]"
                >
                  <CircleDollarSign className="size-3.5" />
                  View budgets
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-white/10 bg-[#0a1628] px-3 text-[#d1d5dc]"
                >
                  <Sparkles className="size-3.5" />
                  Simulator
                </button>
              </div>
            </header>

            <section className="grid gap-4 sm:grid-cols-2">
              {kpiCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-2xl border border-white/10 bg-[#0a1628] px-5 py-5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] tracking-[0.08em] text-[#6a7282] uppercase">{card.label}</p>
                      <p className="mt-1 text-[32px] leading-tight tracking-[-0.02em]">{card.value}</p>
                    </div>
                    <svg
                      className="h-10 w-20"
                      viewBox="0 0 80 22"
                      fill="none"
                      aria-hidden
                    >
                      <polyline
                        points={card.points}
                        stroke={card.positive ? "#00d3f3" : "#f87171"}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div className="mt-4 border-t border-white/5 pt-3 text-[11px]">
                    <span
                      className={`inline-flex items-center gap-1 ${
                        card.positive ? "text-[#34d399]" : "text-[#f87171]"
                      }`}
                    >
                      {card.positive ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                      {card.delta}
                    </span>
                  </div>
                </div>
              ))}
            </section>

            <section className="overflow-hidden rounded-2xl border border-white/8 bg-[#0a1628]">
              <div className="border-b border-white/6 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-[#d1d5dc]">Cashflow</p>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1 text-[#6a7282]">
                      <span className="size-1.5 rounded-full bg-[#00d3f3]" />
                      Income
                    </span>
                    <span className="inline-flex items-center gap-1 text-[#6a7282]">
                      <span className="size-1.5 rounded-full bg-[#f87171]" />
                      Expenses
                    </span>
                    <span className="rounded-md bg-[#00d3f3] px-2 py-1 text-black">1W</span>
                    <span className="rounded-md border border-white/10 px-2 py-1 text-[#4a5565]">1M</span>
                    <span className="rounded-md border border-white/10 px-2 py-1 text-[#4a5565]">3M</span>
                  </div>
                </div>
                <div className="mt-5 h-[220px] rounded-xl border border-white/5 bg-[#081224] p-4">
                  <div className="flex h-full items-end gap-8">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, idx) => (
                      <div key={day} className="flex flex-1 flex-col items-center justify-end gap-2">
                        <div className="flex h-40 items-end gap-1">
                          <div
                            className={`w-2 rounded-full bg-[#00d3f3] ${
                              idx === 2 ? "h-16" : idx === 4 ? "h-30" : "h-0"
                            }`}
                          />
                          <div
                            className={`w-2 rounded-full bg-[#f87171] ${
                              idx === 2 ? "h-14" : idx === 4 ? "h-34" : "h-0"
                            }`}
                          />
                        </div>
                        <span className="text-[11px] text-[#4a5565]">{day}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-5 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm text-[#d1d5dc]">Budget Progress</p>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="text-[#f87171]">2 over · 1 near limit</span>
                    <button type="button" className="text-[#00d3f3]">
                      View all
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {budgetRows.map((row) => {
                    const percent = Math.min((row.spent / row.budget) * 100, 100);
                    return (
                      <div key={row.category} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="text-[#d1d5dc]">{row.category}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[#6a7282]">
                              ${row.spent} / ${row.budget}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 ${row.pill}`}>{row.status}</span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/10">
                          <div className={`h-full rounded-full ${row.color}`} style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="rounded-2xl border border-white/8 bg-[#0a1628] px-5 py-4">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm text-[#d1d5dc]">Market Watchlist</p>
                  <span className="text-[11px] text-[#4a5565]">Delayed 15 min</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {watchlist.map((asset) => (
                    <div
                      key={asset.symbol}
                      className="rounded-xl border border-white/6 bg-white/3 px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#d1d5dc]">{asset.symbol}</span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                            asset.negative
                              ? "bg-[#f8717114] text-[#f87171]"
                              : "bg-[#34d39914] text-[#34d399]"
                          }`}
                        >
                          {asset.change}
                        </span>
                      </div>
                      <p className="mt-2 text-[15px] tracking-[-0.01em]">{asset.price}</p>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-3 h-9 w-full rounded-[10px] border border-white/6 text-[12px] text-[#4a5565]"
                >
                  Try simulated portfolio →
                </button>
              </div>

              <button
                type="button"
                className="w-full rounded-2xl border border-[#00d3f326] bg-[linear-gradient(167deg,rgba(0,211,243,0.08)_0%,rgba(99,102,241,0.06)_100%)] px-5 py-4 text-left"
                onClick={() => setInsightIndex((prev) => (prev + 1) % insights.length)}
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-[13px] text-[#00d3f3]">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-[#00d3f326]">
                      <Sparkles className="size-3.5" />
                    </span>
                    AI Insight
                  </span>
                  <span className="text-[11px] text-[#4a5565]">
                    {insightIndex + 1} / {insights.length}
                  </span>
                </div>
                <p className="text-sm text-[#d1d5dc]">&quot;{insights[insightIndex]}&quot;</p>
                <div className="mt-4 flex items-center justify-between border-t border-white/6 pt-3 text-[11px] text-[#4a5565]">
                  <span>Based on your spending patterns · Updated daily</span>
                  <span>Tap for next →</span>
                </div>
              </button>
            </section>

            {error ? (
              <p className="rounded-lg border border-[#f8717140] bg-[#f8717112] px-3 py-2 text-sm text-[#fca5a5]">
                {error}
              </p>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<{
  firstName: string;
}> = async (context) => {
  const session = await getPageSession(context);

  if (!session) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }

  const profile = await getUserProfile(session.user.id);

  if (!hasCompletedOnboarding(profile)) {
    return {
      redirect: {
        destination: "/onboarding",
        permanent: false,
      },
    };
  }

  return {
    props: {
      firstName: profile?.firstName ?? "there",
    },
  };
};
