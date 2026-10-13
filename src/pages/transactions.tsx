import { useDeferredValue, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeAlert,
  CalendarRange,
  CircleAlert,
  Landmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageStatus } from "@/components/page-status";
import { AppShell } from "@/components/dashboard/app-shell";
import { Notice, PageHeading, ShellLoading } from "@/components/dashboard/desk-ui";
import { formatDateTile } from "@/components/dashboard/metrics";
import { useRequireSession } from "@/hooks/use-require-session";
import { formatCurrency } from "@/lib/currency";
import { parseLocalDate } from "@/lib/date";
import { trpc, type RouterInputs, type RouterOutputs } from "@/lib/trpc";

type CategoryFilterValue = "all" | "uncategorized" | string;
type PendingFilterValue = NonNullable<RouterInputs["transactions"]["list"]["pending"]>;

const PENDING_FILTER_VALUES = ["all", "pending", "posted"] as const satisfies readonly PendingFilterValue[];
const PAGE_SIZE = 100;

const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  month: "short",
  day: "numeric",
});

function isPendingFilterValue(value: string): value is PendingFilterValue {
  return PENDING_FILTER_VALUES.some((option) => option === value);
}

function buildFilterKey(input: {
  accountId: string;
  categoryFilter: CategoryFilterValue;
  pending: PendingFilterValue;
  dateFrom: string;
  dateTo: string;
  includeInactiveAccounts: boolean;
}) {
  return [
    input.accountId,
    input.categoryFilter,
    input.pending,
    input.dateFrom,
    input.dateTo,
    input.includeInactiveAccounts ? "1" : "0",
  ].join("|");
}

