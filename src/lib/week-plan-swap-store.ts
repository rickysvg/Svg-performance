import { AppError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { findDemoTrainingCatalog } from "@/lib/programs";
import { loggedSetSome } from "@/lib/logged-work";
import { planForDate, resolvePlanSessions, type PlannerPrefs } from "@/lib/week-plan";
import { scaleDemoCatalog } from "@/lib/training-scale";
import { civilDayInstant } from "@/lib/performed-at";
import { memberFacingTitle } from "@/lib/member-copy";
import { addZonedDays, dayKey, weekdayInZone, zonedCivilToUtc } from "@/lib/timezone";
import { WEEKDAYS } from "@/lib/constants";
import {
  clearWeekSwap,
  futureWorkoutPulledBack,
  isPlanWeekday,
  isSessionKey,
  moveSessionOnPlan,
  parseWeekPlanSwaps,
  placedWeekdayForSession,
  sessionHomeWeekday,
  pruneAutoRolledSwaps,
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

const weekPlanTail = new Map<string, Promise<void>>();
const weekPlanActive = new Set<string>();

/**
 * Swaps and week clears for one member run in request order.
 * Move and Undo do not use this queue. Each carries a sequence, so a
 * write that finishes late cannot replace the member's latest day.
 */
export function enqueueWeekPlan<T>(userId: string, task: () => Promise<T>): Promise<T> {
  if (weekPlanActive.has(userId)) return task();
  const previous = weekPlanTail.get(userId) ?? Promise.resolve();
  const run = previous.then(async () => {
    weekPlanActive.add(userId);
    try {
      return await task();
    } finally {
      weekPlanActive.delete(userId);
    }
  });
  const settled = run.then(
    () => undefined,
    () => undefined,
  );
  weekPlanTail.set(userId, settled);
  void settled.then(() => {
    if (weekPlanTail.get(userId) === settled) weekPlanTail.delete(userId);
  });
  return run;
}

function inWeekPlanTurn(userId: string) {
  return weekPlanActive.has(userId);
}

export async function getWeekPlanSwapsForUser(userId: string): Promise<WeekPlanSwap[]> {
  const row = await prisma.profile.findUnique({
    where: { userId },
    select: { weekPlanSwapsJson: true },
  });
  const parsed = parseWeekPlanSwaps(row?.weekPlanSwapsJson);
  const pruned = pruneAutoRolledSwaps(parsed);
  const prunedJson = JSON.stringify(pruned);
  if (row && prunedJson !== JSON.stringify(parsed)) {
    await writePrunedSwapsIfUnchanged(userId, row.weekPlanSwapsJson, prunedJson);
  }
  return pruned;
}

/**
 * Write a pruned plan only when the row is still the JSON this read saw.
 * A later Undo must not be overwritten by a refresh that started earlier.
 */
export async function writePrunedSwapsIfUnchanged(
  userId: string,
  readJson: string | null,
  prunedJson: string,
) {
  if (readJson === null) return { count: 0 };
  return prisma.profile.updateMany({
    where: { userId, weekPlanSwapsJson: readJson },
    data: { weekPlanSwapsJson: prunedJson },
  });
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

const INTENT_ATTEMPTS = 48;

function parseIntentSeq(raw: string | null | undefined): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!isSessionKey(key)) continue;
      if (typeof value !== "number" || !Number.isInteger(value) || value < 0) continue;
      out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

function stableIntentJson(map: Record<string, number>) {
  const sorted: Record<string, number> = {};
  for (const key of Object.keys(map).sort()) sorted[key] = map[key] ?? 0;
  return JSON.stringify(sorted);
}

async function readIntentRow(userId: string) {
  const row = await prisma.profile.findUnique({
    where: { userId },
    select: { weekPlanSwapsJson: true, weekPlanIntentSeqJson: true },
  });
  if (!row) throw new NotFoundError("Profile not found.");
  return row;
}

/** Highest accepted move/undo sequence for each session. The page starts the next click above this. */
export async function getSessionIntentSeqForUser(userId: string): Promise<Record<string, number>> {
  const row = await prisma.profile.findUnique({
    where: { userId },
    select: { weekPlanIntentSeqJson: true },
  });
  return parseIntentSeq(row?.weekPlanIntentSeqJson);
}

/** Next sequence for a caller that did not send one. A lost race retries instead of reusing a number. */
export async function claimNextSessionIntent(userId: string, sessionKey: string) {
  if (!isSessionKey(sessionKey)) {
    throw new AppError("PLAN", "That workout cannot be moved.");
  }
  for (let attempt = 0; attempt < INTENT_ATTEMPTS; attempt += 1) {
    const row = await readIntentRow(userId);
    const map = parseIntentSeq(row.weekPlanIntentSeqJson);
    const next = (map[sessionKey] ?? 0) + 1;
    map[sessionKey] = next;
    const updated = await prisma.profile.updateMany({
      where: { userId, weekPlanIntentSeqJson: row.weekPlanIntentSeqJson },
      data: { weekPlanIntentSeqJson: stableIntentJson(map) },
    });
    if (updated.count === 1) return next;
  }
  throw new AppError("PLAN", "That move did not save. Try again.");
}

export type SessionIntentKind = "move" | "restore";

/**
 * Put one session on an explicit weekday if this sequence is still the latest.
 * A lower sequence is ignored, even when its request finishes last.
 * Restore may land on a past home day. Move still stays on today or later.
 */
export async function placeSessionIntentForUser(input: {
  userId: string;
  sessionKey: string;
  weekStart: string;
  toDay: string;
  intentSeq: number;
  now?: Date;
  intent: SessionIntentKind;
}): Promise<{ applied: boolean; swaps: WeekPlanSwap[]; seq: number }> {
  const { userId, sessionKey, weekStart, toDay, intentSeq, intent } = input;
  const now = input.now ?? new Date();
  if (!Number.isInteger(intentSeq) || intentSeq < 1) {
    throw new AppError("PLAN", "That move did not save. Try again.");
  }
  if (!isSessionKey(sessionKey)) {
    throw new AppError("PLAN", "That workout cannot be moved.");
  }
  if (!isPlanWeekday(toDay)) {
    throw new AppError("PLAN", "Pick a day this week.");
  }
  const timeZone = await timeZoneForUser(userId);
  assertEditableWeek(weekStart, now, timeZone);
  if (intent === "move") {
    const destination = shiftDayKey(weekStart, WEEKDAYS.indexOf(toDay));
    if (destination < dayKey(now, timeZone)) {
      throw new AppError("PLAN", "Move it to today or a later day.");
    }
    if (futureWorkoutPulledBack(sessionKey, toDay, weekdayInZone(now, timeZone))) {
      throw new AppError("PLAN", "A future workout stays on its own day.");
    }
  }
  const anchor = weekStartKey(now, timeZone);
  const [year, month, day] = weekStart.split("-").map(Number);
  const monday = zonedCivilToUtc(year, month, day, timeZone);
  const completedThisWeek = await prisma.workoutSession.count({
    where: {
      userId,
      status: "complete",
      performedAt: { gte: monday, lt: addZonedDays(monday, 7, timeZone) },
      sets: loggedSetSome,
    },
  });
  for (let attempt = 0; attempt < INTENT_ATTEMPTS; attempt += 1) {
    const row = await readIntentRow(userId);
    const existing = pruneWeekPlanSwaps(
      pruneAutoRolledSwaps(parseWeekPlanSwaps(row.weekPlanSwapsJson)),
      anchor,
    );
    const seqMap = parseIntentSeq(row.weekPlanIntentSeqJson);
    const stored = seqMap[sessionKey] ?? 0;
    if (intentSeq < stored) {
      return { applied: false, swaps: existing, seq: stored };
    }
    const next = pruneWeekPlanSwaps(moveSessionOnPlan(existing, weekStart, sessionKey, toDay), anchor);
    if (completedThisWeek > 0 && JSON.stringify(next) !== JSON.stringify(existing)) {
      const done = await loggedSessionKeys(userId, weekStart, existing, timeZone);
      assertSessionsOpen(done, [sessionKey]);
    }
    seqMap[sessionKey] = intentSeq;
    const updated = await prisma.profile.updateMany({
      where: {
        userId,
        weekPlanSwapsJson: row.weekPlanSwapsJson,
        weekPlanIntentSeqJson: row.weekPlanIntentSeqJson,
      },
      data: {
        weekPlanSwapsJson: JSON.stringify(next),
        weekPlanIntentSeqJson: stableIntentJson(seqMap),
      },
    });
    if (updated.count === 1) return { applied: true, swaps: next, seq: intentSeq };
  }
  throw new AppError("PLAN", "That move did not save. Try again.");
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
    planAnchor: profile?.onboardingCompletedAt ?? null,
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
    select: {
      programDayId: true,
      title: true,
      performedAt: true,
      programDay: { select: { dayNumber: true, program: { select: { slug: true } } } },
    },
  });
  const done = new Set<string>();
  for (let index = 0; index < WEEKDAYS.length; index += 1) {
    const date = addZonedDays(monday, index, timeZone);
    const key = dayKey(date, timeZone);
    const resolved = resolvePlanSessions(planForDate(prefs, date, timeZone, swaps), scaled);
    for (const session of resolved) {
      if (!session.sessionKey || session.kind === "rest") continue;
      const hit = logs.some((log) => {
        if (dayKey(civilDayInstant(log.performedAt, timeZone), timeZone) !== key) return false;
        if (session.dayId && log.programDayId === session.dayId) return true;
        if (
          session.dayNumber != null &&
          session.programSlug &&
          log.programDay?.dayNumber === session.dayNumber &&
          log.programDay.program.slug === session.programSlug
        ) {
          return true;
        }
        const plannedTitle = memberFacingTitle(session.title);
        return plannedTitle.length > 0 && memberFacingTitle(log.title) === plannedTitle;
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
): Promise<WeekPlanSwap[]> {
  if (!inWeekPlanTurn(userId)) {
    return enqueueWeekPlan(userId, () => swapWeekPlanForUser(userId, weekStart, a, b, pruneAnchor));
  }
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
): Promise<WeekPlanSwap[]> {
  if (!inWeekPlanTurn(userId)) {
    return enqueueWeekPlan(userId, () => clearWeekPlanForUser(userId, weekStart, now));
  }
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
): Promise<WeekPlanSwap[]> {
  const intentSeq = await claimNextSessionIntent(userId, sessionKey);
  const placed = await placeSessionIntentForUser({
    userId,
    sessionKey,
    weekStart,
    toDay,
    intentSeq,
    now,
    intent: "move",
  });
  return placed.swaps;
}

/**
 * Put a moved workout back on its home weekday.
 * The Move sheet blocks past days, so this is the way back after Undo expires.
 */
export async function moveWorkoutHomeForUser(
  userId: string,
  sessionKey: string,
  weekStart: string,
  now = new Date(),
): Promise<WeekPlanSwap[]> {
  if (!isSessionKey(sessionKey)) {
    throw new AppError("PLAN", "That workout cannot be moved.");
  }
  const home = sessionHomeWeekday(sessionKey);
  if (!home) {
    throw new AppError("PLAN", "That workout cannot be moved back.");
  }
  const timeZone = await timeZoneForUser(userId);
  assertEditableWeek(weekStart, now, timeZone);
  const existing = await getWeekPlanSwapsForUser(userId);
  const row = existing.find((item) => item.weekStart === weekStart);
  const sitting = placedWeekdayForSession(row?.sourceByDay ?? {}, row?.sessionDays, sessionKey);
  if (sitting === home) {
    throw new AppError("PLAN", "That workout is already on its original day.");
  }
  const intentSeq = await claimNextSessionIntent(userId, sessionKey);
  const saved = await placeSessionIntentForUser({
    userId,
    sessionKey,
    weekStart,
    toDay: home,
    intentSeq,
    now,
    intent: "restore",
  });
  return saved.swaps;
}

/** Trade one session with a session that sits on another day this week. */
export async function swapWorkoutForUser(
  userId: string,
  sessionKey: string,
  otherKey: string,
  weekStart: string,
  now = new Date(),
): Promise<WeekPlanSwap[]> {
  if (!inWeekPlanTurn(userId)) {
    return enqueueWeekPlan(userId, () =>
      swapWorkoutForUser(userId, sessionKey, otherKey, weekStart, now),
    );
  }
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
  const todayName = weekdayInZone(now, timeZone);
  const landing = (day: PlanWeekday) => shiftDayKey(weekStart, WEEKDAYS.indexOf(day));
  if (landing(dayA) < today || landing(dayB) < today) {
    throw new AppError("PLAN", "Move it to today or a later day.");
  }
  if (
    futureWorkoutPulledBack(sessionKey, dayB, todayName) ||
    futureWorkoutPulledBack(otherKey, dayA, todayName)
  ) {
    throw new AppError("PLAN", "A future workout stays on its own day.");
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
export async function restoreWeekPlanForUser(
  userId: string,
  raw: string,
  now = new Date(),
): Promise<WeekPlanSwap[]> {
  if (!inWeekPlanTurn(userId)) {
    return enqueueWeekPlan(userId, () => restoreWeekPlanForUser(userId, raw, now));
  }
  const timeZone = await timeZoneForUser(userId);
  const next = pruneAutoRolledSwaps(
    pruneWeekPlanSwaps(parseWeekPlanSwaps(raw), weekStartKey(now, timeZone)),
  );
  await writeWeekPlanSwaps(userId, next);
  return next;
}
