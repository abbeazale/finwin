import { useEffect, useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BUDGET_STATUS_LABELS } from "@/lib/budget-status";
import { formatCurrency } from "@/lib/currency";
import { formatMonthHeading } from "@/lib/date";
import { trpc, type RouterOutputs } from "@/lib/trpc";

export const budgetChartConfig = {
  budget: { label: "Budget", color: "var(--chart-1)" },
  actual: { label: "Actual", color: "var(--chart-2)" },
} satisfies ChartConfig;

type SummaryRow =
  RouterOutputs["budgets"]["summary"]["groups"][number]["rows"][number];

const STATUS_LABELS: Record<SummaryRow["status"], string> =
  BUDGET_STATUS_LABELS;

const STATUS_PILL: Record<SummaryRow["status"], string> = {
  on_track: "pill-sage",
  near_limit: "pill-amber",
  over: "pill-oxide",
  unbudgeted: "pill-bone",
  no_budget: "pill-bone",
};

const STATUS_BAR: Record<SummaryRow["status"], string> = {
  on_track: "bg-[var(--sage)]",
  near_limit: "bg-[var(--amber)]",
  over: "bg-[var(--oxide)]",
  unbudgeted: "bg-[var(--stroke-2)]",
  no_budget: "bg-[var(--stroke-2)]",
};

export function BudgetCategoryCard({
  row,
  month,
  currency,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
}: {
  row: SummaryRow;
  month: string;
  currency: string;
  onSave: (amount: number) => void;
  onDelete: () => void;
  isSaving: boolean;
  isDeleting: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftAmount, setDraftAmount] = useState(row.budgetAmount ?? "");
  const [rowError, setRowError] = useState<string | null>(null);

  const budgetAmount =
    row.budgetAmount === null ? null : Number(row.budgetAmount);
  const actualAmount = Number(row.actualAmount);
  const remainingAmount =
    row.remainingAmount === null ? null : Number(row.remainingAmount);
  const progressValue =
    row.percentUsed === null ? 0 : Math.min(row.percentUsed * 100, 100);

  const txQuery = trpc.transactions.list.useQuery(
    {
      categoryId: row.categoryId,
      dateFrom: month,
      dateTo: getLastDayOfMonth(month),
      includeInactiveAccounts: true,
      currency,
      limit: 5,
    },
    { enabled: true },
  );

  function startEdit() {
    setDraftAmount(row.budgetAmount ?? "");
    setRowError(null);
    setIsEditing(true);
  }

  function cancelEdit() {
    setIsEditing(false);
    setRowError(null);
  }

  function saveBudget() {
    setRowError(null);
    const trimmed = draftAmount.trim();
    if (!trimmed) {
      setRowError("Enter an amount.");
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setRowError("Budget amount must be zero or greater.");
      return;
    }
    onSave(parsed);
    setIsEditing(false);
  }

  function confirmDelete() {
    if (
      !confirm(
        `Delete the ${row.categoryName} budget for ${formatMonthHeading(month)}?`,
      )
    ) {
      return;
    }
    onDelete();
    setIsEditing(false);
  }

  return (
    <article className="overflow-hidden rounded-md border border-[var(--stroke)] bg-[var(--ink-0)]/80 transition-colors hover:border-[var(--stroke-2)]">
      <div
        className={`h-0.5 w-full transition-colors ${STATUS_BAR[row.status]}`}
      />

      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[14.5px] font-[450] text-bone">
              {row.categoryName}
            </p>
            <p className="mt-1 text-[12px] text-bone-mute">
              Actual {formatMoney(actualAmount, currency)}
              {remainingAmount !== null
                ? ` · Remaining ${formatSignedMoney(remainingAmount, currency)}`
                : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`pill ${STATUS_PILL[row.status]}`}>
              {STATUS_LABELS[row.status]}
            </span>
            {!isEditing && (
              <button
                type="button"
                onClick={startEdit}
                className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11px] text-bone-mute transition-colors hover:bg-[var(--ink-3)] hover:text-bone"
              >
                <Pencil className="size-3" />
                Edit
              </button>
            )}
          </div>
        </div>

        {budgetAmount !== null ? (
          <div className="mt-4 flex items-center gap-3">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--ink-3)]">
              <div
                className={`h-full rounded-full transition-all duration-700 ${STATUS_BAR[row.status]}`}
                style={{ width: `${progressValue}%` }}
              />
            </div>
            <span className="num text-[11px] tabular-nums text-bone-faint">
              {row.percentUsed !== null
                ? `${Math.round(row.percentUsed * 100)}%`
                : "—"}
            </span>
          </div>
        ) : null}

        {isEditing ? (
          <div className="mt-4 rounded-md border border-[var(--stroke)] bg-[var(--ink-1)] p-4">
            <span className="label-eyebrow mb-2.5 block">Monthly target</span>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={draftAmount}
                autoFocus
                aria-invalid={Boolean(rowError)}
                className="input-arch flex-1"
                placeholder="0.00"
                onChange={(e) => setDraftAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveBudget();
                  if (e.key === "Escape") cancelEdit();
                }}
              />
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="btn-brass"
                  disabled={isSaving || isDeleting}
                  onClick={saveBudget}
                >
                  {isSaving ? "Saving…" : "Save"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="btn-ghost"
                  disabled={isSaving || isDeleting}
                  onClick={cancelEdit}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="btn-ghost text-oxide-hi hover:text-oxide-hi"
                  disabled={isSaving || isDeleting}
                  onClick={confirmDelete}
                >
                  {isDeleting ? "Removing…" : "Delete"}
                </Button>
              </div>
            </div>
            {rowError ? (
              <p className="mt-2 text-[12px] text-oxide-hi">{rowError}</p>
            ) : null}
          </div>
        ) : (
          <>
            {budgetAmount !== null ? (
              <p className="mt-3 text-[11px] text-bone-faint">
                Target {formatMoney(budgetAmount, currency)} ·{" "}
                {formatMonthHeading(month)}
              </p>
            ) : null}

            <div className="mt-4">
              <div className="mb-2 h-px bg-[var(--stroke)]" />
              {txQuery.isLoading ? (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 3 }, (_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="h-2.5 w-32 animate-pulse rounded bg-[var(--ink-3)]" />
                      <div className="h-2.5 w-14 animate-pulse rounded bg-[var(--ink-3)]" />
                    </div>
                  ))}
                </div>
              ) : txQuery.data && txQuery.data.rows.length > 0 ? (
                <ul className="flex flex-col gap-1.5">
                  {txQuery.data.rows.map((tx) => (
                    <li
                      key={tx.id}
                      className="flex items-center justify-between gap-3 py-0.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[12px] text-bone">
                          {tx.merchantName ?? tx.name}
                        </p>
                        <p className="text-[11px] text-bone-faint">{tx.date}</p>
                      </div>
                      <span className="num shrink-0 text-[12px] tabular-nums text-bone-mute">
                        {formatMoney(Math.abs(Number(tx.amount)), currency)}
                      </span>
                    </li>
                  ))}
                  {txQuery.data.totalCount > 5 ? (
                    <li className="pt-1 text-[11px] text-bone-ghost">
                      +{txQuery.data.totalCount - 5} more transactions
                    </li>
                  ) : null}
                </ul>
              ) : (
                <p className="text-[12px] text-bone-ghost">
                  No transactions this month.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </article>
  );
}

