import { describe, expect, test } from "bun:test";
import {
  calculateInvestmentValue,
  getCashImpact,
  summarizeInvestmentValues,
} from "./values";

describe("getCashImpact", () => {
  test("negates Plaid investment transaction amounts for display cash impact", () => {
    expect(getCashImpact(100)).toBe(-100);
    expect(getCashImpact(-25)).toBe(25);
  });
});

describe("calculateInvestmentValue", () => {
  test("prefers a positive institution price over close price", () => {
    const value = calculateInvestmentValue({
      quantity: 2,
      institutionPrice: 10,
      institutionPriceCurrency: "USD",
      institutionPriceAsOf: "2026-01-01",
      closePrice: 9,
      closePriceCurrency: "USD",
      closePriceAsOf: "2026-01-01",
      costBasis: 16,
      costBasisCurrency: "USD",
    });

    expect(value.priceSource).toBe("institution");
    expect(value.marketValueUsd).toBe(20);
    expect(value.excludedFromUsd).toBe(false);
  });

  test("falls back to close price when institution price is missing", () => {
    const value = calculateInvestmentValue({
      quantity: 2,
      institutionPrice: null,
      institutionPriceCurrency: null,
      institutionPriceAsOf: null,
      closePrice: 11,
      closePriceCurrency: "USD",
      closePriceAsOf: "2026-01-02",
      costBasis: null,
      costBasisCurrency: null,
    });

    expect(value.priceSource).toBe("close");
    expect(value.marketValueUsd).toBe(22);
  });

  test("excludes non-USD holdings from USD totals when FX is unavailable", () => {
    const value = calculateInvestmentValue({
      quantity: 1,
      institutionPrice: 100,
      institutionPriceCurrency: "CAD",
      institutionPriceAsOf: "2026-01-01",
      closePrice: null,
      closePriceCurrency: null,
      closePriceAsOf: null,
      costBasis: 90,
      costBasisCurrency: "CAD",
      fxRates: new Map(),
    });

    expect(value.marketValueUsd).toBeNull();
    expect(value.excludedFromUsd).toBe(true);
  });

  test("converts non-USD holdings when an FX rate is present", () => {
    const value = calculateInvestmentValue({
      quantity: 1,
      institutionPrice: 130,
      institutionPriceCurrency: "CAD",
      institutionPriceAsOf: "2026-01-01",
      closePrice: null,
      closePriceCurrency: null,
      closePriceAsOf: null,
      costBasis: 100,
      costBasisCurrency: "CAD",
      fxRates: new Map([
        ["CAD", { rate: 1.3, fetchedAt: new Date("2026-01-01"), isStale: false }],
      ]),
    });

    expect(value.marketValueUsd).toBeCloseTo(100);
    expect(value.fxConverted).toBe(true);
    expect(value.excludedFromUsd).toBe(false);
  });
});

describe("summarizeInvestmentValues", () => {
  test("counts excluded holdings and sums only included USD values", () => {
    const included = calculateInvestmentValue({
      quantity: 1,
      institutionPrice: 50,
      institutionPriceCurrency: "USD",
      institutionPriceAsOf: null,
      closePrice: null,
      closePriceCurrency: null,
      closePriceAsOf: null,
      costBasis: 40,
      costBasisCurrency: "USD",
    });
    const excluded = calculateInvestmentValue({
      quantity: 1,
      institutionPrice: 10,
      institutionPriceCurrency: "EUR",
      institutionPriceAsOf: null,
      closePrice: null,
      closePriceCurrency: null,
      closePriceAsOf: null,
      costBasis: 8,
      costBasisCurrency: "EUR",
      fxRates: new Map(),
    });

    const summary = summarizeInvestmentValues([included, excluded]);
    expect(summary.excludedHoldingCount).toBe(1);
    expect(summary.totalValueUsd).toBe("50.00");
    expect(summary.totalGainLossUsd).toBe("10.00");
  });
});
