import { prisma } from "@/lib/prisma";
import {
  isBagRound,
  isGrapplingRound,
  isPadRound,
  isSparringRound,
  type BadgeSetLike,
} from "@/lib/badges";
import { isBikeIntervalName } from "@/lib/bike-sessions";
import { isHoldName, resolveLogMode } from "@/lib/exercise-log-mode";
import { loggedSetSome } from "@/lib/logged-work";
import type { DatedSetLike } from "@/lib/personal-bests";
import { isLoadUnit } from "@/lib/units";

/** Badge ladders top out at 250 rounds. Copies above that do not change a badge. */
const BADGE_ROUND_CAP = 250;

function completeSessionWhere(userId: string, excludeSessionId?: string) {
  return {
    userId,
    status: "complete" as const,
    ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
  };
}

/** Lifetime finished sessions. One count, not a row per workout. */
export async function countLifetimeWorkouts(userId: string, excludeSessionId?: string) {
  return prisma.workoutSession.count({
    where: {
      ...completeSessionWhere(userId, excludeSessionId),
      sets: loggedSetSome,
    },
  });
}

export async function firstCompleteWorkoutAt(userId: string, excludeSessionId?: string) {
  const row = await prisma.workoutSession.findFirst({
    where: {
      ...completeSessionWhere(userId, excludeSessionId),
      sets: loggedSetSome,
    },
    orderBy: { performedAt: "asc" },
    select: { performedAt: true },
  });
  return row?.performedAt ?? null;
}

type SetGroup = {
  exerciseName: string;
  logMode: string;
  loadUnit: string;
  _count: { _all: number };
  _max: { loadValue: number | null; durationSeconds: number | null };
};

function groupCompletedSets(userId: string, excludeSessionId?: string) {
  return prisma.workoutSet.groupBy({
    by: ["exerciseName", "logMode", "loadUnit"],
    where: {
      completed: true,
      session: completeSessionWhere(userId, excludeSessionId),
    },
    _count: { _all: true },
    _max: { loadValue: true, durationSeconds: true },
  });
}

type PeakRow = {
  exerciseName: string;
  loadValue: number | null;
  loadUnit: string;
  reps: number | null;
  logMode: string;
  durationSeconds: number | null;
  completed: boolean;
  session: { performedAt: Date };
};

function toDated(row: PeakRow): DatedSetLike {
  return {
    exerciseName: row.exerciseName.trim(),
    reps: row.reps,
    loadValue: row.loadValue,
    loadUnit: row.loadUnit,
    durationSeconds: row.durationSeconds,
    logMode: row.logMode,
    completed: row.completed,
    performedAt: row.session.performedAt,
  };
}

function isBadgeRound(name: string, logMode: string) {
  return (
    isBikeIntervalName(name) ||
    isPadRound(name, logMode) ||
    isBagRound(name, logMode) ||
    isSparringRound(name, logMode) ||
    isGrapplingRound(name, logMode)
  );
}

function isHoldGroup(name: string, logMode: string) {
  if (!isHoldName(name)) return false;
  const mode = resolveLogMode({ logMode, name });
  return mode === "timed" || mode === "load_timed";
}

/**
 * One set per exercise for the heaviest load, plus one set for the longest hold.
 * The database groups the rows. Only the winning sets come back.
 */
export async function allTimePeakSets(userId: string, excludeSessionId?: string) {
  const groups = await groupCompletedSets(userId, excludeSessionId);
  return peakSetsFromGroups(userId, excludeSessionId, groups);
}

