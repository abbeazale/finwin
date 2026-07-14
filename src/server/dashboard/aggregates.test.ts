import { describe, expect, test } from "bun:test";
import {
  aggregateOverviewAmounts,
  getChangeRatio,
  getSavingsRate,
} from "./aggregates";

describe("aggregateOverviewAmounts", () => {
  test("sums mixed-currency amounts without filtering by currency", () => {
    // Characterized current dashboard behavior: CAD and USD magnitudes are
    // added together before the UI labels the result with the profile currency.
    const totals = aggregateOverviewAmounts([100, -40, 25, -10]);
    expect(totals).toEqual({
      inflow: 125,
      outflow: 50,
      netCashflow: 75,
    });
  });
});

describe("getSavingsRate", () => {
  test("returns null when inflow is not positive", () => {
    expect(getSavingsRate(0, 0)).toBeNull();
    expect(getSavingsRate(-10, -10)).toBeNull();
  });

  test("divides net cashflow by inflow", () => {
    expect(getSavingsRate(200, 50)).toBe(0.25);
  });
});

describe("getChangeRatio", () => {
  test("returns null when comparison is unavailable or previous is zero", () => {
    expect(getChangeRatio(10, 5, false)).toBeNull();
    expect(getChangeRatio(10, 0, true)).toBeNull();
  });

  test("computes signed relative change", () => {
    expect(getChangeRatio(120, 100, true)).toBe(0.2);
    expect(getChangeRatio(80, 100, true)).toBe(-0.2);
  });
});
