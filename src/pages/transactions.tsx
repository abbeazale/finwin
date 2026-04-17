import Link from "next/link";
import { useRouter } from "next/router";
import { useDeferredValue, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeAlert,
  CalendarRange,
  CircleAlert,
  Landmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";

type CategoryFilterValue = "all" | "uncategorized" | string;
type PendingFilterValue = "all" | "pending" | "posted";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  month: "short",
  day: "numeric",
});

export default function TransactionsPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: session, isPending: sessionLoading } = useSession();

  const [accountId, setAccountId] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterValue>("all");
  const [pending, setPending] = useState<PendingFilterValue>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [includeInactiveAccounts, setIncludeInactiveAccounts] = useState(false);
  const [categoryMessage, setCategoryMessage] = useState<string | null>(null);

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
  const setCategoryMutation = trpc.transactions.setCategory.useMutation({
    onMutate: () => {
      setCategoryMessage(null);
    },
    onSuccess: async () => {
      await utils.transactions.list.invalidate();
    },
    onError: (error) => {
      setCategoryMessage(error.message ?? "Unable to update category.");
    },
  });

  const { data, error, isLoading, isFetching } = transactionsQuery;
  const transactions = data?.rows ?? [];
  const categoryGroups = groupCategories(data?.categories ?? []);
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
    return <PageStatus label="Warming the tape…" />;
  }

  if (!session) {
    return <PageStatus label="Redirecting…" />;
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

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 py-10 sm:px-10">
        {/* Header */}
        <header className="mb-12 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard"
              className="label-eyebrow inline-flex items-center gap-2 transition-colors hover:text-brass-hi"
            >
              <ArrowLeft className="size-3" />
              Back to desk
            </Link>
            <div className="flex items-center gap-4">
              <span className="label-eyebrow">Ledger · 02 / 05</span>
              {isFetching ? (
                <span className="label-eyebrow flex items-center gap-2 text-brass-hi">
                  <span className="h-1 w-1 rounded-full bg-brass animate-pulse-dot" />
                  Refreshing
                </span>
              ) : null}
            </div>
          </div>

          <div>
            <span className="label-eyebrow-brass">§ Transactions</span>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <h1 className="display text-[clamp(2rem,4vw,3.3rem)] leading-[1] text-bone">
                The living <span className="italic text-brass-hi">ledger.</span>
              </h1>
              <span className="num text-[13px] text-bone-mute">
                <span className="text-bone">{data?.totalCount ?? 0}</span> visible ·{" "}
                <span className="text-bone">{data?.accounts.length ?? 0}</span> accounts
              </span>
            </div>
            <p className="mt-4 max-w-2xl text-[13px] leading-[1.7] text-bone-mute">
              Imported tape, read-only by design. Inspect, filter, and surface uncategorized
              rows before budgets or insights depend on them.
            </p>
          </div>
        </header>

        {/* Uncategorized callout */}
        {data && data.uncategorizedCount > 0 ? (
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-md border border-[rgba(212,154,74,0.32)] bg-[rgba(212,154,74,0.06)] px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-8 items-center justify-center rounded border border-[rgba(212,154,74,0.32)] bg-[rgba(212,154,74,0.08)] text-[var(--amber)]">
                <BadgeAlert className="size-4" />
              </div>
              <div>
                <p className="text-[13px] text-bone">
                  <span className="num text-[var(--amber)]">{data.uncategorizedCount}</span>{" "}
                  uncategorized row{data.uncategorizedCount === 1 ? "" : "s"} awaiting review.
                </p>
                <p className="mt-1 text-[12px] text-bone-mute">
                  Excluded from budget math until assigned.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-10 gap-2 rounded-md border-[rgba(212,154,74,0.32)] bg-[rgba(17,17,16,0.65)] px-4 text-[11px] uppercase tracking-[0.12em] text-[var(--amber)] shadow-none hover:border-[rgba(212,154,74,0.5)] hover:bg-[rgba(17,17,16,0.65)] hover:text-bone"
              onClick={() => setCategoryFilter("uncategorized")}
            >
              Focus uncategorized
              <ArrowRight className="size-3" />
            </Button>
          </div>
        ) : null}

        {error ? (
          <p className="mb-8 flex items-center gap-3 rounded-md border border-[rgba(194,106,72,0.3)] bg-[rgba(194,106,72,0.06)] px-4 py-2.5 text-[12px] text-oxide-hi">
            <CircleAlert className="size-3.5" />
            {error.message ?? "Unable to load transactions."}
          </p>
        ) : null}

        {categoryMessage ? (
          <p className="mb-8 flex items-center gap-3 rounded-md border border-[rgba(194,106,72,0.3)] bg-[rgba(194,106,72,0.06)] px-4 py-2.5 text-[12px] text-oxide-hi">
            <CircleAlert className="size-3.5" />
            {categoryMessage}
          </p>
        ) : null}

        {/* Filter bar */}
        <section className="mb-8 overflow-hidden rounded-md border border-[var(--stroke)] bg-[var(--ink-1)] cove">
          <div className="flex items-center justify-between border-b border-[var(--stroke)] px-5 py-3">
            <span className="label-eyebrow-brass">Filter</span>
            <Button
              type="button"
              variant="ghost"
              onClick={resetFilters}
              disabled={!hasFilters}
              className="label-eyebrow h-auto rounded-md px-2 py-1 shadow-none hover:bg-transparent hover:text-brass-hi disabled:opacity-40"
            >
              Reset →
            </Button>
          </div>

          <div className="grid gap-px bg-[var(--stroke)] md:grid-cols-2 xl:grid-cols-5">
            <FilterCell label="Account">
              <select
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                className="filter-select"
              >
                <option value="">All accounts</option>
                {data?.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {formatAccountLabel(account.name, account.mask, account.isActive)}
                  </option>
                ))}
              </select>
            </FilterCell>

            <FilterCell label="Category">
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="filter-select"
              >
                <option value="all">All categories</option>
                <option value="uncategorized">Uncategorized</option>
                {data?.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.groupName} · {category.name}
                  </option>
                ))}
              </select>
            </FilterCell>

            <FilterCell label="Status">
              <select
                value={pending}
                onChange={(event) => setPending(event.target.value as PendingFilterValue)}
                className="filter-select"
              >
                <option value="all">All rows</option>
                <option value="pending">Pending only</option>
                <option value="posted">Posted only</option>
              </select>
            </FilterCell>

            <FilterCell label="From">
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="filter-select num"
              />
            </FilterCell>

            <FilterCell label="To">
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="filter-select num"
              />
            </FilterCell>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--stroke)] px-5 py-3">
            <label className="inline-flex items-center gap-2.5 text-[12px] text-bone-mute">
              <input
                type="checkbox"
                checked={includeInactiveAccounts}
                onChange={(event) => setIncludeInactiveAccounts(event.target.checked)}
                className="size-3.5 rounded-[1px] border border-[var(--stroke-2)] bg-[var(--ink-0)] accent-[var(--brass)]"
              />
              Include inactive accounts
            </label>
            <span className="label-eyebrow flex items-center gap-2">
              <CalendarRange className="size-3" />
              Latest 100 · newest first
            </span>
          </div>
        </section>

        {/* Tape */}
        <section className="overflow-hidden rounded-md border border-[var(--stroke)] bg-[var(--ink-1)] cove">
          {/* Column head */}
          <div className="grid grid-cols-[88px_1fr_auto] gap-4 border-b border-[var(--stroke)] px-5 py-3 md:grid-cols-[88px_1.6fr_1fr_140px]">
            <span className="label-eyebrow">Date</span>
            <span className="label-eyebrow">Merchant</span>
            <span className="label-eyebrow hidden md:inline">Account · Category</span>
            <span className="label-eyebrow text-right">Amount</span>
          </div>

          {transactions.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <div className="mx-auto flex max-w-md flex-col items-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-md border border-[var(--stroke-brass-hi)] bg-[rgba(201,164,107,0.06)] text-brass-hi">
                  <Landmark className="size-5" />
                </div>
                <h2 className="display text-[28px] leading-tight text-bone">No matching tape.</h2>
                <p className="text-[13px] leading-[1.7] text-bone-mute">
                  {hasFilters
                    ? "These filters hide every transaction. Reset or widen the date range."
                    : "No imported transactions yet. Link and sync a bank connection first."}
                </p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--stroke)]">
              {transactions.map((transaction) => {
                const amount = Number(transaction.amount);
                const isExpense = amount <= 0;
                const displayAmount = formatMoney(Math.abs(amount), transaction.currency);
                const categoryLabel = transaction.categoryName
                  ? `${transaction.categoryGroupName} · ${transaction.categoryName}`
                  : "Uncategorized";
                const isUpdatingCategory =
                  setCategoryMutation.isPending &&
                  setCategoryMutation.variables?.transactionId === transaction.id;

                return (
                  <li
                    key={transaction.id}
                    className="group grid grid-cols-[88px_1fr_auto] gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--ink-2-solid)] md:grid-cols-[88px_1.6fr_1fr_140px] md:items-center"
                  >
                    {/* Date */}
                    <div className="min-w-0">
                      <p className="num text-[12px] text-bone">
                        {formatDateLabel(transaction.date)}
                      </p>
                      {transaction.authorizedDate &&
                      transaction.authorizedDate !== transaction.date ? (
                        <p className="label-eyebrow mt-1 text-bone-faint">
                          auth {transaction.authorizedDate.slice(5)}
                        </p>
                      ) : null}
                    </div>

                    {/* Merchant */}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[13.5px] text-bone">
                          {transaction.merchantName || transaction.name}
                        </p>
                        {transaction.pending ? (
                          <span className="pill pill-amber">pending</span>
                        ) : null}
                        {!transaction.accountIsActive ? (
                          <span className="pill pill-bone">inactive</span>
                        ) : null}
                      </div>
                      {transaction.merchantName &&
                      transaction.name !== transaction.merchantName ? (
                        <p className="mt-0.5 truncate text-[11.5px] text-bone-faint">
                          {transaction.name}
                        </p>
                      ) : null}
                      <p className="mt-1 truncate text-[11px] text-bone-mute md:hidden">
                        {formatAccountLabel(
                          transaction.accountName,
                          transaction.accountMask,
                          transaction.accountIsActive,
                        )}
                      </p>
                      <div className="mt-2 md:hidden">
                        <TransactionCategorySelect
                          transactionId={transaction.id}
                          categoryId={transaction.categoryId}
                          categoryLabel={categoryLabel}
                          categoryGroups={categoryGroups}
                          disabled={isUpdatingCategory}
                          onChange={(nextCategoryId) => {
                            setCategoryMutation.mutate({
                              transactionId: transaction.id,
                              categoryId: nextCategoryId,
                            });
                          }}
                        />
                      </div>
                    </div>

                    {/* Account / Category */}
                    <div className="hidden min-w-0 md:block">
                      <p className="truncate text-[12.5px] text-bone">
                        {formatAccountLabel(
                          transaction.accountName,
                          transaction.accountMask,
                          transaction.accountIsActive,
                        )}
                      </p>
                      <div className="mt-1">
                        <TransactionCategorySelect
                          transactionId={transaction.id}
                          categoryId={transaction.categoryId}
                          categoryLabel={categoryLabel}
                          categoryGroups={categoryGroups}
                          disabled={isUpdatingCategory}
                          onChange={(nextCategoryId) => {
                            setCategoryMutation.mutate({
                              transactionId: transaction.id,
                              categoryId: nextCategoryId,
                            });
                          }}
                        />
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-right">
                      <p
                        className={`num text-[14px] tracking-tight ${
                          isExpense ? "text-oxide-hi" : "text-sage-hi"
                        }`}
                      >
                        {isExpense ? "−" : "+"}
                        {displayAmount}
                      </p>
                      {isUpdatingCategory ? (
                        <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-brass-hi">
                          Saving…
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Footer status */}
          <div className="flex items-center justify-between border-t border-[var(--stroke)] px-5 py-3">
            <span className="label-eyebrow">
              Showing {transactions.length} of {data?.totalCount ?? 0}
            </span>
            <span className="label-eyebrow">End of tape</span>
          </div>
        </section>
      </div>

    </div>
  );
}

function FilterCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="group flex flex-col bg-[var(--ink-1)]">
      <span className="label-eyebrow border-b border-[var(--stroke)] px-3 py-2">
        {label}
      </span>
      {children}
    </label>
  );
}

function PageStatus({ label }: { label: string }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-ink-0 text-bone">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute -top-32 right-[14%] h-[28rem] w-[28rem] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(232,199,145,0.05), transparent 65%)" }}
        />
      </div>
      <div className="relative z-10 flex flex-col items-center gap-3">
        <span className="h-1.5 w-1.5 rounded-full bg-brass animate-pulse-dot" />
        <span className="label-eyebrow-brass">{label}</span>
      </div>
    </div>
  );
}

