export function formatCurrency(
  amount: number,
  currency: string,
  maximumFractionDigits = 2,
  locale = "en-CA",
) {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: maximumFractionDigits === 0 ? 0 : 2,
      maximumFractionDigits,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(maximumFractionDigits)}`;
  }
}
