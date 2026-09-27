import { prisma } from "@/lib/prisma";
import { evaluateBadges, featuredBadges, type EarnedBadge } from "@/lib/badges";
import {
  bestsFromSets,
  detectNewPrs,
  recordListFromBests,
  type DatedSetLike,
  type DetectedPr,
} from "@/lib/personal-bests";
import { getProfileForUser, timeZoneForUser, type ProfileRecord } from "@/lib/profile";
import { buildTrainingStreak, plannerPrefsFromProfile } from "@/lib/streaks";
import { type LoadUnit } from "@/lib/units";
import { listWorkoutSessionsForUser } from "@/lib/workouts";
import { getLatestBodyMetricsForUser } from "@/lib/body-metrics";

export async function datedSetsForUser(userId: string, excludeSessionId?: string) {
  const sessions = await prisma.workoutSession.findMany({
    where: {
      userId,
      status: "complete",
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
  const prior = await datedSetsForUser(userId, sessionId);
  const current: DatedSetLike[] = session.sets.map((set) => ({
    ...set,
    performedAt: session.performedAt,
  }));
  return detectNewPrs(prior, current, displayUnit);
}

export async function getCompanionProgress(userId: string, displayUnit: LoadUnit, now = new Date()) {
  const [profile, sessions, tz] = await Promise.all([
    getProfileForUser(userId),
    listWorkoutSessionsForUser(userId),
    timeZoneForUser(userId),
  ]);
  const complete = sessions.filter((row) => row.status === "complete");
  const completedDates = complete.map((row) => row.performedAt);
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

export function profilePlanner(profile: ProfileRecord | null) {
  return plannerPrefsFromProfile(profile ?? {});
}

export function summarizeBadges(badges: EarnedBadge[]) {
  const earned = badges.filter((row) => row.earned);
  return { earned: earned.length, total: badges.length };
}