type CategoryOption = {
  id: string;
  name: string;
  groupName: string;
  defaultBudgetable: boolean;
};

type GroupedCategories = Array<{
  groupName: string;
  options: CategoryOption[];
}>;

function TransactionCategorySelect({
  transactionId,
  categoryId,
  categoryLabel,
  categoryGroups,
  disabled,
  onChange,
}: {
  transactionId: string;
  categoryId: string | null;
  categoryLabel: string;
  categoryGroups: GroupedCategories;
  disabled: boolean;
  onChange: (categoryId: string | null) => void;
}) {
  return (
    <label className="block">
      <span className="sr-only">Category for transaction {transactionId.slice(0, 8)}</span>
      <select
        value={categoryId ?? ""}
        disabled={disabled}
        className="tx-category-select"
        aria-label={`Category for ${categoryLabel}`}
        onChange={(event) => {
          const nextCategoryId = event.target.value || null;
          if (nextCategoryId === categoryId) {
            return;
          }
          onChange(nextCategoryId);
        }}
      >
        <option value="">Uncategorized</option>
        {categoryGroups.map((group) => (
          <optgroup key={group.groupName} label={group.groupName}>
            {group.options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

function formatAccountLabel(name: string, mask: string | null, isActive: boolean) {
  const suffix = mask ? ` ··${mask}` : "";
  return `${name}${suffix}${isActive ? "" : " · inactive"}`;
}

function groupCategories(categories: CategoryOption[]) {
  const grouped = new Map<string, CategoryOption[]>();

  for (const category of categories) {
    const existing = grouped.get(category.groupName);
    if (existing) {
      existing.push(category);
      continue;
    }
    grouped.set(category.groupName, [category]);
  }

  return Array.from(grouped, ([groupName, options]) => ({
    groupName,
    options,
  }));
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
