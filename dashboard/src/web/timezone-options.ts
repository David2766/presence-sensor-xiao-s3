export const TIMEZONE_IDS = [
  "UTC",
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Seoul",
  "Asia/Tokyo",
  "Australia/Perth",
  "Australia/Sydney",
  "Pacific/Auckland"
] as const;

export type TimezoneId = (typeof TIMEZONE_IDS)[number];

const TIMEZONE_ALIASES: Readonly<Record<string, TimezoneId>> = {
  "Etc/UTC": "UTC",
  "Etc/GMT": "UTC",
  GMT: "UTC",
  "US/Hawaii": "Pacific/Honolulu",
  "US/Alaska": "America/Anchorage",
  "US/Pacific": "America/Los_Angeles",
  "US/Mountain": "America/Denver",
  "US/Central": "America/Chicago",
  "US/Eastern": "America/New_York",
  "Asia/Calcutta": "Asia/Kolkata"
};

export function isTimezoneId(value: string | null | undefined): value is TimezoneId {
  return typeof value === "string" && TIMEZONE_IDS.includes(value as TimezoneId);
}

export function normalizeSupportedTimezone(value: string | null | undefined): TimezoneId | null {
  if (!value) return null;
  if (isTimezoneId(value)) return value;
  return TIMEZONE_ALIASES[value] ?? null;
}

export function detectBrowserTimezone(): { detected: string | null; supported: TimezoneId | null } {
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    return { detected, supported: normalizeSupportedTimezone(detected) };
  } catch {
    return { detected: null, supported: null };
  }
}
