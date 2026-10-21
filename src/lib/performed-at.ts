import {
  dayKey,
  formatDateTimeLocal,
  parseDateTimeLocal,
  zonedCivilToUtc,
} from "@/lib/timezone";

/** A session left open overnight still belongs to the day it started. */
const STARTED_DAY_GRACE_MS = 30 * 60 * 60 * 1000;

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

/** Old hidden field: UTC clock, which Vercel then parsed as UTC and shifted the member's day. */
export function formatUtcDateTimeLocal(date: Date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}T${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
}

/** Old hidden field rendered with the server's local clock. */
export function formatRuntimeDateTimeLocal(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/**
 * A date-only value used to be stored as UTC midnight, which is the previous evening
 * in America/Denver. Treat that instant as the civil day it names.
 */
export function civilDayInstant(date: Date, timeZone: string): Date {
  if (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  ) {
    return zonedCivilToUtc(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
      timeZone,
    );
  }
  return date;
}

/**
 * Civil day a logged session counts on.
 * A date-only UTC midnight stamp stays the day it names.
 * A session that was started one day and saved the next morning stays on the start day.
 */
export function sessionCivilDay(
  session: { performedAt: Date; createdAt?: Date | null },
  timeZone: string,
): string {
  const performed = dayKey(civilDayInstant(session.performedAt, timeZone), timeZone);
  const createdAt = session.createdAt;
  if (!createdAt || Number.isNaN(createdAt.getTime())) return performed;
  const gap = session.performedAt.getTime() - createdAt.getTime();
  if (gap < 60_000 || gap > STARTED_DAY_GRACE_MS) return performed;
  const started = dayKey(createdAt, timeZone);
  return started < performed ? started : performed;
}

/**
 * The date on a saved session is the member's local day when they log it.
 * An untouched draft from another day moves to now. A When field they edited is kept.
 */
export function resolveLoggedPerformedAt(input: {
  raw: string;
  existing: Date;
  now: Date;
  timeZone: string;
  completing: boolean;
  /** Sets were already logged. Keep the day they were written on. */
  hasPriorLogs?: boolean;
}): Date {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.raw.trim());
  const parsed = dateOnly
    ? zonedCivilToUtc(Number(dateOnly[1]), Number(dateOnly[2]), Number(dateOnly[3]), input.timeZone)
    : parseDateTimeLocal(input.raw, input.timeZone);
  const loose = new Date(input.raw);
  const fallback = parsed ?? (Number.isNaN(loose.getTime()) ? input.now : civilDayInstant(loose, input.timeZone));
  if (!input.completing) return fallback;
  const untouched =
    input.raw === formatDateTimeLocal(input.existing, input.timeZone) ||
    input.raw === formatUtcDateTimeLocal(input.existing) ||
    input.raw === formatRuntimeDateTimeLocal(input.existing);
  if (!untouched) return fallback;
  if (dayKey(input.existing, input.timeZone) === dayKey(input.now, input.timeZone)) {
    return input.existing;
  }
  if (input.hasPriorLogs) return input.existing;
  return input.now;
}
