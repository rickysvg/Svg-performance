import { AppError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { timeZoneForUser } from "@/lib/profile";
import { zonedCivilToUtc } from "@/lib/timezone";
import {
  clearWeekSwap,
  isPlanWeekday,
  parseWeekPlanSwaps,
  pruneWeekPlanSwaps,
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