export default function TransactionsPage() {
  const utils = trpc.useUtils();
  const { session, isPending: sessionLoading } = useRequireSession();

  const [accountId, setAccountId] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterValue>("all");
  const [pending, setPending] = useState<PendingFilterValue>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [includeInactiveAccounts, setIncludeInactiveAccounts] = useState(false);
  const [pageOffset, setPageOffset] = useState(0);
  const [offsetFilterKey, setOffsetFilterKey] = useState("");
  const [categoryMessage, setCategoryMessage] = useState<string | null>(null);

  const filterKey = buildFilterKey({
    accountId,
    categoryFilter,
    pending,
    dateFrom,
    dateTo,
    includeInactiveAccounts,
  });
  const offset = offsetFilterKey === filterKey ? pageOffset : 0;

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
    limit: PAGE_SIZE,
    offset,
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
      setCategoryMessage(error.message);
    },
  });

  const { data, error, isLoading, isFetching } = transactionsQuery;
  const transactions = data?.rows ?? [];
  const totalCount = data?.totalCount ?? 0;
  const rangeStart = totalCount === 0 ? 0 : (data?.offset ?? 0) + 1;
  const rangeEnd = (data?.offset ?? 0) + transactions.length;
  const categoryGroups = groupCategories(data?.categories ?? []);
  const hasFilters =
    Boolean(accountId) ||
    categoryFilter !== "all" ||
    pending !== "all" ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    includeInactiveAccounts;

  function goToOffset(nextOffset: number) {
    setOffsetFilterKey(filterKey);
    setPageOffset(nextOffset);
  }

  function resetFilters() {
    setAccountId("");
    setCategoryFilter("all");
    setPending("all");
    setDateFrom("");
    setDateTo("");
    setIncludeInactiveAccounts(false);
    setOffsetFilterKey("");
    setPageOffset(0);
  }

  if (sessionLoading || (isLoading && !data)) {
    return (
      <AppShell>
        <ShellLoading label="Loading transactions…" />
      </AppShell>
    );
  }

  if (!session) {
    return <PageStatus label="Redirecting…" />;
  }

  return (
    <AppShell
      actions={
        isFetching ? (
          <span className="hidden items-center gap-2 text-[12.5px] text-brass-hi sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-brass animate-pulse-dot" />
            Refreshing
          </span>
        ) : null
      }
    >
      <PageHeading
        kicker={`${data?.totalCount ?? 0} transactions across ${data?.accounts.length ?? 0} accounts`}
        title={
          <>
            Every <span className="italic text-brass-hi">transaction.</span>
          </>
        }
        description="Everything your banks have imported. Filter the list, and give uncategorized rows a category so they count toward your budgets."
      />

      {data && data.uncategorizedCount > 0 ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[16px] border border-[rgba(212,154,74,0.3)] bg-[rgba(212,154,74,0.05)] px-5 py-4">
          <div className="flex items-start gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[rgba(212,154,74,0.32)] bg-[rgba(212,154,74,0.08)] text-amber">
              <BadgeAlert className="size-4" />
            </div>
            <div>
              <p className="text-[14px] text-bone">
                <span className="text-amber">{data.uncategorizedCount}</span>{" "}
                uncategorized transaction{data.uncategorizedCount === 1 ? "" : "s"} to review
              </p>
              <p className="mt-1 text-[12.5px] text-bone-mute">
                They don’t count toward a budget until they have a category.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="btn-soft"
            onClick={() => setCategoryFilter("uncategorized")}
          >
            Show uncategorized
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      ) : null}

      {error ? (
        <Notice tone="error" icon={<CircleAlert />}>
          {error.message}
        </Notice>
      ) : null}

      {categoryMessage ? (
        <Notice tone="error" icon={<CircleAlert />}>
          {categoryMessage}
        </Notice>
      ) : null}

      <section className="desk-panel mb-6 p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="display text-[22px] leading-none text-bone">Filters</h2>
          <Button
            type="button"
            variant="ghost"
            onClick={resetFilters}
            disabled={!hasFilters}
            className="h-auto px-0 py-0 text-[13px] font-normal text-bone-mute shadow-none hover:bg-transparent hover:text-brass-hi disabled:opacity-40"
          >
            Clear filters
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <FilterField label="Account">
            <select
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              className="form-input"
            >
              <option value="">All accounts</option>
              {data?.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {formatAccountLabel(account.name, account.mask, account.isActive)}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Category">
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="form-input"
            >
              <option value="all">All categories</option>
              <option value="uncategorized">Uncategorized</option>
              {data?.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.groupName} · {category.name}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Status">
            <select
              value={pending}
              onChange={(event) => {
                const nextValue = event.target.value;
                if (isPendingFilterValue(nextValue)) {
                  setPending(nextValue);
                }
              }}
              className="form-input"
            >
              <option value="all">Pending and posted</option>
              <option value="pending">Pending only</option>
              <option value="posted">Posted only</option>
            </select>
          </FilterField>

          <FilterField label="From">
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="form-input"
            />
          </FilterField>

          <FilterField label="To">
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="form-input"
            />
          </FilterField>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2.5 text-[13px] text-bone-mute">
            <input
              type="checkbox"
              checked={includeInactiveAccounts}
              onChange={(event) => setIncludeInactiveAccounts(event.target.checked)}
              className="size-4 rounded-[4px] border border-[var(--stroke-2)] bg-[var(--ink-0)] accent-[var(--brass)]"
            />
            Include inactive accounts
          </label>
          <span className="flex items-center gap-2 text-[12.5px] text-bone-faint">
            <CalendarRange className="size-3.5" />
            {PAGE_SIZE} per page, newest first
          </span>
        </div>
      </section>

      <section className="desk-panel">
        <div className="grid grid-cols-[44px_1fr_auto] gap-4 border-b border-[var(--stroke)] px-6 pb-3 pt-5 md:grid-cols-[44px_1.6fr_1fr_140px]">
          <span className="table-head">Date</span>
          <span className="table-head">Merchant</span>
          <span className="table-head hidden md:inline">Account and category</span>
          <span className="table-head text-right">Amount</span>
        </div>

        {transactions.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <div className="mx-auto flex max-w-md flex-col items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-full border border-[var(--stroke-brass-hi)] bg-[rgba(201,164,107,0.06)] text-brass-hi">
                <Landmark className="size-5" />
              </div>
              <h2 className="display text-[28px] leading-tight text-bone">
                Nothing here yet.
              </h2>
              <p className="text-[13.5px] leading-[1.7] text-bone-mute">
                {hasFilters
                  ? "No transactions match these filters. Clear them or widen the dates."
                  : "No imported transactions yet. Connect a bank and sync it first."}
              </p>
            </div>
          </div>
        ) : (
          <ul className="px-3 py-2">
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
              const tile = formatDateTile(transaction.date);
              const categorySelect = (
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
              );

              return (
                <li
                  key={transaction.id}
                  className="grid grid-cols-[44px_1fr_auto] gap-4 rounded-[12px] px-3 py-3 transition-colors hover:bg-[rgba(232,225,210,0.03)] md:grid-cols-[44px_1.6fr_1fr_140px] md:items-center"
                >
                  <div
                    className="flex size-11 flex-col items-center justify-center rounded-[11px] border border-[var(--stroke)] bg-[var(--ink-0)]"
                    title={
                      transaction.authorizedDate &&
                      transaction.authorizedDate !== transaction.date
                        ? `Authorized ${formatDateLabel(transaction.authorizedDate)}`
                        : undefined
                    }
                  >
                    <span className="text-[9.5px] leading-none text-bone-faint">
                      {tile.month}
                    </span>
                    <span className="display mt-0.5 text-[18px] leading-none text-bone">
                      {tile.day}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[14px] text-bone">
                        {transaction.merchantName || transaction.name}
                      </p>
                      {transaction.pending ? (
                        <span className="pill pill--soft pill-amber">Pending</span>
                      ) : null}
                      {!transaction.accountIsActive ? (
                        <span className="pill pill--soft pill-bone">Inactive</span>
                      ) : null}
                    </div>
                    {transaction.merchantName &&
                    transaction.name !== transaction.merchantName ? (
                      <p className="mt-0.5 truncate text-[12px] text-bone-faint">
                        {transaction.name}
                      </p>
                    ) : null}
                    <p className="mt-1 truncate text-[12px] text-bone-mute md:hidden">
                      {formatAccountLabel(
                        transaction.accountName,
                        transaction.accountMask,
                        transaction.accountIsActive,
                      )}
                    </p>
                    <div className="mt-2 md:hidden">{categorySelect}</div>
                  </div>

                  <div className="hidden min-w-0 md:block">
                    <p className="truncate text-[13px] text-bone">
                      {formatAccountLabel(
                        transaction.accountName,
                        transaction.accountMask,
                        transaction.accountIsActive,
                      )}
                    </p>
                    <div className="mt-1.5">{categorySelect}</div>
                  </div>

                  <div className="text-right">
                    <p
                      className={`num text-[14px] tracking-tight ${
                        isExpense ? "text-bone" : "text-sage-hi"
                      }`}
                    >
                      {isExpense ? "−" : "+"}
                      {displayAmount}
                    </p>
                    {isUpdatingCategory ? (
                      <p className="mt-1 text-[11.5px] text-brass-hi">Saving…</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--stroke)] px-6 py-4">
          <span className="text-[12.5px] text-bone-faint">
            Showing {rangeStart}–{rangeEnd} of {totalCount}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              className="btn-soft"
              disabled={offset <= 0 || isFetching}
              onClick={() => goToOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              <ArrowLeft className="size-3.5" />
              Previous
            </Button>
            {data?.hasMore ? (
              <Button
                type="button"
                variant="ghost"
                className="btn-soft"
                disabled={isFetching}
                onClick={() => goToOffset(offset + PAGE_SIZE)}
              >
                Next
                <ArrowRight className="size-3.5" />
              </Button>
            ) : (
              <span className="px-2 text-[12.5px] text-bone-faint">End of list</span>
            )}
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

type CategoryOption = RouterOutputs["transactions"]["list"]["categories"][number];

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
  return DATE_FORMATTER.format(parseLocalDate(date));
}

function formatMoney(amount: number, currency: string) {
  return formatCurrency(amount, currency);
}