async function peakSetsFromGroups(
  userId: string,
  excludeSessionId: string | undefined,
  groups: SetGroup[],
) {
  const loadWinners = new Map<string, { exerciseName: string; loadUnit: string; loadValue: number }>();
  const holdWinners = new Map<string, { exerciseName: string; durationSeconds: number }>();

  for (const group of groups) {
    const name = group.exerciseName.trim();
    if (!name) continue;
    const maxLoad = group._max.loadValue;
    if (maxLoad != null && isLoadUnit(group.loadUnit)) {
      const key = `${group.exerciseName}\0${group.loadUnit}`;
      const current = loadWinners.get(key);
      if (!current || maxLoad > current.loadValue) {
        loadWinners.set(key, {
          exerciseName: group.exerciseName,
          loadUnit: group.loadUnit,
          loadValue: maxLoad,
        });
      }
    }
    const maxDuration = group._max.durationSeconds;
    if (maxDuration != null && maxDuration > 0 && isHoldGroup(name, group.logMode)) {
      const current = holdWinners.get(name);
      if (!current || maxDuration > current.durationSeconds) {
        holdWinners.set(name, { exerciseName: group.exerciseName, durationSeconds: maxDuration });
      }
    }
  }

  const session = completeSessionWhere(userId, excludeSessionId);
  const or = [
    ...[...loadWinners.values()].map((row) => ({
      exerciseName: row.exerciseName,
      loadUnit: row.loadUnit,
      loadValue: row.loadValue,
      completed: true,
      session,
    })),
    ...[...holdWinners.values()].map((row) => ({
      exerciseName: row.exerciseName,
      durationSeconds: row.durationSeconds,
      completed: true,
      session,
    })),
  ];
  if (or.length === 0) return [] as DatedSetLike[];

  const rows = await prisma.workoutSet.findMany({
    where: { OR: or },
    select: {
      exerciseName: true,
      loadValue: true,
      loadUnit: true,
      reps: true,
      logMode: true,
      durationSeconds: true,
      completed: true,
      session: { select: { performedAt: true } },
    },
  });

  const bestLoad = new Map<string, PeakRow>();
  const bestHold = new Map<string, PeakRow>();
  for (const row of rows) {
    const name = row.exerciseName.trim();
    if (!name) continue;
    if (row.loadValue != null && isLoadUnit(row.loadUnit)) {
      const key = `${row.exerciseName}\0${row.loadUnit}`;
      const wanted = loadWinners.get(key);
      if (wanted && row.loadValue === wanted.loadValue) {
        const current = bestLoad.get(key);
        const reps = row.reps ?? 0;
        const currentReps = current?.reps ?? 0;
        const later = !current || row.session.performedAt.getTime() >= current.session.performedAt.getTime();
        if (!current || reps > currentReps || (reps === currentReps && later)) {
          bestLoad.set(key, row);
        }
      }
    }
    const hold = holdWinners.get(name);
    if (hold && row.durationSeconds === hold.durationSeconds && isHoldGroup(name, row.logMode)) {
      const current = bestHold.get(name);
      if (!current || row.session.performedAt.getTime() >= current.session.performedAt.getTime()) {
        bestHold.set(name, row);
      }
    }
  }

  return [...bestLoad.values(), ...bestHold.values()].map(toDated);
}

function badgeSetsFromGroups(groups: SetGroup[], peaks: DatedSetLike[]): BadgeSetLike[] {
  const rounds = new Map<string, { name: string; logMode: string; count: number }>();
  for (const group of groups) {
    const name = group.exerciseName.trim();
    if (!name || !isBadgeRound(name, group.logMode)) continue;
    const current = rounds.get(name);
    if (current) {
      current.count += group._count._all;
    } else {
      rounds.set(name, { name, logMode: group.logMode, count: group._count._all });
    }
  }

  const sets: BadgeSetLike[] = [...peaks];
  for (const round of rounds.values()) {
    const copies = Math.min(round.count, BADGE_ROUND_CAP);
    for (let index = 0; index < copies; index += 1) {
      sets.push({
        exerciseName: round.name,
        loadValue: null,
        loadUnit: "lb",
        durationSeconds: null,
        logMode: round.logMode,
        completed: true,
        performedAt: new Date(0),
      });
    }
  }
  return sets;
}

/** All-time bests and counts. Streaks stay on the bounded window. */
export async function lifetimeTrainingFacts(userId: string, excludeSessionId?: string) {
  const [workoutCount, firstWorkoutAt, groups] = await Promise.all([
    countLifetimeWorkouts(userId, excludeSessionId),
    firstCompleteWorkoutAt(userId, excludeSessionId),
    groupCompletedSets(userId, excludeSessionId),
  ]);
  const peakSets = await peakSetsFromGroups(userId, excludeSessionId, groups);
  return {
    workoutCount,
    firstWorkoutAt,
    peakSets,
    badgeSets: badgeSetsFromGroups(groups, peakSets),
  };
}