export function AddCategorySection({
  unbudgetedRows,
  currency,
  onSave,
  isSaving,
}: {
  unbudgetedRows: SummaryRow[];
  currency: string;
  onSave: (categoryId: string, amount: number) => void;
  isSaving: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [draftAmount, setDraftAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const resolvedSelectedCategoryId =
    unbudgetedRows.find((row) => row.categoryId === selectedCategoryId)
      ?.categoryId ??
    unbudgetedRows[0]?.categoryId ??
    "";

  function handleSave() {
    setFormError(null);
    if (!resolvedSelectedCategoryId) {
      setFormError("Select a category.");
      return;
    }
    const trimmed = draftAmount.trim();
    if (!trimmed) {
      setFormError("Enter a budget amount.");
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setFormError("Amount must be zero or greater.");
      return;
    }
    onSave(resolvedSelectedCategoryId, parsed);
    setSelectedCategoryId("");
    setDraftAmount("");
    setIsOpen(false);
  }

  function handleCancel() {
    setIsOpen(false);
    setDraftAmount("");
    setFormError(null);
  }

  if (!isOpen) {
    return (
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 rounded-md border border-dashed border-[var(--stroke-2)] px-4 py-2.5 text-[12px] text-bone-mute transition-colors hover:border-[var(--stroke-3)] hover:text-bone"
        >
          <Plus className="size-3.5" />
          Add category
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-md border border-[var(--stroke)] bg-[var(--ink-0)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="label-eyebrow-brass">Add budget category</span>
        <button
          type="button"
          onClick={handleCancel}
          className="rounded p-1 text-bone-mute transition-colors hover:bg-[var(--ink-3)] hover:text-bone"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="label-eyebrow mb-1.5 block text-bone-faint">
            Category
          </label>
          <select
            value={resolvedSelectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="input-arch w-full"
          >
            {unbudgetedRows.map((row) => (
              <option key={row.categoryId} value={row.categoryId}>
                {row.categoryName}
                {Number(row.actualAmount) > 0
                  ? ` (${formatMoney(Number(row.actualAmount), currency)} spent)`
                  : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="label-eyebrow mb-1.5 block text-bone-faint">
            Monthly target
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={draftAmount}
            placeholder="0.00"
            aria-invalid={Boolean(formError)}
            className="input-arch w-full"
            onChange={(e) => setDraftAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className="btn-brass"
            disabled={isSaving}
            onClick={handleSave}
          >
            {isSaving ? "Saving…" : "Add"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="btn-ghost"
            disabled={isSaving}
            onClick={handleCancel}
          >
            Cancel
          </Button>
        </div>
      </div>

      {formError ? (
        <p className="mt-2 text-[12px] text-oxide-hi">{formError}</p>
      ) : null}
    </div>
  );
}

export function SummaryMetric({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "sage" | "oxide";
}) {
  const toneClass =
    tone === "sage"
      ? "text-sage-hi"
      : tone === "oxide"
        ? "text-oxide-hi"
        : "text-bone";

  return (
    <div className="rounded-md border border-[var(--stroke)] bg-[var(--ink-0)] px-4 py-4">
      <p className="label-eyebrow text-bone-faint">{label}</p>
      <p
        className={`num mt-2 text-[18px] leading-none tracking-tight ${toneClass}`}
      >
        {value}
      </p>
      {sub ? <p className="mt-1 text-[11px] text-bone-ghost">{sub}</p> : null}
    </div>
  );
}

export function BudgetGroupSkeleton() {
  return (
    <div className="overflow-hidden rounded-md border border-[var(--stroke)] bg-[var(--ink-1)] cove">
      <div className="border-b border-[var(--stroke)] px-5 py-4">
        <div className="h-2.5 w-24 animate-pulse rounded bg-[var(--ink-3)]" />
        <div className="mt-2 h-2.5 w-40 animate-pulse rounded bg-[var(--ink-3)]" />
      </div>
      <div className="p-5">
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-md border border-[var(--stroke)] bg-[var(--ink-0)]/80"
            >
              <div className="h-0.5 w-full animate-pulse bg-[var(--ink-3)]" />
              <div className="p-5">
                <div className="h-4 w-28 animate-pulse rounded bg-[var(--ink-3)]" />
                <div className="mt-2 h-3 w-36 animate-pulse rounded bg-[var(--ink-3)]" />
                <div className="mt-4 h-1 w-full animate-pulse rounded-full bg-[var(--ink-3)]" />
                <div className="my-4 h-px bg-[var(--stroke)]" />
                <div className="h-3 w-full animate-pulse rounded bg-[var(--ink-3)]" />
                <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-[var(--ink-3)]" />
                <div className="mt-2 h-3 w-3/5 animate-pulse rounded bg-[var(--ink-3)]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type ChartRow = { category: string; budget: number; actual: number };

export function ChartModal({
  open,
  onClose,
  data,
  month,
}: {
  open: boolean;
  onClose: () => void;
  data: ChartRow[];
  month: string;
}) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative z-10 w-full max-w-4xl overflow-hidden rounded-lg border border-[var(--stroke)] bg-[var(--ink-1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--stroke)] px-6 py-4">
          <div>
            <span className="label-eyebrow-brass">Where the pressure sits</span>
            <p className="mt-1 text-[12px] text-bone-faint">
              All categories · {formatMonthHeading(month)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-bone-mute transition-colors hover:bg-[var(--ink-3)] hover:text-bone"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-6">
          <ChartContainer
            config={budgetChartConfig}
            className="min-h-[400px] w-full"
          >
            <BarChart
              accessibilityLayer
              data={data}
              margin={{ left: 8, right: 8 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="category"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="budget" radius={4} fill="var(--color-budget)" />
              <Bar dataKey="actual" radius={4} fill="var(--color-actual)" />
            </BarChart>
          </ChartContainer>
        </div>
      </div>
    </div>
  );
}

export function getDaysLeftInMonth(monthStart: string) {
  const [year, month] = monthStart.split("-").map(Number);
  const today = new Date();
  const lastDay = new Date(year, month, 0).getDate();
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() + 1 === month;
  return isCurrentMonth ? lastDay - today.getDate() : 0;
}

export function getLastDayOfMonth(monthStart: string) {
  const [year, month] = monthStart.split("-").map(Number);
  const lastDay = new Date(year, month, 0);
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;
}

export function formatMoney(value: number, currency: string) {
  return formatCurrency(value, currency);
}

export function formatSignedMoney(value: number, currency: string) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatMoney(Math.abs(value), currency)}`;
}

export function abbreviateCategory(value: string) {
  return value.length > 11 ? `${value.slice(0, 10)}…` : value;
}
