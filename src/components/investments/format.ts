import { formatCurrency } from "@/lib/currency";

function formatMoney(value: number) {
  return formatCurrency(value, "USD", 2, "en-US");
}

export function formatNullableMoney(
  value: string | null | undefined,
  signed = false,
) {
  if (value === null || value === undefined) return "-";
  const numeric = Number(value);
  const prefix = signed && numeric > 0 ? "+" : "";
  return `${prefix}${formatMoney(numeric)}`;
}

export function formatNativeMoney(
  value: string | null | undefined,
  currency: string | null,
  signed = false,
) {
  if (value === null || value === undefined) return "-";
  const numeric = Number(value);
  const prefix = signed && numeric > 0 ? "+" : "";
  return `${prefix}${formatMoney(numeric)}${currency && currency !== "USD" ? ` ${currency}` : ""}`;
}

export function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function trimDecimal(value: string | null | undefined) {
  if (!value) return "-";
  return value.replace(/\.?0+$/, "");
}

export function isStaleDate(value: string | null | undefined) {
  if (!value) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  const now = new Date();
  const days = (now.getTime() - date.getTime()) / 86_400_000;
  return days > 7;
}
