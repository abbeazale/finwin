import { describe, expect, test } from "bun:test";
import {
  getBudgetStatus,
  partitionActualsByCurrency,
  toBudgetSpendAmount,
} from "./rules";

describe("toBudgetSpendAmount", () => {
  test("converts money-out to a positive spend magnitude", () => {
    expect(toBudgetSpendAmount(-42.5)).toBe(42.5);
  });

  test("ignores money-in when computing budget spend", () => {
    expect(toBudgetSpendAmount(100)).toBe(0);
  });
});

describe("partitionActualsByCurrency", () => {
  test("keeps profile-currency rows and counts excluded transactions", () => {
    const result = partitionActualsByCurrency(
      [
        { currency: "CAD", transactionCount: 3, categoryId: "a" },
        { currency: "USD", transactionCount: 2, categoryId: "b" },
        { currency: "CAD", transactionCount: 1, categoryId: "c" },
      ],
      "CAD",
    );

    expect(result.matching).toHaveLength(2);
    expect(result.excludedCurrencyTransactionCount).toBe(2);
  });
});

describe("getBudgetStatus", () => {
  test("marks spend without a budget as unbudgeted", () => {
    expect(
      getBudgetStatus({ budgetAmount: null, actualAmount: 10, percentUsed: null }),
    ).toBe("unbudgeted");
  });

  test("marks empty categories without a budget as no_budget", () => {
    expect(
      getBudgetStatus({ budgetAmount: null, actualAmount: 0, percentUsed: null }),
    ).toBe("no_budget");
  });

  test("marks over-budget spend as over", () => {
    expect(
      getBudgetStatus({ budgetAmount: 100, actualAmount: 101, percentUsed: 1.01 }),
    ).toBe("over");
  });

  test("marks 85% usage as near_limit", () => {
    expect(
      getBudgetStatus({ budgetAmount: 100, actualAmount: 85, percentUsed: 0.85 }),
    ).toBe("near_limit");
  });

  test("marks lower usage as on_track", () => {
    expect(
      getBudgetStatus({ budgetAmount: 100, actualAmount: 84, percentUsed: 0.84 }),
    ).toBe("on_track");
  });
});
