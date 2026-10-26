import { prisma } from "@/lib/prisma";
import { evaluateBadges, featuredBadges, type EarnedBadge } from "@/lib/badges";
import {
  migrateSeenBadgeIds,
  newlyEarnedBadges,
  seedSeenExcludingNew,
  serializeUnlockQuery,
} from "@/lib/badge-unlocks";
import { readSeenBadgeUnlocksForUser, writeSeenBadgeUnlocksForUser } from "@/lib/profile";
import {
  bestsFromSets,
  detectNewPrs,
  newPrExerciseCount,
  recordListFromBests,
  type DatedSetLike,
  type DetectedPr,
  type PersonalBest,
} from "@/lib/personal-bests";
import { lifetimeTrainingFacts, allTimePeakSets } from "@/lib/lifetime-stats";
import { getProfileForUser, timeZoneForUser, type ProfileRecord } from "@/lib/profile";
import { buildTrainingStreak, plannerPrefsFromProfile, streakQuerySince } from "@/lib/streaks";
import { type LoadUnit } from "@/lib/units";
import { loggedSetSome, sessionHasLoggedWork } from "@/lib/logged-work";
import { civilDayInstant } from "@/lib/performed-at";
import { getLatestBodyMetricsForUser } from "@/lib/body-metrics";

const PROGRESS_SET_SELECT = {
  exerciseName: true,
  reps: true,
  loadValue: true,
  loadUnit: true,
  durationSeconds: true,
  logMode: true,
  completed: true,
} as const;

function listCompleteSessionsInWindow(input: {
  userId: string;
  now: Date;
  excludeSessionId?: string;
}) {
  return prisma.workoutSession.findMany({
    where: {
      userId: input.userId,
      status: "complete",
      sets: loggedSetSome,
      performedAt: { gte: streakQuerySince(input.now) },
      ...(input.excludeSessionId ? { id: { not: input.excludeSessionId } } : {}),
    },
    orderBy: { performedAt: "desc" },
    select: {
      id: true,
      status: true,
      performedAt: true,
      sets: { select: PROGRESS_SET_SELECT },
    },
  });
}

export async function datedSetsForUser(userId: string, excludeSessionId?: string, now = new Date()) {
  const sessions = await listCompleteSessionsInWindow({ userId, now, excludeSessionId });
  const dated: DatedSetLike[] = [];
  for (const session of sessions) {
    for (const set of session.sets) {
      dated.push({ ...set, performedAt: session.performedAt });
    }
  }
  return dated;
}

function mergeBests(rows: PersonalBest[]) {
  const merged = new Map<string, PersonalBest>();
  for (const row of rows) {
    const key = `${row.kind}\0${row.exerciseName}\0${row.kind === "reps_at_weight" ? (row.load ?? "") : ""}`;
    const current = merged.get(key);
    if (
      !current ||
      row.value > current.value ||
      (row.value === current.value && row.date.getTime() < current.date.getTime())
    ) {
      merged.set(key, row);
    }
  }
  return [...merged.values()];
}

export async function detectNewPrsForSession(
  userId: string,
  sessionId: string,
  displayUnit: LoadUnit,
) {
  const session = await prisma.workoutSession.findFirst({
    where: { id: sessionId, userId },
    include: { sets: true },
  });
  if (!session) return [] as DetectedPr[];
  const [priorWindow, peaks, timeZone] = await Promise.all([
    datedSetsForUser(userId, sessionId),
    allTimePeakSets(userId, sessionId),
    timeZoneForUser(userId),
  ]);
  const current: DatedSetLike[] = session.sets.map((set) => ({
    ...set,
    performedAt: session.performedAt,
  }));
  const prior = [...priorWindow, ...peaks];
  const found = detectNewPrs(prior, current, displayUnit, timeZone);
  // First time at a lighter load is not a new record when a heavier all-time
  // best already exists. More reps at a load already used still counts.
  const heaviest = new Map<string, number>();
  for (const row of bestsFromSets(prior, displayUnit)) {
    if (row.kind !== "heaviest") continue;
    const currentBest = heaviest.get(row.exerciseName) ?? 0;
    if (row.value > currentBest) heaviest.set(row.exerciseName, row.value);
  }
  return found.filter((row) => {
    if (row.kind !== "reps_at_weight" || row.previousValue != null || row.load == null) return true;
    const best = heaviest.get(row.exerciseName);
    return best == null || row.load >= best;
  });
}

