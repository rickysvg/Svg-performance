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
} from "@/lib/personal-bests";
import { getProfileForUser, timeZoneForUser, type ProfileRecord } from "@/lib/profile";
import { buildTrainingStreak, plannerPrefsFromProfile } from "@/lib/streaks";
import { type LoadUnit } from "@/lib/units";
import { loggedSetSome, sessionHasLoggedWork } from "@/lib/logged-work";
import { civilDayInstant } from "@/lib/performed-at";
import { listWorkoutSessionsForUser } from "@/lib/workouts";
import { getLatestBodyMetricsForUser } from "@/lib/body-metrics";

export async function datedSetsForUser(userId: string, excludeSessionId?: string) {
  const sessions = await prisma.workoutSession.findMany({
    where: {
      userId,
      status: "complete",
      sets: loggedSetSome,
      ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
    },
    select: {
      performedAt: true,
      sets: {
        select: {
          exerciseName: true,
          reps: true,
          loadValue: true,
          loadUnit: true,
          durationSeconds: true,
          logMode: true,
          completed: true,
        },
      },
    },
  });
  const dated: DatedSetLike[] = [];
  for (const session of sessions) {
    for (const set of session.sets) {
      dated.push({ ...set, performedAt: session.performedAt });
    }
  }
  return dated;
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
  const [prior, timeZone] = await Promise.all([
    datedSetsForUser(userId, sessionId),
    timeZoneForUser(userId),
  ]);
  const current: DatedSetLike[] = session.sets.map((set) => ({
    ...set,
    performedAt: session.performedAt,
  }));
  return detectNewPrs(prior, current, displayUnit, timeZone);
}

export { newPrExerciseCount };

export async function getCompanionProgress(userId: string, displayUnit: LoadUnit, now = new Date()) {
  const [profile, sessions, tz] = await Promise.all([
    getProfileForUser(userId),
    listWorkoutSessionsForUser(userId),
    timeZoneForUser(userId),
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
    workoutCount: complete.length,
    currentStreak: streak.current,
    longestStreak: streak.longest,
    sets: datedSets,
    firstWorkoutAt: complete.at(-1)?.performedAt ?? complete[0]?.performedAt ?? null,
    displayUnit,
  });
  const bests = bestsFromSets(datedSets, displayUnit);
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
    workoutCount: complete.length,
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
  const [profile, sessions, tz] = await Promise.all([
    getProfileForUser(userId),
    listWorkoutSessionsForUser(userId),
    timeZoneForUser(userId),
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
  const datedSets: DatedSetLike[] = [];
  for (const session of complete) {
    for (const set of session.sets) {
      datedSets.push({ ...set, performedAt: session.performedAt });
    }
  }
  return evaluateBadges({
    workoutCount: complete.length,
    currentStreak: streak.current,
    longestStreak: streak.longest,
    sets: datedSets,
    firstWorkoutAt: complete.at(-1)?.performedAt ?? complete[0]?.performedAt ?? null,
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
