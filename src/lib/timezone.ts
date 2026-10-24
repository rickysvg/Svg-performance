/** Gym fallback when the athlete has not saved a zone and no cookie is present. */
export const APP_TIMEZONE = "America/Denver";
export const TIMEZONE_COOKIE = "svg_tz";

export const TIMEZONE_OPTIONS = [
  { value: "Pacific/Honolulu", label: "Hawaii (Honolulu)" },
  { value: "America/Anchorage", label: "Alaska (Anchorage)" },
  { value: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
  { value: "America/Denver", label: "Mountain (Denver)" },
  { value: "America/Chicago", label: "Central (Chicago)" },
  { value: "America/New_York", label: "Eastern (New York)" },
  { value: "America/Mexico_City", label: "Mexico City" },
  { value: "America/Sao_Paulo", label: "São Paulo" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Paris", label: "Paris" },
  { value: "Europe/Berlin", label: "Berlin" },
  { value: "Africa/Johannesburg", label: "Johannesburg" },
  { value: "Asia/Dubai", label: "Dubai" },
  { value: "Asia/Kolkata", label: "India (Kolkata)" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Asia/Tokyo", label: "Tokyo" },
  { value: "Australia/Perth", label: "Perth" },
  { value: "Australia/Sydney", label: "Sydney" },
  { value: "Pacific/Auckland", label: "Auckland" },
] as const;

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type ZonedWeekday = (typeof WEEKDAYS)[number];

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: ZonedWeekday;
};

export function isValidTimeZone(value: string | null | undefined): value is string {
  if (!value || value.length > 80) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

/** Fallback order: saved → cookie → APP_TIMEZONE → UTC. */
export function resolveTimeZone(
  ...candidates: Array<string | null | undefined>
): string {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (isValidTimeZone(trimmed)) return trimmed;
  }
  return "UTC";
}

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const zone = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  const weekday = (WEEKDAYS.includes(bag.weekday as ZonedWeekday)
    ? bag.weekday
    : "Monday") as ZonedWeekday;
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour,
    minute: Number(bag.minute),
    second: Number(bag.second),
    weekday,
  };
}

export function dayKey(date: Date, timeZone: string): string {
  const { year, month, day } = zonedParts(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getUserToday(now: Date, timeZone: string) {
  const parts = zonedParts(now, timeZone);
  return {
    ...parts,
    dayKey: dayKey(now, timeZone),
    timeZone: isValidTimeZone(timeZone) ? timeZone : "UTC",
  };
}

/** Offset of `timeZone` at `date`: wall-as-UTC minus the real instant. */
function zoneOffsetMs(date: Date, timeZone: string) {
  const parts = zonedParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - date.getTime();
}

/** UTC instant of a wall-clock date and time in `timeZone`. */
export function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  let instant = utcGuess - zoneOffsetMs(new Date(utcGuess), timeZone);
  instant = utcGuess - zoneOffsetMs(new Date(instant), timeZone);
  return new Date(instant);
}

/** UTC instant of y-m-d 00:00:00 in `timeZone`. */
export function zonedCivilToUtc(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): Date {
  return zonedDateTimeToUtc(year, month, day, 0, 0, timeZone);
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

/** Calendar date in the member's zone. Server UTC must not shift Wednesday night forward. */
export function formatMemberDate(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(date);
}

/**
 * Friendly date and time in the member's zone.
 * Daylight time and standard time both come from the zone, so October in
 * Denver stays on MDT instead of reading an hour early.
 */
export function formatMemberDateTime(date: Date, timeZone: string) {
  const zone = isValidTimeZone(timeZone) ? timeZone : "UTC";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: zone,
  }).format(date);
}

/** `datetime-local` value for an instant in the member's zone, not the server zone. */
export function formatDateTimeLocal(date: Date, timeZone: string) {
  const parts = zonedParts(date, timeZone);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

/** Parse a `datetime-local` value as wall time in `timeZone`. */
export function parseDateTimeLocal(value: string, timeZone: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }
  const parsed = zonedDateTimeToUtc(year, month, day, hour, minute, timeZone);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function startOfZonedDay(date: Date, timeZone: string): Date {
  const { year, month, day } = zonedParts(date, timeZone);
  return zonedCivilToUtc(year, month, day, timeZone);
}

export function endOfZonedDay(date: Date, timeZone: string): Date {
  const start = startOfZonedDay(date, timeZone);
  const { year, month, day } = zonedParts(start, timeZone);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return zonedCivilToUtc(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
    timeZone,
  );
}

export function addZonedDays(date: Date, days: number, timeZone: string): Date {
  const { year, month, day } = zonedParts(date, timeZone);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return zonedCivilToUtc(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
    timeZone,
  );
}

export function weekdayInZone(date: Date, timeZone: string): ZonedWeekday {
  return zonedParts(date, timeZone).weekday;
}

export function sameZonedDay(a: Date, b: Date, timeZone: string) {
  return dayKey(a, timeZone) === dayKey(b, timeZone);
}

export function mondayOfZoned(date: Date, timeZone: string): Date {
  const start = startOfZonedDay(date, timeZone);
  const weekday = weekdayInZone(start, timeZone);
  const index = WEEKDAYS.indexOf(weekday);
  const diff = index === 0 ? -6 : 1 - index;
  return addZonedDays(start, diff, timeZone);
}

export function sundayOfZoned(date: Date, timeZone: string): Date {
  const start = startOfZonedDay(date, timeZone);
  const weekday = weekdayInZone(start, timeZone);
  const index = WEEKDAYS.indexOf(weekday);
  return addZonedDays(start, -index, timeZone);
}

export async function readTimeZoneCookie(): Promise<string | null> {
  try {
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    const raw = jar.get(TIMEZONE_COOKIE)?.value;
    if (!raw) return null;
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

export async function resolveRequestTimeZone(saved?: string | null) {
  return resolveSavedOrCookieTimeZone(saved, await readTimeZoneCookie());
}

/** Calendar date in the member's zone. Server UTC must not move an evening session to the next day. */
export function formatZonedDate(
  date: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = {},
) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
    timeZone,
  }).format(date);
}

export function athleteLocalDayLine(now: Date, timeZone: string) {
  const today = getUserToday(now, timeZone);
  return `Athlete local day: ${today.weekday} ${today.dayKey} (${today.timeZone}).`;
}

export function resolveSavedOrCookieTimeZone(
  saved?: string | null,
  cookie?: string | null,
) {
  return memberDayTimeZone(saved, cookie);
}

/**
 * Civil day for member logs. A saved profile zone wins, including UTC.
 * A cookie of "UTC" is not a member zone — browsers and servers emit it when
 * detection fails — so the gym zone is used instead.
 */
export function memberDayTimeZone(saved?: string | null, cookie?: string | null) {
  const profile = saved?.trim();
  if (isValidTimeZone(profile)) return profile;
  const fromCookie = cookie?.trim();
  if (isValidTimeZone(fromCookie) && fromCookie.toUpperCase() !== "UTC") return fromCookie;
  return APP_TIMEZONE;
}

export function timezoneSelectOptions(current?: string | null) {
  const options: Array<{ value: string; label: string }> = [...TIMEZONE_OPTIONS];
  if (current && isValidTimeZone(current) && !options.some((row) => row.value === current)) {
    options.unshift({ value: current, label: current.replace(/_/g, " ") });
  }
  return options;
}
