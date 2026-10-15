import { AppError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { findDemoTrainingCatalog } from "@/lib/programs";
import { loggedSetSome } from "@/lib/logged-work";
import { planForDate, resolvePlanSessions, type PlannerPrefs } from "@/lib/week-plan";
import { scaleDemoCatalog } from "@/lib/training-scale";
import { addZonedDays, dayKey, zonedCivilToUtc } from "@/lib/timezone";
import { WEEKDAYS } from "@/lib/constants";
import {
  clearWeekSwap,
  isPlanWeekday,
  isSessionKey,
  moveSessionOnPlan,
  parseWeekPlanSwaps,
  placedWeekdayForSession,
  pruneWeekPlanSwaps,
  shiftDayKey,
  swapSessionsOnPlan,
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

function prefsFromProfile(
  profile: Awaited<ReturnType<typeof getProfileForUser>>,
  email: string | null | undefined,
): PlannerPrefs {
  return {
    primaryFocus: profile?.primaryFocus,
    weeklyAvailability: profile?.weeklyAvailability ?? [],
    sessionsPerWeek: profile?.sessionsPerWeek ?? null,
    trainingFocus: profile?.trainingFocus,
    liftDaysPerWeek: profile?.liftDaysPerWeek,
    experienceLevel: profile?.experienceLevel,
    email,
    outsideTraining: profile?.outsideTraining,
  };
}

/** Session keys already logged on the day they currently sit. Those stay put. */
async function loggedSessionKeys(
  userId: string,
  weekStart: string,
  swaps: WeekPlanSwap[],
  timeZone: string,
) {
  const [profile, account, catalog] = await Promise.all([
    getProfileForUser(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
    findDemoTrainingCatalog(),
  ]);
  const prefs = prefsFromProfile(profile, account?.email);
  const scaled = scaleDemoCatalog(catalog, {
    experienceLevel: profile?.experienceLevel,
    competitionStatus: profile?.competitionStatus,
    weightAccess: profile?.weightAccess,
  });
  const [year, month, day] = weekStart.split("-").map(Number);
  const monday = zonedCivilToUtc(year, month, day, timeZone);
  const logs = await prisma.workoutSession.findMany({
    where: {
      userId,
      status: "complete",
      performedAt: { gte: monday, lt: addZonedDays(monday, 7, timeZone) },
      sets: loggedSetSome,
    },
    select: { programDayId: true, title: true, performedAt: true },
  });
  const done = new Set<string>();
  for (let index = 0; index < WEEKDAYS.length; index += 1) {
    const date = addZonedDays(monday, index, timeZone);
    const key = dayKey(date, timeZone);
    const resolved = resolvePlanSessions(planForDate(prefs, date, timeZone, swaps), scaled);
    for (const session of resolved) {
      if (!session.sessionKey || session.kind === "rest") continue;
      const hit = logs.some((log) => {
        if (dayKey(log.performedAt, timeZone) !== key) return false;
        if (session.dayId && log.programDayId === session.dayId) return true;
        return !session.dayId && log.title.trim() === session.title.trim();
      });
      if (hit) done.add(session.sessionKey);
    }
  }
  return done;
}

function assertSessionsOpen(done: Set<string>, keys: string[]) {
  if (keys.some((key) => done.has(key))) {
    throw new AppError("PLAN", "That session is already done.");
  }
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
  const done = await loggedSessionKeys(userId, weekStart, existing, timeZone);
  assertSessionsOpen(done, [sessionKey]);
  const next = pruneWeekPlanSwaps(
    moveSessionOnPlan(existing, weekStart, sessionKey, toDay),
    weekStartKey(now, timeZone),
  );
  await writeWeekPlanSwaps(userId, next);
  return next;
}

/** Trade one session with a session that sits on another day this week. */
export async function swapWorkoutForUser(
  userId: string,
  sessionKey: string,
  otherKey: string,
  weekStart: string,
  now = new Date(),
) {
  if (!isSessionKey(sessionKey) || !isSessionKey(otherKey) || sessionKey === otherKey) {
    throw new AppError("PLAN", "Pick two different sessions.");
  }
  const timeZone = await timeZoneForUser(userId);
  assertEditableWeek(weekStart, now, timeZone);
  const existing = await getWeekPlanSwapsForUser(userId);
  const row = existing.find((item) => item.weekStart === weekStart);
  const sourceByDay = row?.sourceByDay ?? {};
  const dayA = placedWeekdayForSession(sourceByDay, row?.sessionDays, sessionKey);
  const dayB = placedWeekdayForSession(sourceByDay, row?.sessionDays, otherKey);
  if (!dayA || !dayB || dayA === dayB) {
    throw new AppError("PLAN", "Pick a session on another day.");
  }
  const today = dayKey(now, timeZone);
  const landing = (day: PlanWeekday) => shiftDayKey(weekStart, WEEKDAYS.indexOf(day));
  if (landing(dayA) < today || landing(dayB) < today) {
    throw new AppError("PLAN", "Move it to today or a later day.");
  }
  const done = await loggedSessionKeys(userId, weekStart, existing, timeZone);
  assertSessionsOpen(done, [sessionKey, otherKey]);
  const next = pruneWeekPlanSwaps(
    swapSessionsOnPlan(existing, weekStart, sessionKey, otherKey),
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
