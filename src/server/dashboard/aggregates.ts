/**
 * Dashboard overview aggregation rules as currently implemented.
 *
 * Characterized behavior: amounts are summed across all currencies with no
 * currency filter. Callers that format with the profile currency therefore
 * display a mixed-currency sum under a single currency label.
 */
export function aggregateOverviewAmounts(
  amounts: number[],
): { inflow: number; outflow: number; netCashflow: number } {
  let inflow = 0;
  let outflow = 0;
  let netCashflow = 0;

  for (const amount of amounts) {
    netCashflow += amount;
    if (amount > 0) inflow += amount;
    if (amount < 0) outflow += -amount;
  }

  return { inflow, outflow, netCashflow };
}

export function getSavingsRate(inflow: number, netCashflow: number) {
  if (inflow <= 0) return null;
  return netCashflow / inflow;
}

export function getChangeRatio(
  current: number | null,
  previous: number | null,
  comparisonAvailable: boolean,
) {
  if (!comparisonAvailable || current === null || previous === null || previous === 0) {
    return null;
  }

  return (current - previous) / Math.abs(previous);
}
