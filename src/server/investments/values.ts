export type InvestmentValueResult = {
  price: number | null;
  priceCurrency: string | null;
  priceSource: "institution" | "close" | "missing";
  priceAsOf: string | null;
  marketValueNative: number | null;
  marketValueCurrency: string | null;
  marketValueUsd: number | null;
  costBasisUsd: number | null;
  gainLossUsd: number | null;
  gainLossPct: number | null;
  fxConverted: boolean;
  fxRateStale: boolean;
  excludedFromUsd: boolean;
};

type InvestmentTotals = {
  totalValueUsd: string | null;
  totalCostBasisUsd: string | null;
  totalGainLossUsd: string | null;
  totalGainLossPct: number | null;
  costBasisAvailable: boolean;
  excludedHoldingCount: number;
  staleFxRateCount: number;
};

export type FxRateLookup = Map<string, { rate: number; fetchedAt: Date; isStale: boolean }>;

export function getDisplayAccountName(nickname: string | null, providerName: string) {
  return nickname ?? providerName;
}

export function toNumber(value: string | null): number | null {
  if (value === null) return null;
  return Number(value);
}

export function formatDecimal(value: number | null, scale = 2) {
  if (value === null || !Number.isFinite(value)) return null;
  return value.toFixed(scale);
}

function getMarketValue(quantity: number, institutionPrice: number) {
  return quantity * institutionPrice;
}

export function getCashImpact(plaidAmount: number) {
  return -plaidAmount;
}

function getGainLoss(marketValue: number | null, costBasis: number | null) {
  if (marketValue === null || costBasis === null) {
    return { gainLoss: null, gainLossPct: null };
  }

  const gainLoss = marketValue - costBasis;
  return {
    gainLoss,
    gainLossPct: costBasis > 0 ? gainLoss / costBasis : null,
  };
}

export function getNativeCurrency(
  isoCurrencyCode: string | null,
  unofficialCurrencyCode: string | null,
  fallbackCurrency: string | null,
) {
  return isoCurrencyCode ?? unofficialCurrencyCode ?? fallbackCurrency;
}

export function calculateInvestmentValue(input: {
  quantity: number;
  institutionPrice: number | null;
  institutionPriceCurrency: string | null;
  institutionPriceAsOf: string | null;
  closePrice: number | null;
  closePriceCurrency: string | null;
  closePriceAsOf: string | null;
  costBasis: number | null;
  costBasisCurrency: string | null;
  fxRates?: FxRateLookup;
}): InvestmentValueResult {
  const resolvedPrice = resolveHoldingPrice(input);
  const marketValueNative = resolvedPrice.price === null
    ? null
    : getMarketValue(input.quantity, resolvedPrice.price);
  const marketValueUsd = convertUsd(marketValueNative, resolvedPrice.currency, input.fxRates);
  const costBasisUsd = convertUsd(input.costBasis, input.costBasisCurrency, input.fxRates);
  const gainLoss = getGainLoss(marketValueUsd, costBasisUsd);
  const marketFxRate = resolvedPrice.currency ? input.fxRates?.get(resolvedPrice.currency) : undefined;
  const costBasisFxRate = input.costBasisCurrency ? input.fxRates?.get(input.costBasisCurrency) : undefined;
  const priceNeedsFx = marketValueNative !== null && resolvedPrice.currency !== null && resolvedPrice.currency !== "USD";
  const costBasisNeedsFx = input.costBasis !== null && input.costBasisCurrency !== null && input.costBasisCurrency !== "USD";

  return {
    price: resolvedPrice.price,
    priceCurrency: resolvedPrice.currency,
    priceSource: resolvedPrice.source,
    priceAsOf: resolvedPrice.asOf,
    marketValueNative,
    marketValueCurrency: resolvedPrice.currency,
    marketValueUsd,
    costBasisUsd,
    gainLossUsd: gainLoss.gainLoss,
    gainLossPct: gainLoss.gainLossPct,
    fxConverted: Boolean((priceNeedsFx && marketFxRate) || (costBasisNeedsFx && costBasisFxRate)),
    fxRateStale: Boolean(
      (priceNeedsFx && marketFxRate?.isStale) ||
      (costBasisNeedsFx && costBasisFxRate?.isStale)
    ),
    excludedFromUsd: marketValueUsd === null,
  };
}

function resolveHoldingPrice(input: {
  institutionPrice: number | null;
  institutionPriceCurrency: string | null;
  institutionPriceAsOf: string | null;
  closePrice: number | null;
  closePriceCurrency: string | null;
  closePriceAsOf: string | null;
}) {
  if (input.institutionPrice !== null && input.institutionPrice > 0) {
    return {
      price: input.institutionPrice,
      currency: input.institutionPriceCurrency,
      source: "institution" as const,
      asOf: input.institutionPriceAsOf,
    };
  }

  if (input.closePrice !== null && input.closePrice > 0) {
    return {
      price: input.closePrice,
      currency: input.closePriceCurrency,
      source: "close" as const,
      asOf: input.closePriceAsOf,
    };
  }

  return {
    price: null,
    currency: input.institutionPriceCurrency ?? input.closePriceCurrency,
    source: "missing" as const,
    asOf: input.institutionPriceAsOf ?? input.closePriceAsOf,
  };
}

function convertUsd(amount: number | null, currency: string | null, fxRates?: FxRateLookup) {
  if (amount === null) return null;
  if (currency === null || currency === "USD") return amount;

  const fxRate = fxRates?.get(currency);
  return fxRate ? amount / fxRate.rate : null;
}

export function summarizeInvestmentValues(values: InvestmentValueResult[]): InvestmentTotals {
  const included = values.filter((value) => !value.excludedFromUsd);
  const excludedHoldingCount = values.length - included.length;
  const staleFxRateCount = values.filter((value) => value.fxRateStale).length;
  const hasIncludedHoldings = included.length > 0;
  const costBasisAvailable = included.every((value) => value.costBasisUsd !== null);

  if (!hasIncludedHoldings) {
    return {
      totalValueUsd: values.length === 0 ? "0.00" : null,
      totalCostBasisUsd: null,
      totalGainLossUsd: null,
      totalGainLossPct: null,
      costBasisAvailable,
      excludedHoldingCount,
      staleFxRateCount,
    };
  }

  const totalValue = included.reduce((sum, value) => sum + (value.marketValueUsd ?? 0), 0);
  if (!costBasisAvailable) {
    return {
      totalValueUsd: formatDecimal(totalValue),
      totalCostBasisUsd: null,
      totalGainLossUsd: null,
      totalGainLossPct: null,
      costBasisAvailable,
      excludedHoldingCount,
      staleFxRateCount,
    };
  }

  const totalCostBasis = included.reduce((sum, value) => sum + (value.costBasisUsd ?? 0), 0);
  const totalGainLoss = totalValue - totalCostBasis;

  return {
    totalValueUsd: formatDecimal(totalValue),
    totalCostBasisUsd: formatDecimal(totalCostBasis),
    totalGainLossUsd: formatDecimal(totalGainLoss),
    totalGainLossPct: totalCostBasis > 0 ? totalGainLoss / totalCostBasis : null,
    costBasisAvailable,
    excludedHoldingCount,
    staleFxRateCount,
  };
}
