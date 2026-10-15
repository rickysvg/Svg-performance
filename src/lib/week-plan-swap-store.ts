import { AppError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { timeZoneForUser } from "@/lib/profile";
import { zonedCivilToUtc } from "@/lib/timezone";
import { WEEKDAYS } from "@/lib/constants";
import { dayKey } from "@/lib/timezone";
import {
  clearWeekSwap,
  isPlanWeekday,
  isSessionKey,
  moveSessionOnPlan,
  parseWeekPlanSwaps,
  pruneWeekPlanSwaps,
  shiftDayKey,
  swapWeekdays,
  weekStartInRange,
  weekStartKey,
  type PlanWeekday,
  type WeekPlanSwap,
} from "@/lib/week-plan-swaps";

const WEEK_START = /^\d{4}-\d{2}-\d{2}$/;

export async function getWeekPlanSwapsForUser(userId: string): Promise<WeekPlanSwap[]> {
  const row = await prisma.profile.findUnique({
    where: { userId },
    select: { weekPlanSwapsJson: true },
  });
  return parseWeekPlanSwaps(row?.weekPlanSwapsJson);
}

async function writeWeekPlanSwaps(userId: string, swaps: WeekPlanSwap[]) {
  const existing = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError("Profile not found.");
  await prisma.profile.update({
    where: { userId },
    data: { weekPlanSwapsJson: JSON.stringify(swaps) },
  });
}

function assertEditableWeek(weekStart: string, now: Date, timeZone: string) {
  if (!WEEK_START.test(weekStart)) {
    throw new AppError("PLAN", "That week is not valid.");
  }
  const [year, month, day] = weekStart.split("-").map(Number);
  const date = zonedCivilToUtc(year, month, day, timeZone);
  if (weekStartKey(date, timeZone) !== weekStart) {
    throw new AppError("PLAN", "That week is not valid.");
  }
  if (!weekStartInRange(weekStart, weekStartKey(now, timeZone))) {
    throw new AppError("PLAN", "That week is outside the calendar you can edit.");
  }
}

export async function swapWeekPlanForUser(
  userId: string,
  weekStart: string,
  a: PlanWeekday,
  b: PlanWeekday,
  pruneAnchor = weekStart,
) {
  if (!WEEK_START.test(weekStart)) {
    throw new AppError("PLAN", "That week is not valid.");
  }
  if (a === b) {
    throw new AppError("PLAN", "Pick two different days.");
  }
  const existing = await getWeekPlanSwapsForUser(userId);
  const next = pruneWeekPlanSwaps(swapWeekdays(existing, weekStart, a, b), pruneAnchor);
  await writeWeekPlanSwaps(userId, next);
  return next;
}

export async function swapWeekOnDateForUser(
  userId: string,
  fromDay: string,
  toDay: string,
  weekStart: string,
  now = new Date(),
) {
  if (!isPlanWeekday(fromDay) || !isPlanWeekday(toDay)) {
    throw new AppError("PLAN", "Pick two days in this week.");
  }
  const timeZone = await timeZoneForUser(userId);
  assertEditableWeek(weekStart, now, timeZone);
  return swapWeekPlanForUser(userId, weekStart, fromDay, toDay, weekStartKey(now, timeZone));
}

export async function swapCurrentWeekForUser(
  userId: string,
  fromDay: string,
  toDay: string,
  now = new Date(),
) {
  const timeZone = await timeZoneForUser(userId);
  return swapWeekOnDateForUser(userId, fromDay, toDay, weekStartKey(now, timeZone), now);
}

export async function clearWeekPlanForUser(
  userId: string,
  weekStart: string,
  now = new Date(),
) {
  const timeZone = await timeZoneForUser(userId);
  assertEditableWeek(weekStart, now, timeZone);
  const existing = await getWeekPlanSwapsForUser(userId);
  const next = pruneWeekPlanSwaps(
    clearWeekSwap(existing, weekStart),
    weekStartKey(now, timeZone),
  );
  await writeWeekPlanSwaps(userId, next);
  return next;
}

export async function clearCurrentWeekPlanForUser(userId: string, now = new Date()) {
  const timeZone = await timeZoneForUser(userId);
  return clearWeekPlanForUser(userId, weekStartKey(now, timeZone), now);
}

/** Move one workout onto today or a later day in the same week. */
export async function moveWorkoutForUser(
  userId: string,
  sessionKey: string,
  toDay: string,
  weekStart: string,
  now = new Date(),
) {
  if (!isSessionKey(sessionKey)) {
    throw new AppError("PLAN", "That workout cannot be moved.");
  }
  if (!isPlanWeekday(toDay)) {
    throw new AppError("PLAN", "Pick a day this week.");
  }
  const timeZone = await timeZoneForUser(userId);
  assertEditableWeek(weekStart, now, timeZone);
  const index = WEEKDAYS.indexOf(toDay);
  const destination = shiftDayKey(weekStart, index);
  if (destination < dayKey(now, timeZone)) {
    throw new AppError("PLAN", "Move it to today or a later day.");
  }
  const existing = await getWeekPlanSwapsForUser(userId);
  const next = pruneWeekPlanSwaps(
    moveSessionOnPlan(existing, weekStart, sessionKey, toDay),
    weekStartKey(now, timeZone),
  );
  await writeWeekPlanSwaps(userId, next);
  return next;
}

/** Replace the saved week with a previously stored snapshot. Used by Undo. */
export async function restoreWeekPlanForUser(userId: string, raw: string, now = new Date()) {
  const timeZone = await timeZoneForUser(userId);
  const next = pruneWeekPlanSwaps(parseWeekPlanSwaps(raw), weekStartKey(now, timeZone));
  await writeWeekPlanSwaps(userId, next);
  return next;
}
