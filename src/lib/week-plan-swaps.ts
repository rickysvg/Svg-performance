import { WEEKDAYS } from "@/lib/constants";
import { dayKey, mondayOfZoned } from "@/lib/timezone";

export type PlanWeekday = (typeof WEEKDAYS)[number];

/**
 * One week’s voluntary remap.
 * `sourceByDay` swaps whole calendar days.
 * `sessionDays` places one skeleton workout on a calendar weekday.
 * A session key is `Weekday:program-slug:dayNumber` (or `Weekday:kind:index`).
 */
export type WeekPlanSwap = {
  /** Monday of the week, YYYY-MM-DD in the member’s zone. */
  weekStart: string;
  sourceByDay: Partial<Record<PlanWeekday, PlanWeekday>>;
  sessionDays?: Partial<Record<string, PlanWeekday>>;
};

const WEEK_START = /^\d{4}-\d{2}-\d{2}$/;
const SESSION_KEY =
  /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday):[a-z0-9-]+:[a-z0-9-]+$/i;

export function isSessionKey(value: string) {
  return SESSION_KEY.test(value);
}

export function sessionHomeWeekday(sessionKey: string): PlanWeekday | null {
  const home = sessionKey.split(":")[0] ?? "";
  return isPlanWeekday(home) ? home : null;
}

export function isPlanWeekday(value: string): value is PlanWeekday {
  return (WEEKDAYS as readonly string[]).includes(value);
}

export function parseWeekPlanSwaps(raw: string | null | undefined): WeekPlanSwap[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const swaps: WeekPlanSwap[] = [];
  for (const row of parsed) {
    if (!row || typeof row !== "object") continue;
    const weekStart = (row as { weekStart?: unknown }).weekStart;
    const sourceByDay = (row as { sourceByDay?: unknown }).sourceByDay;
    const sessionDays = (row as { sessionDays?: unknown }).sessionDays;
    if (typeof weekStart !== "string" || !WEEK_START.test(weekStart)) continue;
    const clean: Partial<Record<PlanWeekday, PlanWeekday>> = {};
    if (sourceByDay && typeof sourceByDay === "object" && !Array.isArray(sourceByDay)) {
      for (const [key, value] of Object.entries(sourceByDay)) {
        if (typeof value !== "string") continue;
        if (!isPlanWeekday(key) || !isPlanWeekday(value) || key === value) continue;
        clean[key] = value;
      }
    }
    const cleanSessions: Partial<Record<string, PlanWeekday>> = {};
    if (sessionDays && typeof sessionDays === "object" && !Array.isArray(sessionDays)) {
      for (const [key, value] of Object.entries(sessionDays)) {
        if (typeof value !== "string" || !isSessionKey(key) || !isPlanWeekday(value)) continue;
        cleanSessions[key] = value;
      }
    }
    if (Object.keys(clean).length === 0 && Object.keys(cleanSessions).length === 0) continue;
    swaps.push({
      weekStart,
      sourceByDay: clean,
      ...(Object.keys(cleanSessions).length > 0 ? { sessionDays: cleanSessions } : {}),
    });
  }
  return swaps;
}

/** Calendar weekday that currently shows a skeleton weekday, before per-workout pins. */
export function calendarDayForSource(
  sourceByDay: Partial<Record<PlanWeekday, PlanWeekday>>,
  source: PlanWeekday,
): PlanWeekday {
  for (const day of WEEKDAYS) {
    if (sourceByDay[day] === source) return day;
  }
  return source;
}

