export const BUDGET_STATUS_LABELS = {
  on_track: "On track",
  near_limit: "Near limit",
  over: "Over",
  unbudgeted: "Unbudgeted",
  no_budget: "No budget",
} as const;

export type BudgetStatus = keyof typeof BUDGET_STATUS_LABELS;

function isBudgetStatus(status: string): status is BudgetStatus {
  return Object.prototype.hasOwnProperty.call(BUDGET_STATUS_LABELS, status);
}

export function formatBudgetStatus(status: string) {
  if (isBudgetStatus(status)) {
    return BUDGET_STATUS_LABELS[status];
  }

  return BUDGET_STATUS_LABELS.no_budget;
}
