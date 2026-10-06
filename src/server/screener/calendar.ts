// Fixed daily-history calendar: 2025-08-01 through 2026-09-15.
// NYSE holiday/early-close calendars are linked in the calculation contract.
const holidays = new Set([
  "2025-09-01",
  "2025-11-27",
  "2025-12-25",
  "2026-01-01",
  "2026-01-19",
  "2026-02-16",
  "2026-04-03",
  "2026-05-25",
  "2026-06-19",
  "2026-07-03",
  "2026-09-07",
]);
const earlyCloses = new Set(["2025-11-28", "2025-12-24"]);
export const dailySessions: { date: string; close: number }[] = [];
for (
  let day = Date.parse("2025-08-01T00:00:00Z");
  day < Date.parse("2026-09-16T00:00:00Z");
  day += 86_400_000
) {
  const date = new Date(day);
  const key = date.toISOString().slice(0, 10);
  if (date.getUTCDay() === 0 || date.getUTCDay() === 6 || holidays.has(key))
    continue;
  const offset =
    key >= "2025-11-02" && key < "2026-03-08" ? "-05:00" : "-04:00";
  dailySessions.push({
    date: key,
    close: Date.parse(
      `${key}T${earlyCloses.has(key) ? "13" : "16"}:00:00${offset}`,
    ),
  });
}