export { newPrExerciseCount };

export async function getCompanionProgress(userId: string, displayUnit: LoadUnit, now = new Date()) {
  const [profile, sessions, tz, facts] = await Promise.all([
    getProfileForUser(userId),
    listCompleteSessionsInWindow({ userId, now }),
    timeZoneForUser(userId),
    lifetimeTrainingFacts(userId),
  ]);
  const complete = sessions.filter(
    (row) => row.status === "complete" && sessionHasLoggedWork(row.sets),
  );
  const completedDates = complete.map((row) => civilDayInstant(row.performedAt, tz));
  const prefs = plannerPrefsFromProfile(profile ?? {});
  const streak = buildTrainingStreak({
    completedDates,
    prefs,
    now,
    timeZone: tz,
  });
  const datedSets: DatedSetLike[] = [];
  for (const session of complete) {
    for (const set of session.sets) {
      datedSets.push({ ...set, performedAt: session.performedAt });
    }
  }
  const badges = evaluateBadges({
    workoutCount: facts.workoutCount,
    currentStreak: streak.current,
    longestStreak: streak.longest,
    sets: facts.badgeSets,
    firstWorkoutAt: facts.firstWorkoutAt,
    displayUnit,
  });
  const bests = mergeBests([
    ...bestsFromSets(facts.peakSets, displayUnit),
    ...bestsFromSets(datedSets, displayUnit),
  ]);
  const records = recordListFromBests(bests, displayUnit);
  const latestMetrics = await getLatestBodyMetricsForUser(userId);
  const weight = latestMetrics.get("weight") ?? null;

  return {
    profile,
    timeZone: tz,
    streak,
    badges,
    featured: featuredBadges(badges),
    bests,
    records,
    weight,
    workoutCount: facts.workoutCount,
    datedSets,
    completeSessions: complete,
  };
}

export async function evaluateBadgesForUser(
  userId: string,
  displayUnit: LoadUnit,
  now = new Date(),
  excludeSessionId?: string,
) {
  const [profile, sessions, tz, facts] = await Promise.all([
    getProfileForUser(userId),
    listCompleteSessionsInWindow({ userId, now, excludeSessionId }),
    timeZoneForUser(userId),
    lifetimeTrainingFacts(userId, excludeSessionId),
  ]);
  const complete = sessions.filter(
    (row) =>
      row.status === "complete" &&
      row.id !== excludeSessionId &&
      sessionHasLoggedWork(row.sets),
  );
  const prefs = plannerPrefsFromProfile(profile ?? {});
  const streak = buildTrainingStreak({
    completedDates: complete.map((row) => civilDayInstant(row.performedAt, tz)),
    prefs,
    now,
    timeZone: tz,
  });
  return evaluateBadges({
    workoutCount: facts.workoutCount,
    currentStreak: streak.current,
    longestStreak: streak.longest,
    sets: facts.badgeSets,
    firstWorkoutAt: facts.firstWorkoutAt,
    displayUnit,
  });
}

export async function detectUnseenBadgeUnlocksForSession(
  userId: string,
  sessionId: string,
  displayUnit: LoadUnit,
) {
  const [before, after, seenRaw] = await Promise.all([
    evaluateBadgesForUser(userId, displayUnit, new Date(), sessionId),
    evaluateBadgesForUser(userId, displayUnit),
    readSeenBadgeUnlocksForUser(userId),
  ]);
  const seen = migrateSeenBadgeIds(seenRaw);
  const fresh = newlyEarnedBadges(before, after);
  const silent = seedSeenExcludingNew(
    after.filter((row) => row.earned).map((row) => row.id),
    fresh.map((row) => row.id),
  );
  const toWrite = [...new Set([...seen, ...silent])];
  if (toWrite.length > 0) {
    await writeSeenBadgeUnlocksForUser(userId, toWrite);
  }
  const already = new Set(seen);
  return fresh.filter((row) => !already.has(row.id));
}

export function unlockQueryForBadges(badges: EarnedBadge[]) {
  return serializeUnlockQuery(badges.map((badge) => badge.id));
}

export function profilePlanner(profile: ProfileRecord | null) {
  return plannerPrefsFromProfile(profile ?? {});
}

export function summarizeBadges(badges: EarnedBadge[]) {
  const earned = badges.filter((row) => row.earned);
  return { earned: earned.length, total: badges.length };
}
