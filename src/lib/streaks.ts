import {
  APP_TIMEZONE,
  addZonedDays,
  dayKey,
  mondayOfZoned,
  startOfZonedDay,
} from "@/lib/timezone";
import {
  planForDate,
  type PlannerPrefs,
} from "@/lib/week-plan";

export const WEEK_DOT_LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;

export type WeekStreakDot = {
  key: string;
  label: (typeof WEEK_DOT_LABELS)[number];
  weekday: string;
  scheduled: boolean;
  completed: boolean;
  isToday: boolean;
  missed: boolean;
};

export type TrainingStreak = {
  current: number;
  longest: number;
  nextTarget: number;
  daysToNext: number;
  todayScheduled: boolean;
  weekDots: WeekStreakDot[];
};

function parseDayKey(key: string) {
  const [year, month, date] = key.split("-").map(Number);
  return Date.UTC(year, (month ?? 1) - 1, date ?? 1);
}

export function completedDaySet(dates: Date[], timeZone = APP_TIMEZONE) {
  return new Set(dates.map((value) => dayKey(value, timeZone)));
}

export function isScheduledTrainingDay(
  prefs: PlannerPrefs,
  date: Date,
  timeZone = APP_TIMEZONE,
) {
  return planForDate(prefs, date, timeZone).active;
}

/**
 * Consecutive scheduled training days completed.
 * Scheduled rest days are skipped — they do not increment or break the streak.
 * If today is a scheduled day and not logged yet, the streak stays alive
 * (grace until the local day ends).
 */
export function currentTrainingStreak(
  completedKeys: Iterable<string>,
  prefs: PlannerPrefs,
  now = new Date(),
  timeZone = APP_TIMEZONE,
) {
  const done = completedKeys instanceof Set ? completedKeys : new Set(completedKeys);
  const today = startOfZonedDay(now, timeZone);
  const todayKey = dayKey(today, timeZone);
  let cursor = today;
  if (isScheduledTrainingDay(prefs, today, timeZone) && !done.has(todayKey)) {
    cursor = addZonedDays(today, -1, timeZone);
  }

  let streak = 0;
  for (let i = 0; i < 800; i += 1) {
    const scheduled = isScheduledTrainingDay(prefs, cursor, timeZone);
    const key = dayKey(cursor, timeZone);
    if (!scheduled) {
      cursor = addZonedDays(cursor, -1, timeZone);
      continue;
    }
    if (done.has(key)) {
      streak += 1;
      cursor = addZonedDays(cursor, -1, timeZone);
      continue;
    }
    break;
  }
  return streak;
}

export function longestTrainingStreak(
  completedKeys: Iterable<string>,
  prefs: PlannerPrefs,
  now = new Date(),
  timeZone = APP_TIMEZONE,
) {
  const keys = [...completedKeys].sort();
  if (keys.length === 0) return 0;

  const first = new Date(parseDayKey(keys[0]!));
  const start = startOfZonedDay(first, timeZone);
  const end = startOfZonedDay(now, timeZone);
  const done = new Set(keys);

  let best = 0;
  let run = 0;
  let cursor = start;
  while (cursor.getTime() <= end.getTime()) {
    if (isScheduledTrainingDay(prefs, cursor, timeZone)) {
      if (done.has(dayKey(cursor, timeZone))) {
        run += 1;
        if (run > best) best = run;
      } else {
        run = 0;
      }
    }
    cursor = addZonedDays(cursor, 1, timeZone);
  }
  return best;
}

export function weekStreakDots(
  completedKeys: Iterable<string>,
  prefs: PlannerPrefs,
  now = new Date(),
  timeZone = APP_TIMEZONE,
): WeekStreakDot[] {
  const done = completedKeys instanceof Set ? completedKeys : new Set(completedKeys);
  const monday = mondayOfZoned(now, timeZone);
  const todayKey = dayKey(now, timeZone);
  return WEEK_DOT_LABELS.map((label, index) => {
    const date = addZonedDays(monday, index, timeZone);
    const key = dayKey(date, timeZone);
    const scheduled = isScheduledTrainingDay(prefs, date, timeZone);
    const completed = done.has(key);
    const isToday = key === todayKey;
    const past = date.getTime() < startOfZonedDay(now, timeZone).getTime();
    return {
      key,
      label,
      weekday: planForDate(prefs, date, timeZone).weekday,
      scheduled,
      completed,
      isToday,
      missed: scheduled && !completed && past && !isToday,
    };
  });
}

const STREAK_TARGETS = [7, 30, 100];

export function nextStreakTarget(current: number) {
  const next = STREAK_TARGETS.find((value) => value > current) ?? current + 7;
  return { nextTarget: next, daysToNext: Math.max(0, next - current) };
}

export function buildTrainingStreak(input: {
  completedDates: Date[];
  prefs: PlannerPrefs;
  now?: Date;
  timeZone?: string;
}): TrainingStreak {
  const timeZone = input.timeZone ?? APP_TIMEZONE;
  const now = input.now ?? new Date();
  const keys = completedDaySet(input.completedDates, timeZone);
  const current = currentTrainingStreak(keys, input.prefs, now, timeZone);
  const longest = Math.max(
    current,
    longestTrainingStreak(keys, input.prefs, now, timeZone),
  );
  const { nextTarget, daysToNext } = nextStreakTarget(current);
  const weekDots = weekStreakDots(keys, input.prefs, now, timeZone);
  const today = weekDots.find((dot) => dot.isToday);
  return {
    current,
    longest,
    nextTarget,
    daysToNext,
    todayScheduled: today?.scheduled ?? isScheduledTrainingDay(input.prefs, now, timeZone),
    weekDots,
  };
}

export function streakStatusLine(streak: TrainingStreak) {
  if (!streak.todayScheduled) {
    return "Rest day. Streak safe.";
  }
  if (streak.daysToNext > 0) {
    return `train today to make it ${streak.current + 1}`;
  }
  return "target hit";
}

export function plannerPrefsFromProfile(profile: {
  primaryFocus?: string | null;
  weeklyAvailability?: string[] | null;
  sessionsPerWeek?: number | null;
}): PlannerPrefs {
  return {
    primaryFocus: profile.primaryFocus,
    weeklyAvailability: profile.weeklyAvailability ?? [],
    sessionsPerWeek: profile.sessionsPerWeek,
  };
}
