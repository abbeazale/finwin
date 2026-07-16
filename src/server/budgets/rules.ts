import type { BudgetStatus } from "@/lib/budget-status";

/**
 * Canonical spend for budgeting: only money-out counts, as a positive magnitude.
 * Stored transaction amounts use positive = money in, negative = money out.
 */
export function toBudgetSpendAmount(rawActual: number) {
  return Math.max(-rawActual, 0);
}

export function partitionActualsByCurrency<T extends { currency: string; transactionCount: number }>(
  rows: T[],
  profileCurrency: string,
) {
  const matching = rows.filter((row) => row.currency === profileCurrency);
  const excludedCurrencyTransactionCount = rows
    .filter((row) => row.currency !== profileCurrency)
    .reduce((total, row) => total + row.transactionCount, 0);

  return { matching, excludedCurrencyTransactionCount };
}

export function getBudgetStatus({
  budgetAmount,
  actualAmount,
  percentUsed,
}: {
  budgetAmount: number | null;
  actualAmount: number;
  percentUsed: number | null;
}): BudgetStatus {
  if (budgetAmount === null) {
    return actualAmount > 0 ? "unbudgeted" : "no_budget";
  }

  if (actualAmount > budgetAmount) {
    return "over";
  }

  if (percentUsed !== null && percentUsed >= 0.85) {
    return "near_limit";
  }

  return "on_track";
}
