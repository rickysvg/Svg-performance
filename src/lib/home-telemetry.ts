import { prisma } from "@/lib/prisma";
import { loggedSetSome } from "@/lib/logged-work";
import { sessionCivilDay } from "@/lib/performed-at";
import { getProfileForUser } from "@/lib/profile";
import { buildTrainingStreak, plannerPrefsFromProfile } from "@/lib/streaks";
import { addZonedDays, dayKey, mondayOfZoned, zonedCivilToUtc, APP_TIMEZONE } from "@/lib/timezone";
import { volumeInUnit, type LoadUnit } from "@/lib/units";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;
const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type TelemetryDay = {
  key: string;
  label: (typeof DAY_LABELS)[number];
  name: (typeof DAY_NAMES)[number];
  load: number;
  rounds: number;
  sessions: number;
};

export type HomeTelemetrySnapshot = {
  days: TelemetryDay[];
  weekLoad: number;
  weekRounds: number;
  weekSessions: number;
  streakCurrent: number;
  streakLongest: number;
};

export function formatTelemetryNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1000) {
    const compact = Math.round((abs / 1000) * 10) / 10;
    return `${sign}${compact}k`;
  }
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 10) / 10);
}

export function buildWeekTelemetry(input: {
  weekKeys: string[];
  sessions: Array<{ dayKey: string; volume: number }>;
  rounds: Array<{ dayKey: string; rounds: number }>;
  streakCurrent: number;
  streakLongest: number;
}): HomeTelemetrySnapshot {
  const days: TelemetryDay[] = input.weekKeys.slice(0, 7).map((key, index) => ({
    key,
    label: DAY_LABELS[index] ?? "M",
    name: DAY_NAMES[index] ?? "Monday",
    load: 0,
    rounds: 0,
    sessions: 0,
  }));
  const byKey = new Map(days.map((day) => [day.key, day]));
  for (const session of input.sessions) {
    const day = byKey.get(session.dayKey);
    if (!day) continue;
    day.load += session.volume;
    day.sessions += 1;
  }
  for (const row of input.rounds) {
    const day = byKey.get(row.dayKey);
    if (!day) continue;
    day.rounds += row.rounds;
  }
  for (const day of days) {
    day.load = Math.round(day.load);
  }
  return {
    days,
    weekLoad: days.reduce((sum, day) => sum + day.load, 0),
    weekRounds: days.reduce((sum, day) => sum + day.rounds, 0),
    weekSessions: days.reduce((sum, day) => sum + day.sessions, 0),
    streakCurrent: input.streakCurrent,
    streakLongest: input.streakLongest,
  };
}

export function emptyHomeTelemetry(
  now = new Date(),
  timeZone = APP_TIMEZONE,
): HomeTelemetrySnapshot {
  const monday = mondayOfZoned(now, timeZone);
  return buildWeekTelemetry({
    weekKeys: Array.from({ length: 7 }, (_, index) =>
      dayKey(addZonedDays(monday, index, timeZone), timeZone),
    ),
    sessions: [],
    rounds: [],
    streakCurrent: 0,
    streakLongest: 0,
  });
}

export async function getHomeTelemetry(input: {
  userId: string;
  now?: Date;
  timeZone: string;
  displayUnit?: LoadUnit;
}): Promise<HomeTelemetrySnapshot> {
  const now = input.now ?? new Date();
  const timeZone = input.timeZone;
  const displayUnit = input.displayUnit ?? "lb";
  const monday = mondayOfZoned(now, timeZone);
  const next = addZonedDays(monday, 7, timeZone);
  const from = addZonedDays(monday, -1, timeZone);
  const to = addZonedDays(next, 1, timeZone);
  const weekKeys = Array.from({ length: 7 }, (_, index) =>
    dayKey(addZonedDays(monday, index, timeZone), timeZone),
  );

  const [profile, weekSessions, roundRows, completed] = await Promise.all([
    getProfileForUser(input.userId),
    prisma.workoutSession.findMany({
      where: {
        userId: input.userId,
        status: "complete",
        sets: loggedSetSome,
        performedAt: { gte: from, lt: to },
      },
      select: {
        performedAt: true,
        createdAt: true,
        sets: { select: { reps: true, loadValue: true, loadUnit: true } },
      },
    }),
    prisma.outsideSessionLog.findMany({
      where: { userId: input.userId, dateKey: { in: weekKeys } },
      select: { dateKey: true, rounds: true },
    }),
    prisma.workoutSession.findMany({
      where: { userId: input.userId, status: "complete", sets: loggedSetSome },
      select: { performedAt: true, createdAt: true },
    }),
  ]);

  const sessions = weekSessions.map((session) => {
    const key = sessionCivilDay(session, timeZone);
    const volume = session.sets.reduce(
      (sum, set) =>
        sum + volumeInUnit(set.reps, set.loadValue, set.loadUnit, displayUnit),
      0,
    );
    return { dayKey: key, volume };
  });
  const streak = buildTrainingStreak({
    completedDates: completed.map((row) => {
      const key = sessionCivilDay(row, timeZone);
      const [year, month, day] = key.split("-").map(Number);
      return zonedCivilToUtc(year!, month!, day!, timeZone);
    }),
    prefs: plannerPrefsFromProfile(profile ?? {}),
    now,
    timeZone,
  });

  return buildWeekTelemetry({
    weekKeys,
    sessions,
    rounds: roundRows.map((row) => ({ dayKey: row.dateKey, rounds: row.rounds })),
    streakCurrent: streak.current,
    streakLongest: streak.longest,
  });
}
