export const DEFAULT_TIMEZONE = "America/Toronto";

export const COMMON_CURRENCIES = [
  { value: "CAD", label: "CAD — Canadian Dollar", helper: "Amounts displayed in Canadian Dollar ($)" },
  { value: "USD", label: "USD — US Dollar", helper: "Amounts displayed in US Dollar ($)" },
  { value: "EUR", label: "EUR — Euro", helper: "Amounts displayed in Euro (€)" },
  { value: "GBP", label: "GBP — British Pound", helper: "Amounts displayed in British Pound (£)" },
  { value: "AUD", label: "AUD — Australian Dollar", helper: "Amounts displayed in Australian Dollar ($)" },
] as const;

export const COMMON_TIMEZONES = [
  { value: "America/Toronto", label: "Eastern Time — Toronto", helper: "America/Toronto" },
  { value: "America/Vancouver", label: "Pacific Time — Vancouver", helper: "America/Vancouver" },
  { value: "America/New_York", label: "Eastern Time — New York", helper: "America/New_York" },
  { value: "America/Los_Angeles", label: "Pacific Time — Los Angeles", helper: "America/Los_Angeles" },
  { value: "Europe/London", label: "GMT/BST — London", helper: "Europe/London" },
  { value: "Asia/Dubai", label: "Gulf Time — Dubai", helper: "Asia/Dubai" },
  { value: "Asia/Dhaka", label: "Bangladesh Standard Time — Dhaka", helper: "Asia/Dhaka" },
  { value: "Asia/Bangkok", label: "Indochina Time — Bangkok", helper: "Asia/Bangkok" },
  { value: "Asia/Singapore", label: "Singapore Time — Singapore", helper: "Asia/Singapore" },
  { value: "Asia/Shanghai", label: "China Standard Time — Shanghai", helper: "Asia/Shanghai" },
  { value: "Asia/Tokyo", label: "Japan Standard Time — Tokyo", helper: "Asia/Tokyo" },
  { value: "Asia/Seoul", label: "Korea Standard Time — Seoul", helper: "Asia/Seoul" },
] as const;

const commonTimezoneValues = new Set<string>(
  COMMON_TIMEZONES.map((option) => option.value),
);

export function isValidIanaTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function isSupportedOnboardingTimeZone(timeZone: string): boolean {
  return commonTimezoneValues.has(timeZone) && isValidIanaTimeZone(timeZone);
}

/** Known invalid values previously offered in onboarding. */
const LEGACY_TIMEZONE_REPAIRS: Record<string, string> = {
  "Asia/Philippines": "Asia/Shanghai",
};

export function resolveProfileTimeZone(timeZone: string | null | undefined): string {
  const candidate = timeZone?.trim() || DEFAULT_TIMEZONE;
  const repaired = LEGACY_TIMEZONE_REPAIRS[candidate] ?? candidate;
  return isValidIanaTimeZone(repaired) ? repaired : DEFAULT_TIMEZONE;
}