function flipSessionDays(
  sessionDays: Partial<Record<string, PlanWeekday>> | undefined,
  a: PlanWeekday,
  b: PlanWeekday,
) {
  if (!sessionDays) return undefined;
  const next: Partial<Record<string, PlanWeekday>> = {};
  for (const [key, day] of Object.entries(sessionDays)) {
    if (!day || !isPlanWeekday(day)) continue;
    next[key] = day === a ? b : day === b ? a : day;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

export function sourceWeekday(
  swaps: WeekPlanSwap[],
  weekStart: string,
  day: PlanWeekday,
): PlanWeekday {
  const row = swaps.find((item) => item.weekStart === weekStart);
  return row?.sourceByDay[day] ?? day;
}

/** Trade the workouts currently sitting on two calendar days. Swap again to undo. */
export function swapWeekdays(
  swaps: WeekPlanSwap[],
  weekStart: string,
  a: PlanWeekday,
  b: PlanWeekday,
): WeekPlanSwap[] {
  if (a === b) return swaps;
  const rest = swaps.filter((row) => row.weekStart !== weekStart);
  const row = swaps.find((item) => item.weekStart === weekStart);
  const current = { ...(row?.sourceByDay ?? {}) };
  const sourceA = current[a] ?? a;
  const sourceB = current[b] ?? b;
  const next: Partial<Record<PlanWeekday, PlanWeekday>> = { ...current };
  if (sourceB === a) delete next[a];
  else next[a] = sourceB;
  if (sourceA === b) delete next[b];
  else next[b] = sourceA;
  const sessionDays = flipSessionDays(row?.sessionDays, a, b);
  if (Object.keys(next).length === 0 && !sessionDays) return rest;
  return [
    ...rest,
    {
      weekStart,
      sourceByDay: next,
      ...(sessionDays ? { sessionDays } : {}),
    },
  ];
}

/** Put one skeleton workout on a calendar weekday. Sending it home clears the pin. */
export function moveSessionOnPlan(
  swaps: WeekPlanSwap[],
  weekStart: string,
  sessionKey: string,
  toDay: PlanWeekday,
): WeekPlanSwap[] {
  if (!WEEK_START.test(weekStart) || !isSessionKey(sessionKey) || !isPlanWeekday(toDay)) {
    return swaps;
  }
  const home = sessionHomeWeekday(sessionKey);
  if (!home) return swaps;
  const rest = swaps.filter((row) => row.weekStart !== weekStart);
  const current = swaps.find((row) => row.weekStart === weekStart);
  const sourceByDay = { ...(current?.sourceByDay ?? {}) };
  const sessionDays = { ...(current?.sessionDays ?? {}) };
  const base = calendarDayForSource(sourceByDay, home);
  if ((sessionDays[sessionKey] ?? base) === toDay && toDay === base) return swaps;
  if (toDay === base) delete sessionDays[sessionKey];
  else sessionDays[sessionKey] = toDay;
  const hasSessions = Object.keys(sessionDays).length > 0;
  if (Object.keys(sourceByDay).length === 0 && !hasSessions) return rest;
  return [
    ...rest,
    {
      weekStart,
      sourceByDay,
      ...(hasSessions ? { sessionDays } : {}),
    },
  ];
}

export function clearWeekSwap(swaps: WeekPlanSwap[], weekStart: string) {
  return swaps.filter((row) => row.weekStart !== weekStart);
}

/** How far back Calendar can show and edit a moved week. */
export const WEEK_PLAN_HISTORY_WEEKS = 16;
/** One week ahead of the current Monday. */
export const WEEK_PLAN_FUTURE_WEEKS = 1;

/** Shift a YYYY-MM-DD civil date by whole days. */
export function shiftDayKey(key: string, days: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return key;
  const shifted = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days),
  );
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Drop weeks older than the history window. Newer weeks stay so editing the past does not erase today. */
export function pruneWeekPlanSwaps(swaps: WeekPlanSwap[], anchorWeekStart: string) {
  const cutoff = shiftDayKey(anchorWeekStart, -7 * WEEK_PLAN_HISTORY_WEEKS);
  return swaps.filter((row) => row.weekStart >= cutoff);
}

export function weekStartInRange(weekStart: string, currentWeekStart: string) {
  const oldest = shiftDayKey(currentWeekStart, -7 * WEEK_PLAN_HISTORY_WEEKS);
  const newest = shiftDayKey(currentWeekStart, 7 * WEEK_PLAN_FUTURE_WEEKS);
  return weekStart >= oldest && weekStart <= newest;
}

export function weekStartKey(date: Date, timeZone: string) {
  return dayKey(mondayOfZoned(date, timeZone), timeZone);
}
