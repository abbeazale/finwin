import Link from "next/link";
import { useRouter } from "next/router";
import { useDeferredValue, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeAlert,
  CalendarRange,
  CircleAlert,
  Filter,
  Landmark,
  Wallet,
} from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";

type CategoryFilterValue = "all" | "uncategorized" | string;
type PendingFilterValue = "all" | "pending" | "posted";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default function TransactionsPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();

  const [accountId, setAccountId] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterValue>("all");
  const [pending, setPending] = useState<PendingFilterValue>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [includeInactiveAccounts, setIncludeInactiveAccounts] = useState(false);

  useEffect(() => {
    if (!sessionLoading && !session) {
      router.push("/login");
    }
  }, [router, session, sessionLoading]);

  const deferredFilters = useDeferredValue({
    accountId: accountId || undefined,
    categoryId:
      categoryFilter !== "all" && categoryFilter !== "uncategorized"
        ? categoryFilter
        : undefined,
    uncategorizedOnly: categoryFilter === "uncategorized",
    pending,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    includeInactiveAccounts,
    limit: 100,
  });

  const transactionsQuery = trpc.transactions.list.useQuery(deferredFilters, {
    enabled: Boolean(session),
  });

  const { data, error, isLoading, isFetching } = transactionsQuery;
  const transactions = data?.rows ?? [];
  const hasFilters =
    Boolean(accountId) ||
    categoryFilter !== "all" ||
    pending !== "all" ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    includeInactiveAccounts;

  function resetFilters() {
    setAccountId("");
    setCategoryFilter("all");
    setPending("all");
    setDateFrom("");
    setDateTo("");
    setIncludeInactiveAccounts(false);
  }

  if (sessionLoading || (isLoading && !data)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-0 text-bone-mute">
        Loading transactions…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-0 text-bone-mute">
        Redirecting…
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-ink-0 text-bone">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute -top-32 right-[14%] h-[28rem] w-[28rem] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(232,199,145,0.05), transparent 65%)" }}
        />
        <div
          className="absolute -bottom-40 left-0 h-[30rem] w-[48rem] blur-3xl"
          style={{ background: "radial-gradient(ellipse, rgba(255,154,60,0.04), transparent 60%)" }}
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
            <span className="label-eyebrow">Ledger · 02 / 05</span>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <span className="label-eyebrow-brass">§ Transactions</span>
              <h1 className="display mt-3 text-[clamp(2rem,4vw,3.3rem)] leading-[1] text-bone">
                The living <span className="italic text-brass-hi">ledger.</span>
              </h1>
              <p className="mt-3 max-w-2xl text-[13px] leading-[1.7] text-bone-mute">
                Review the imported tape before budgets or insights depend on it. This first pass
                is read-only by design: inspect, filter, and surface uncategorized rows before we
                add reassignment.
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-[2px] border border-[var(--stroke)] bg-[var(--ink-1)] px-4 py-3 cove">
              <div className="flex size-9 items-center justify-center rounded-[2px] border border-[var(--stroke-brass-hi)] bg-[rgba(201,164,107,0.08)] text-brass-hi">
                <Wallet className="size-4" />
              </div>
              <div>
                <p className="text-[13px] text-bone">{data?.totalCount ?? 0} visible transactions</p>
                <p className="label-eyebrow">
                  {isFetching ? "Refreshing filters…" : "User-scoped view"}
                </p>
              </div>
            </div>
          </div>
        </header>

        {data && data.uncategorizedCount > 0 ? (
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-[2px] border border-[rgba(212,154,74,0.32)] bg-[rgba(212,154,74,0.08)] px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-8 items-center justify-center rounded-[2px] border border-[rgba(212,154,74,0.32)] bg-[rgba(212,154,74,0.08)] text-[var(--amber)]">
                <BadgeAlert className="size-4" />
              </div>
              <div>
                <p className="text-[13px] text-bone">
                  {data.uncategorizedCount} uncategorized transaction
                  {data.uncategorizedCount === 1 ? "" : "s"} need review.
                </p>
                <p className="mt-1 text-[12px] text-bone-mute">
                  Uncategorized rows are excluded from budget math until you assign them.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-[2px] border border-[rgba(212,154,74,0.32)] bg-[rgba(17,17,16,0.65)] px-4 text-[11px] uppercase tracking-[0.12em] text-[var(--amber)] transition-colors hover:border-[rgba(212,154,74,0.5)] hover:text-bone"
              onClick={() => setCategoryFilter("uncategorized")}
            >
              Focus uncategorized
              <ArrowRight className="size-3" />
            </button>
          </div>
        ) : null}

        {error ? (
          <p className="mb-8 flex items-center gap-3 rounded-[2px] border border-[rgba(194,106,72,0.3)] bg-[rgba(194,106,72,0.06)] px-4 py-2.5 text-[12px] text-oxide-hi">
            <CircleAlert className="size-3.5" />
            {error.message ?? "Unable to load transactions."}
          </p>
        ) : null}

        <section className="mb-8 rounded-[2px] border border-[var(--stroke)] bg-[var(--ink-1)] p-5 cove">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-[2px] border border-[var(--stroke-2)] bg-[var(--ink-0)] text-brass-hi">
                <Filter className="size-4" />
              </div>
              <div>
                <p className="text-[13px] text-bone">Filter the ledger</p>
                <p className="label-eyebrow">Account, date, category, status</p>
              </div>
            </div>

            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasFilters}
              className="inline-flex h-9 items-center gap-2 rounded-[2px] border border-[var(--stroke-2)] px-3 text-[11px] uppercase tracking-[0.12em] text-bone-mute transition-colors hover:border-[var(--stroke-brass-hi)] hover:text-brass-hi disabled:opacity-40"
            >
              Reset filters
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.2fr_1.2fr_0.8fr_0.8fr_0.8fr]">
            <label className="flex flex-col gap-2">
              <span className="label-eyebrow">Account</span>
              <select
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                className="h-10 rounded-[2px] border border-[var(--stroke-2)] bg-[var(--ink-0)] px-3 text-[13px] text-bone outline-none transition-colors focus:border-[var(--stroke-brass-hi)]"
              >
                <option value="">All accounts</option>
                {data?.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {formatAccountLabel(account.name, account.mask, account.isActive)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="label-eyebrow">Category</span>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="h-10 rounded-[2px] border border-[var(--stroke-2)] bg-[var(--ink-0)] px-3 text-[13px] text-bone outline-none transition-colors focus:border-[var(--stroke-brass-hi)]"
              >
                <option value="all">All categories</option>
                <option value="uncategorized">Uncategorized</option>
                {data?.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.groupName} · {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="label-eyebrow">Status</span>
              <select
                value={pending}
                onChange={(event) => setPending(event.target.value as PendingFilterValue)}
                className="h-10 rounded-[2px] border border-[var(--stroke-2)] bg-[var(--ink-0)] px-3 text-[13px] text-bone outline-none transition-colors focus:border-[var(--stroke-brass-hi)]"
              >
                <option value="all">All rows</option>
                <option value="pending">Pending only</option>
                <option value="posted">Posted only</option>
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="label-eyebrow">From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="h-10 rounded-[2px] border border-[var(--stroke-2)] bg-[var(--ink-0)] px-3 text-[13px] text-bone outline-none transition-colors focus:border-[var(--stroke-brass-hi)]"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="label-eyebrow">To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="h-10 rounded-[2px] border border-[var(--stroke-2)] bg-[var(--ink-0)] px-3 text-[13px] text-bone outline-none transition-colors focus:border-[var(--stroke-brass-hi)]"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--stroke)] pt-4">
            <label className="inline-flex items-center gap-3 text-[12px] text-bone-mute">
              <input
                type="checkbox"
                checked={includeInactiveAccounts}
                onChange={(event) => setIncludeInactiveAccounts(event.target.checked)}
                className="size-4 rounded-[1px] border border-[var(--stroke-2)] bg-[var(--ink-0)] accent-[var(--brass)]"
              />
              Include inactive accounts
            </label>

            <div className="flex items-center gap-2 text-[12px] text-bone-faint">
              <CalendarRange className="size-3.5" />
              Latest 100 rows, newest first
            </div>
          </div>
        </section>

        <section className="rounded-[2px] border border-[var(--stroke)] bg-[var(--ink-1)] cove">
          <div className="grid grid-cols-[110px_1.5fr_auto] gap-4 border-b border-[var(--stroke)] px-5 py-4 md:grid-cols-[110px_1.5fr_1fr_auto]">
            <span className="label-eyebrow">Date</span>
            <span className="label-eyebrow">Description</span>
            <span className="label-eyebrow hidden md:inline">Account / Category</span>
            <span className="label-eyebrow text-right">Amount</span>
          </div>

          {transactions.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto flex max-w-md flex-col items-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-[2px] border border-[var(--stroke-brass-hi)] bg-[rgba(201,164,107,0.06)] text-brass-hi">
                  <Landmark className="size-5" />
                </div>
                <h2 className="display text-[28px] leading-tight text-bone">No matching tape.</h2>
                <p className="text-[13px] leading-[1.7] text-bone-mute">
                  {hasFilters
                    ? "These filters currently hide every transaction. Reset or widen the date range."
                    : "No imported transactions are available yet. Link and sync a bank connection first."}
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[var(--stroke)]">
              {transactions.map((transaction) => {
                const amount = Number(transaction.amount);
                const isExpense = amount >= 0;
                const displayAmount = formatMoney(Math.abs(amount), transaction.currency);

                return (
                  <article
                    key={transaction.id}
                    className="grid gap-4 px-5 py-4 transition-colors hover:bg-[var(--ink-2-solid)] md:grid-cols-[110px_1.5fr_1fr_auto] md:items-center"
                  >
                    <div>
                      <p className="num text-[12px] text-bone">
                        {formatDateLabel(transaction.date)}
                      </p>
                      {transaction.authorizedDate ? (
                        <p className="label-eyebrow mt-1">
                          AUTH · {transaction.authorizedDate.slice(5)}
                        </p>
                      ) : null}
                    </div>

                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <p className="truncate text-[14px] text-bone">
                          {transaction.merchantName || transaction.name}
                        </p>
                        {transaction.pending ? (
                          <span className="pill pill-amber">Pending</span>
                        ) : null}
                        {!transaction.accountIsActive ? (
                          <span className="pill pill-bone">Inactive account</span>
                        ) : null}
                      </div>
                      <p className="truncate text-[12px] text-bone-mute">
                        {transaction.merchantName && transaction.name !== transaction.merchantName
                          ? transaction.name
                          : "Imported from Plaid"}
                      </p>
                    </div>

                    <div className="hidden min-w-0 md:block">
                      <p className="truncate text-[13px] text-bone">
                        {formatAccountLabel(
                          transaction.accountName,
                          transaction.accountMask,
                          transaction.accountIsActive,
                        )}
                      </p>
                      <p className="mt-1 truncate text-[12px] text-bone-mute">
                        {transaction.categoryName
                          ? `${transaction.categoryGroupName} · ${transaction.categoryName}`
                          : "Uncategorized"}
                      </p>
                    </div>

                    <div className="text-right">
                      <p
                        className={`text-[14px] ${
                          isExpense ? "text-oxide-hi" : "text-sage-hi"
                        }`}
                      >
                        {isExpense ? "-" : "+"}
                        {displayAmount}
                      </p>
                      <p className="label-eyebrow mt-1">{transaction.currency}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function formatAccountLabel(name: string, mask: string | null, isActive: boolean) {
  const suffix = mask ? ` ··${mask}` : "";
  return `${name}${suffix}${isActive ? "" : " · inactive"}`;
}

function formatDateLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return DATE_FORMATTER.format(new Date(year, month - 1, day));
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
