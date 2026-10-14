import { WEEKDAYS } from "@/lib/constants";
import { dayKey, mondayOfZoned } from "@/lib/timezone";

export type PlanWeekday = (typeof WEEKDAYS)[number];

/** One week’s voluntary remap. Calendar weekday shows that skeleton day’s sessions. */
export type WeekPlanSwap = {
  /** Monday of the week, YYYY-MM-DD in the member’s zone. */
  weekStart: string;
  sourceByDay: Partial<Record<PlanWeekday, PlanWeekday>>;
};

const WEEK_START = /^\d{4}-\d{2}-\d{2}$/;

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
    if (typeof weekStart !== "string" || !WEEK_START.test(weekStart)) continue;
    if (!sourceByDay || typeof sourceByDay !== "object" || Array.isArray(sourceByDay)) continue;
    const clean: Partial<Record<PlanWeekday, PlanWeekday>> = {};
    for (const [key, value] of Object.entries(sourceByDay)) {
      if (typeof value !== "string") continue;
      if (!isPlanWeekday(key) || !isPlanWeekday(value) || key === value) continue;
      clean[key] = value;
    }
    if (Object.keys(clean).length === 0) continue;
    swaps.push({ weekStart, sourceByDay: clean });
  }
  return swaps;
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
  const current = {
    ...(swaps.find((row) => row.weekStart === weekStart)?.sourceByDay ?? {}),
  };
  const sourceA = current[a] ?? a;
  const sourceB = current[b] ?? b;
  const next: Partial<Record<PlanWeekday, PlanWeekday>> = { ...current };
  if (sourceB === a) delete next[a];
  else next[a] = sourceB;
  if (sourceA === b) delete next[b];
  else next[b] = sourceA;
  if (Object.keys(next).length === 0) return rest;
  return [...rest, { weekStart, sourceByDay: next }];
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
