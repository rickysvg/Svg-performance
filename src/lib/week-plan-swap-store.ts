import { AppError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { timeZoneForUser } from "@/lib/profile";
import {
  clearWeekSwap,
  isPlanWeekday,
  parseWeekPlanSwaps,
  pruneWeekPlanSwaps,
  swapWeekdays,
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

export async function swapWeekPlanForUser(
  userId: string,
  weekStart: string,
  a: PlanWeekday,
  b: PlanWeekday,
) {
  if (!WEEK_START.test(weekStart)) {
    throw new AppError("PLAN", "That week is not valid.");
  }
  if (a === b) {
    throw new AppError("PLAN", "Pick two different days.");
  }
  const existing = await getWeekPlanSwapsForUser(userId);
  const next = pruneWeekPlanSwaps(swapWeekdays(existing, weekStart, a, b), weekStart);
  await writeWeekPlanSwaps(userId, next);
  return next;
}

export async function swapCurrentWeekForUser(
  userId: string,
  fromDay: string,
  toDay: string,
  now = new Date(),
) {
  if (!isPlanWeekday(fromDay) || !isPlanWeekday(toDay)) {
    throw new AppError("PLAN", "Pick two days in this week.");
  }
  const timeZone = await timeZoneForUser(userId);
  const weekStart = weekStartKey(now, timeZone);
  return swapWeekPlanForUser(userId, weekStart, fromDay, toDay);
}

export async function clearCurrentWeekPlanForUser(userId: string, now = new Date()) {
  const timeZone = await timeZoneForUser(userId);
  const weekStart = weekStartKey(now, timeZone);
  const existing = await getWeekPlanSwapsForUser(userId);
  const next = pruneWeekPlanSwaps(clearWeekSwap(existing, weekStart), weekStart);
  await writeWeekPlanSwaps(userId, next);
  return next;
}
