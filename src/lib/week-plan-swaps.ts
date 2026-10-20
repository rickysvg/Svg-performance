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
  /**
   * Session keys the member placed with Move.
   * Pins without this flag are removed on read. They were not a choice.
   */
  manualSessions?: string[];
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
    const manualRaw = (row as { manualSessions?: unknown }).manualSessions;
    const manualSessions = Array.isArray(manualRaw)
      ? [...new Set(manualRaw.filter((key): key is string => typeof key === "string" && isSessionKey(key)))]
          .filter((key) => Boolean(cleanSessions[key]))
          .sort()
      : [];
    if (Object.keys(clean).length === 0 && Object.keys(cleanSessions).length === 0) continue;
    swaps.push({
      weekStart,
      sourceByDay: clean,
      ...(Object.keys(cleanSessions).length > 0 ? { sessionDays: cleanSessions } : {}),
      ...(manualSessions.length > 0 ? { manualSessions } : {}),
    });
  }
  return swaps;
}

function manualForSessions(
  manual: Iterable<string> | undefined,
  sessionDays: Partial<Record<string, PlanWeekday>>,
) {
  return [...new Set(manual ?? [])].filter((key) => Boolean(sessionDays[key])).sort();
}

function planRow(
  weekStart: string,
  sourceByDay: Partial<Record<PlanWeekday, PlanWeekday>>,
  sessionDays: Partial<Record<string, PlanWeekday>>,
  manual: Iterable<string> | undefined,
): WeekPlanSwap | null {
  const hasSessions = Object.keys(sessionDays).length > 0;
  if (Object.keys(sourceByDay).length === 0 && !hasSessions) return null;
  const manualSessions = manualForSessions(manual, sessionDays);
  return {
    weekStart,
    sourceByDay,
    ...(hasSessions ? { sessionDays } : {}),
    ...(manualSessions.length > 0 ? { manualSessions } : {}),
  };
}

/**
 * A later workout pulled onto today, or onto a day already past.
 * Monday’s missed session can still move forward onto Tuesday.
 */
export function futureWorkoutPulledBack(
  sessionKey: string,
  toDay: string,
  today: string | null | undefined,
) {
  if (!today || !isPlanWeekday(toDay) || !isPlanWeekday(today)) return false;
  const home = sessionHomeWeekday(sessionKey);
  if (!home) return false;
  const toIndex = WEEKDAYS.indexOf(toDay);
  const homeIndex = WEEKDAYS.indexOf(home);
  const todayIndex = WEEKDAYS.indexOf(today);
  return toIndex < homeIndex && toIndex <= todayIndex;
}

/**
 * Drop session pins the member did not make with Move.
 * Whole-day swaps in `sourceByDay` stay.
 * Idempotent: a second pass returns the same list.
 */
export function pruneAutoRolledSwaps(swaps: WeekPlanSwap[]) {
  const next: WeekPlanSwap[] = [];
  for (const row of swaps) {
    const manual = new Set(row.manualSessions ?? []);
    const sessionDays: Partial<Record<string, PlanWeekday>> = {};
    for (const [key, day] of Object.entries(row.sessionDays ?? {})) {
      if (!day || !manual.has(key)) continue;
      sessionDays[key] = day;
    }
    const built = planRow(row.weekStart, row.sourceByDay, sessionDays, manual);
    if (built) next.push(built);
  }
  return next;
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
  const sessionDays = flipSessionDays(row?.sessionDays, a, b) ?? {};
  const built = planRow(weekStart, next, sessionDays, row?.manualSessions);
  if (!built) return rest;
  return [...rest, built];
}

/** Calendar weekday a session is on, after whole-day swaps and per-session pins. */
export function placedWeekdayForSession(
  sourceByDay: Partial<Record<PlanWeekday, PlanWeekday>>,
  sessionDays: Partial<Record<string, PlanWeekday>> | undefined,
  sessionKey: string,
): PlanWeekday | null {
  const home = sessionHomeWeekday(sessionKey);
  if (!home) return null;
  const pinned = sessionDays?.[sessionKey];
  if (pinned && isPlanWeekday(pinned)) return pinned;
  return calendarDayForSource(sourceByDay, home);
}

/**
 * Trade two sessions that currently sit on different days.
 * The rest of each day stays put. Swapping the same pair again undoes it.
 */
export function swapSessionsOnPlan(
  swaps: WeekPlanSwap[],
  weekStart: string,
  sessionKey: string,
  otherKey: string,
): WeekPlanSwap[] {
  if (!WEEK_START.test(weekStart) || !isSessionKey(sessionKey) || !isSessionKey(otherKey)) {
    return swaps;
  }
  if (sessionKey === otherKey) return swaps;
  const row = swaps.find((item) => item.weekStart === weekStart);
  const sourceByDay = row?.sourceByDay ?? {};
  const dayA = placedWeekdayForSession(sourceByDay, row?.sessionDays, sessionKey);
  const dayB = placedWeekdayForSession(sourceByDay, row?.sessionDays, otherKey);
  if (!dayA || !dayB || dayA === dayB) return swaps;
  const moved = moveSessionOnPlan(swaps, weekStart, sessionKey, dayB);
  return moveSessionOnPlan(moved, weekStart, otherKey, dayA);
}

/**
 * Gentle note when a lift or hard session lands on class, sparring, or the day
 * before sparring. Sparring can take any session. Never a reason to refuse.
 */
export function sessionMoveCaution(input: {
  heavy: boolean;
  outside?: "class" | "sparring" | null;
  beforeSparring?: boolean;
  dayName: string;
}): string | null {
  const day = input.dayName;
  if (input.outside === "sparring") {
    return `${day} is usually sparring, with no app workout. You can still put this session there.`;
  }
  if (!input.heavy) return null;
  const heavyNote = "A lift or hard session is heavier than the usual plan. You can still move it.";
  if (input.beforeSparring && input.outside === "class") {
    return `${day} is class, and the day before sparring. ${heavyNote}`;
  }
  if (input.beforeSparring) {
    return `${day} is the day before sparring. ${heavyNote}`;
  }
  if (input.outside === "class") {
    return `${day} is a class day. ${heavyNote}`;
  }
  return null;
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
  const manual = new Set(current?.manualSessions ?? []);
  const base = calendarDayForSource(sourceByDay, home);
  if ((sessionDays[sessionKey] ?? base) === toDay && toDay === base) return swaps;
  if (toDay === base) {
    delete sessionDays[sessionKey];
    manual.delete(sessionKey);
  } else {
    sessionDays[sessionKey] = toDay;
    manual.add(sessionKey);
  }
  const built = planRow(weekStart, sourceByDay, sessionDays, manual);
  if (!built) return rest;
  return [...rest, built];
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
