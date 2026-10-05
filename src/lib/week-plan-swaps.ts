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

/** Drop weeks that have already ended. The default plan returns on its own. */
export function pruneWeekPlanSwaps(swaps: WeekPlanSwap[], currentWeekStart: string) {
  return swaps.filter((row) => row.weekStart >= currentWeekStart);
}

export function weekStartKey(date: Date, timeZone: string) {
  return dayKey(mondayOfZoned(date, timeZone), timeZone);
}
