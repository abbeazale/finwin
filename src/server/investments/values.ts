export type InvestmentValueResult = {
  nativeCurrency: string | null;
  marketValueNative: number;
  marketValueUsd: number | null;
  costBasisUsd: number | null;
  gainLossUsd: number | null;
  gainLossPct: number | null;
  fxConverted: boolean;
  fxRateStale: boolean;
  excludedFromUsd: boolean;
};

export type InvestmentTotals = {
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

export function getMarketValue(quantity: number, institutionPrice: number) {
  return quantity * institutionPrice;
}

export function getCashImpact(plaidAmount: number) {
  return -plaidAmount;
}

export function getGainLoss(marketValue: number | null, costBasis: number | null) {
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
  institutionPrice: number;
  costBasis: number | null;
  nativeCurrency: string | null;
  fxRates?: FxRateLookup;
}): InvestmentValueResult {
  const marketValueNative = getMarketValue(input.quantity, input.institutionPrice);
  const isUsd = input.nativeCurrency === null || input.nativeCurrency === "USD";
  const fxRate = input.nativeCurrency ? input.fxRates?.get(input.nativeCurrency) : undefined;
  const canConvert = isUsd || Boolean(fxRate);
  const marketValueUsd = isUsd
    ? marketValueNative
    : fxRate
      ? marketValueNative / fxRate.rate
      : null;
  const costBasisUsd = isUsd
    ? input.costBasis
    : fxRate && input.costBasis !== null
      ? input.costBasis / fxRate.rate
      : null;
  const gainLoss = getGainLoss(marketValueUsd, costBasisUsd);

  return {
    nativeCurrency: input.nativeCurrency,
    marketValueNative,
    marketValueUsd,
    costBasisUsd,
    gainLossUsd: gainLoss.gainLoss,
    gainLossPct: gainLoss.gainLossPct,
    fxConverted: !isUsd && Boolean(fxRate),
    fxRateStale: !isUsd && Boolean(fxRate?.isStale),
    excludedFromUsd: !canConvert,
  };
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
