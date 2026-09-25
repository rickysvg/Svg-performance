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

/** UTC instant of y-m-d 00:00:00 in `timeZone`. */
export function zonedCivilToUtc(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0);
  let instant = utcGuess - zoneOffsetMs(new Date(utcGuess), timeZone);
  instant = utcGuess - zoneOffsetMs(new Date(instant), timeZone);
  return new Date(instant);
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

export function athleteLocalDayLine(now: Date, timeZone: string) {
  const today = getUserToday(now, timeZone);
  return `Athlete local day: ${today.weekday} ${today.dayKey} (${today.timeZone}).`;
}

export function resolveSavedOrCookieTimeZone(
  saved?: string | null,
  cookie?: string | null,
) {
  return resolveTimeZone(saved, cookie, APP_TIMEZONE, "UTC");
}

export function timezoneSelectOptions(current?: string | null) {
  const options: Array<{ value: string; label: string }> = [...TIMEZONE_OPTIONS];
  if (current && isValidTimeZone(current) && !options.some((row) => row.value === current)) {
    options.unshift({ value: current, label: current.replace(/_/g, " ") });
  }
  return options;
}
