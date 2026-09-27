/**
 * Deload and testing-week math for the Core week.
 * Fight-camp phases are owned by another branch. That work can call
 * isDeloadWeek / isTestingWeek. Do not schedule camp phases here.
 */
import { bikeWeekIndex } from "@/lib/bike-sessions";
import { APP_TIMEZONE } from "@/lib/timezone";

/** Every 4th week (index % 4 === 3) is a deload. */
export const DELOAD_EVERY_WEEKS = 4;

/**
 * Testing Week cadence. 8 weeks sits inside the approved 8–12 week window.
 * Fight camp may add a test at camp start later; this function stays date-based.
 */
export const TESTING_EVERY_WEEKS = 8;

function mod(value: number, base: number) {
  return ((value % base) + base) % base;
}

export function isDeloadWeekIndex(weekIndex: number) {
  return mod(weekIndex, DELOAD_EVERY_WEEKS) === DELOAD_EVERY_WEEKS - 1;
}

export function isTestingWeekIndex(weekIndex: number) {
  return mod(weekIndex, TESTING_EVERY_WEEKS) === 0;
}

export function isDeloadWeek(date: Date, timeZone = APP_TIMEZONE) {
  return isDeloadWeekIndex(bikeWeekIndex(date, timeZone));
}

export function isTestingWeek(date: Date, timeZone = APP_TIMEZONE) {
  return isTestingWeekIndex(bikeWeekIndex(date, timeZone));
}

/** About 40% less volume. Same exercises. Minimum one set. */
export function deloadSetCount(sets: number) {
  const safe = Number.isFinite(sets) ? Math.max(0, Math.round(sets)) : 0;
  if (safe <= 1) return Math.max(1, safe);
  return Math.max(1, Math.round(safe * 0.6));
}

export const DELOAD_LABEL = "Deload week — fewer sets, same exercises.";
export const TESTING_LABEL =
  "Testing Week — broad jump, a strength estimate, bike sprint, 5-minute bike, and the mobility check-in. Results are saved and compared.";
