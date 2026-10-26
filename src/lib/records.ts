import { allTimePeakSets } from "@/lib/lifetime-stats";
import { loggedSetSome } from "@/lib/logged-work";
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

export function loadRecordsFromSets(
  sets: Array<{
    exerciseName: string;
    loadValue: number | null;
    loadUnit: string;
    performedAt: Date;
  }>,
  displayUnit: LoadUnit,
): LoadRecord[] {
  const bests = new Map<string, LoadRecord>();
  for (const set of sets) {
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
        date: set.performedAt,
      });
    }
  }
  return [...bests.values()].sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
}

export function loadRecordsFromSessions(
  sessions: RecordSession[],
  displayUnit: LoadUnit,
): LoadRecord[] {
  return loadRecordsFromSets(
    sessions
      .filter((row) => row.status === "complete")
      .flatMap((session) =>
        session.sets.map((set) => ({
          exerciseName: set.exerciseName,
          loadValue: set.loadValue,
          loadUnit: set.loadUnit,
          performedAt: session.performedAt,
        })),
      ),
    displayUnit,
  );
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
  const [sessions, foods, peaks] = await Promise.all([
    prisma.workoutSession.findMany({
      where: {
        userId,
        status: "complete",
        sets: loggedSetSome,
        performedAt: { gte: since },
      },
      select: { performedAt: true },
    }),
    prisma.nutritionEntry.findMany({
      where: { userId, eatenAt: { gte: since } },
      select: { eatenAt: true },
    }),
    allTimePeakSets(userId),
  ]);
  const activityDates = [
    ...sessions.map((row) => row.performedAt),
    ...foods.map((row) => row.eatenAt),
  ];
  const keys = uniqueActiveDayKeys(activityDates, tz);
  const loadRecords = loadRecordsFromSets(peaks, displayUnit);
  const longestActiveStreak = longestConsecutiveDays(keys);
  return {
    loadRecords,
    longestActiveStreak,
    currentActiveStreak: currentConsecutiveDays(keys, now, tz),
    empty: loadRecords.length === 0 && longestActiveStreak === 0,
  };
}
