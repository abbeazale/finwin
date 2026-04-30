/**
 * Formats a numeric money value to a fixed-2 string, preserving `null` as `null`.
 * Used by month-scoped tRPC procedures that ship `numeric(12,2)` values to the
 * client as strings.
 */
export function formatMoneyValue(value: number): string;
export function formatMoneyValue(value: null): null;
export function formatMoneyValue(value: number | null): string | null;
export function formatMoneyValue(value: number | null) {
  if (value === null) {
    return null;
  }

  return value.toFixed(2);
}
