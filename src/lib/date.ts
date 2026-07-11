const MONTH_HEADING_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  month: "long",
  year: "numeric",
});

export function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatMonthHeading(value: string) {
  return MONTH_HEADING_FORMATTER.format(parseLocalDate(value));
}

export function shiftMonthStart(value: string, offset: number) {
  const [year, month] = value.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
