// NYSE regular-session calendar shared by the screener and the market-data
// service. Holidays and 13:00 early closes come from the published NYSE
// calendars (https://www.nyse.com/markets/hours-calendars) for the covered
// years. Dates outside CALENDAR_START..CALENDAR_END are not sessions.
const CALENDAR_START = "2024-01-01";
const CALENDAR_END = "2027-12-31";

const holidays = new Set([
  "2024-01-01",
  "2024-01-15",
  "2024-02-19",
  "2024-03-29",
  "2024-05-27",
  "2024-06-19",
  "2024-07-04",
  "2024-09-02",
  "2024-11-28",
  "2024-12-25",
  "2025-01-01",
  "2025-01-09",
  "2025-01-20",
  "2025-02-17",
  "2025-04-18",
  "2025-05-26",
  "2025-06-19",
  "2025-07-04",
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
  "2026-11-26",
  "2026-12-25",
  "2027-01-01",
  "2027-01-18",
  "2027-02-15",
  "2027-03-26",
  "2027-05-31",
  "2027-06-18",
  "2027-07-05",
  "2027-09-06",
  "2027-11-25",
  "2027-12-24",
]);
const earlyCloses = new Set([
  "2024-07-03",
  "2024-11-29",
  "2024-12-24",
  "2025-07-03",
  "2025-11-28",
  "2025-12-24",
  "2026-11-27",
  "2026-12-24",
  "2027-11-26",
]);

const DAY = 86_400_000;
const MINUTE = 60_000;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const allSessions: string[] = [];
for (
  let day = Date.parse(`${CALENDAR_START}T00:00:00Z`);
  day <= Date.parse(`${CALENDAR_END}T00:00:00Z`);
  day += DAY
) {
  const date = new Date(day);
  const key = date.toISOString().slice(0, 10);
  if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6 && !holidays.has(key))
    allSessions.push(key);
}
const sessionIndex = new Map(allSessions.map((date, index) => [date, index]));

export function isSession(date: string): boolean {
  return datePattern.test(date) && sessionIndex.has(date);
}

// Sessions from `from` through `to`, inclusive and ascending.
export function sessionsBetween(from: string, to: string): string[] {
  return allSessions.filter((date) => date >= from && date <= to);
}

// The `count` sessions strictly before `date`, ascending.
export function sessionsBefore(date: string, count: number): string[] {
  let end = allSessions.findIndex((session) => session >= date);
  if (end < 0) end = allSessions.length;
  return allSessions.slice(Math.max(0, end - count), end);
}

export function sessionLength(date: string): number {
  return earlyCloses.has(date) ? 210 : 390;
}

const offsetFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  timeZoneName: "longOffset",
});

// New York UTC offset for a date. Noon UTC is 07:00 or 08:00 in New York,
// after any 02:00 daylight-saving switch, so it matches the trading day.
function newYorkOffset(date: string): string {
  const name = offsetFormat
    .formatToParts(new Date(`${date}T12:00:00Z`))
    .find((part) => part.type === "timeZoneName")?.value;
  const offset = name?.replace("GMT", "");
  if (!offset || !/^[+-]\d{2}:\d{2}$/.test(offset))
    throw new Error(`No New York offset for ${date}.`);
  return offset;
}

// Epoch milliseconds of a New York wall-clock time ("HH:MM") on `date`.
export function newYorkTime(date: string, time: string): number {
  return Date.parse(`${date}T${time}:00${newYorkOffset(date)}`);
}

export function sessionOpen(date: string): number {
  return newYorkTime(date, "09:30");
}

export function sessionClose(date: string): number {
  return sessionOpen(date) + sessionLength(date) * MINUTE;
}

// New York trading date of an epoch time.
const dateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function newYorkDate(at: number): string {
  return dateFormat.format(new Date(at));
}
