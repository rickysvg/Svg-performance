import {
  dayKey,
  formatDateTimeLocal,
  parseDateTimeLocal,
} from "@/lib/timezone";

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
 * The date on a saved session is the member's local day when they log it.
 * An untouched draft from another day moves to now. A When field they edited is kept.
 */
export function resolveLoggedPerformedAt(input: {
  raw: string;
  existing: Date;
  now: Date;
  timeZone: string;
  completing: boolean;
}): Date {
  const parsed = parseDateTimeLocal(input.raw, input.timeZone);
  const loose = new Date(input.raw);
  const fallback = parsed ?? (Number.isNaN(loose.getTime()) ? input.now : loose);
  if (!input.completing) return fallback;
  const untouched =
    input.raw === formatDateTimeLocal(input.existing, input.timeZone) ||
    input.raw === formatUtcDateTimeLocal(input.existing) ||
    input.raw === formatRuntimeDateTimeLocal(input.existing);
  if (!untouched) return fallback;
  if (dayKey(input.existing, input.timeZone) === dayKey(input.now, input.timeZone)) {
    return input.existing;
  }
  return input.now;
}
