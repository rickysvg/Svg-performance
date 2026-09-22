import { prisma } from "@/lib/prisma";
import { volumeInUnit, type LoadUnit } from "@/lib/units";
import { startOfLocalDay } from "@/lib/nutrition";
import { listWorkoutSessionsForUser } from "@/lib/workouts";
import type { WorkoutSession, WorkoutSet } from "@prisma/client";

export type LoadRecord = {
  exerciseName: string;
  bestLoad: number;
  unit: LoadUnit;
  date: Date;
};

export type PersonalRecords = {
  loadRecords: LoadRecord[];
  longestActiveStreak: number;
  currentActiveStreak: number;
  empty: boolean;
};

function dayKey(value: Date) {
  return `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
}

function parseDayKey(key: string) {
  const [year, month, date] = key.split("-").map(Number);
  return new Date(year, month, date);
}

export function uniqueActiveDayKeys(dates: Date[]) {
  return [...new Set(dates.map((value) => dayKey(startOfLocalDay(value))))].sort((a, b) => {
    return parseDayKey(a).getTime() - parseDayKey(b).getTime();
  });
}

export function longestConsecutiveDays(keys: string[]) {
  if (keys.length === 0) return 0;
  let best = 1;
  let run = 1;
  for (let i = 1; i < keys.length; i += 1) {
    const prev = parseDayKey(keys[i - 1]!);
    const next = parseDayKey(keys[i]!);
    const diff = Math.round((next.getTime() - prev.getTime()) / 86_400_000);
    if (diff === 1) {
      run += 1;
      if (run > best) best = run;
    } else if (diff !== 0) {
      run = 1;
    }
  }
  return best;
}

export function currentConsecutiveDays(keys: string[], now = new Date()) {
  if (keys.length === 0) return 0;
  const today = dayKey(startOfLocalDay(now));
  const set = new Set(keys);
  if (!set.has(today)) {
    return 0;
  }
  let streak = 0;
  const cursor = startOfLocalDay(now);
  while (set.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function loadRecordsFromSessions(
  sessions: Array<WorkoutSession & { sets: WorkoutSet[] }>,
  displayUnit: LoadUnit,
): LoadRecord[] {
  const bests = new Map<string, LoadRecord>();
  for (const session of sessions.filter((row) => row.status === "complete")) {
    for (const set of session.sets) {
      if (set.loadValue == null) continue;
      const load = volumeInUnit(1, set.loadValue, set.loadUnit, displayUnit);
      const name = set.exerciseName.trim();
      if (!name) continue;
      const current = bests.get(name);
      if (!current || load > current.bestLoad) {
        bests.set(name, {
          exerciseName: name,
          bestLoad: Math.round(load * 10) / 10,
          unit: displayUnit,
          date: session.performedAt,
        });
      }
    }
  }
  return [...bests.values()].sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
}

export function buildPersonalRecords(input: {
  sessions: Array<WorkoutSession & { sets: WorkoutSet[] }>;
  activityDates: Date[];
  displayUnit: LoadUnit;
  now?: Date;
}): PersonalRecords {
  const loadRecords = loadRecordsFromSessions(input.sessions, input.displayUnit);
  const keys = uniqueActiveDayKeys(input.activityDates);
  const longestActiveStreak = longestConsecutiveDays(keys);
  const currentActiveStreak = currentConsecutiveDays(keys, input.now);
  return {
    loadRecords,
    longestActiveStreak,
    currentActiveStreak,
    empty: loadRecords.length === 0 && longestActiveStreak === 0,
  };
}

export async function getPersonalRecordsForUser(
  userId: string,
  displayUnit: LoadUnit,
  now = new Date(),
) {
  const [sessions, foods] = await Promise.all([
    listWorkoutSessionsForUser(userId),
    prisma.nutritionEntry.findMany({
      where: { userId },
      select: { eatenAt: true },
    }),
  ]);
  const activityDates = [
    ...sessions.filter((row) => row.status === "complete").map((row) => row.performedAt),
    ...foods.map((row) => row.eatenAt),
  ];
  return buildPersonalRecords({ sessions, activityDates, displayUnit, now });
}
