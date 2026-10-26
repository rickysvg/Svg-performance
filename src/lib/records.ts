import { loggedSetSome, sessionHasLoggedWork } from "@/lib/logged-work";
import { prisma } from "@/lib/prisma";
import { volumeInUnit, type LoadUnit } from "@/lib/units";
import { streakQuerySince, STREAK_LOOKBACK_DAYS } from "@/lib/streaks";
import { timeZoneForUser } from "@/lib/profile";
import {
  APP_TIMEZONE,
  addZonedDays,
  dayKey as zonedDayKey,
  startOfZonedDay,
} from "@/lib/timezone";

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

function parseDayKey(key: string) {
  const [year, month, date] = key.split("-").map(Number);
  return Date.UTC(year, (month ?? 1) - 1, date ?? 1);
}

export function uniqueActiveDayKeys(dates: Date[], timeZone = APP_TIMEZONE) {
  return [...new Set(dates.map((value) => zonedDayKey(value, timeZone)))].sort();
}

export function longestConsecutiveDays(keys: string[]) {
  if (keys.length === 0) return 0;
  let best = 1;
  let run = 1;
  for (let i = 1; i < keys.length; i += 1) {
    const prev = parseDayKey(keys[i - 1]!);
    const next = parseDayKey(keys[i]!);
    const diff = Math.round((next - prev) / 86_400_000);
    if (diff === 1) {
      run += 1;
      if (run > best) best = run;
    } else if (diff !== 0) {
      run = 1;
    }
  }
  return best;
}

export function currentConsecutiveDays(
  keys: string[],
  now = new Date(),
  timeZone = APP_TIMEZONE,
) {
  if (keys.length === 0) return 0;
  const today = zonedDayKey(now, timeZone);
  const set = new Set(keys);
  if (!set.has(today)) {
    return 0;
  }
  let streak = 0;
  let cursor = startOfZonedDay(now, timeZone);
  for (let step = 0; step < STREAK_LOOKBACK_DAYS; step += 1) {
    if (!set.has(zonedDayKey(cursor, timeZone))) break;
    streak += 1;
    cursor = addZonedDays(cursor, -1, timeZone);
  }
  return streak;
}

type RecordSession = {
  status: string;
  performedAt: Date;
  sets: Array<{
    exerciseName: string;
    loadValue: number | null;
    loadUnit: string;
    reps?: number | null;
    durationSeconds?: number | null;
  }>;
};

export function loadRecordsFromSessions(
  sessions: RecordSession[],
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
  sessions: RecordSession[];
  activityDates: Date[];
  displayUnit: LoadUnit;
  now?: Date;
  timeZone?: string;
}): PersonalRecords {
  const timeZone = input.timeZone ?? APP_TIMEZONE;
  const loadRecords = loadRecordsFromSessions(input.sessions, input.displayUnit);
  const keys = uniqueActiveDayKeys(input.activityDates, timeZone);
  const longestActiveStreak = longestConsecutiveDays(keys);
  const currentActiveStreak = currentConsecutiveDays(keys, input.now, timeZone);
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
  timeZone?: string,
) {
  const tz = timeZone ?? (await timeZoneForUser(userId));
  const since = streakQuerySince(now);
  const [sessions, foods] = await Promise.all([
    prisma.workoutSession.findMany({
      where: {
        userId,
        status: "complete",
        sets: loggedSetSome,
        performedAt: { gte: since },
      },
      orderBy: { performedAt: "desc" },
      select: {
        status: true,
        performedAt: true,
        sets: {
          select: {
            exerciseName: true,
            loadValue: true,
            loadUnit: true,
            reps: true,
            durationSeconds: true,
          },
        },
      },
    }),
    prisma.nutritionEntry.findMany({
      where: { userId, eatenAt: { gte: since } },
      select: { eatenAt: true },
    }),
  ]);
  const activityDates = [
    ...sessions
      .filter((row) => sessionHasLoggedWork(row.sets))
      .map((row) => row.performedAt),
    ...foods.map((row) => row.eatenAt),
  ];
  return buildPersonalRecords({ sessions, activityDates, displayUnit, now, timeZone: tz });
}
