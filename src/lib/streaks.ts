import {
  APP_TIMEZONE,
  addZonedDays,
  dayKey,
  mondayOfZoned,
  startOfZonedDay,
  weekdayInZone,
  zonedParts,
  type ZonedWeekday,
} from "@/lib/timezone";
import {
  planForDate,
  type PlannerPrefs,
} from "@/lib/week-plan";

export const WEEK_DOT_LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;

/**
 * Current streak already stopped after 800 calendar days. Longest uses the
 * same window so a session from 2015 does not walk every day since then.
 */
export const STREAK_LOOKBACK_DAYS = 800;

const CIVIL_WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const satisfies readonly ZonedWeekday[];

type CivilDay = {
  year: number;
  month: number;
  day: number;
  weekday: ZonedWeekday;
};

export function streakWindowStart(now = new Date(), timeZone = APP_TIMEZONE) {
  return addZonedDays(startOfZonedDay(now, timeZone), -(STREAK_LOOKBACK_DAYS - 1), timeZone);
}

/** SQL floor for streak reads. Two extra days cover a civil day that starts before this UTC instant. */
export function streakHistorySince(now = new Date(), timeZone = APP_TIMEZONE) {
  return addZonedDays(streakWindowStart(now, timeZone), -2, timeZone);
}

/**
 * Zone-independent query floor. A member's civil window starts at most a day
 * away from UTC, so this stays a lower bound without reading the profile first.
 */
export function streakQuerySince(now = new Date()) {
  return new Date(now.getTime() - (STREAK_LOOKBACK_DAYS + 3) * 86_400_000);
}

function civilKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function nextCivilDay(cursor: CivilDay): CivilDay {
  const shifted = new Date(Date.UTC(cursor.year, cursor.month - 1, cursor.day + 1));
  const index = CIVIL_WEEKDAYS.indexOf(cursor.weekday);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: CIVIL_WEEKDAYS[(index + 1) % 7]!,
  };
}

/**
 * Training days repeat by weekday. One week of the plan covers the streak
 * walk, so the window does not rebuild a plan for every calendar day.
 */
function scheduledWeekdays(prefs: PlannerPrefs, now: Date, timeZone: string) {
  const monday = mondayOfZoned(now, timeZone);
  const scheduled = new Set<ZonedWeekday>();
  for (let index = 0; index < 7; index += 1) {
    const date = addZonedDays(monday, index, timeZone);
    if (isScheduledTrainingDay(prefs, date, timeZone)) {
      scheduled.add(weekdayInZone(date, timeZone));
    }
  }
  return scheduled;
}

/** Current and longest streaks in one pass over the lookback window. */
export function trainingStreakCounts(
  completedKeys: Iterable<string>,
  prefs: PlannerPrefs,
  now = new Date(),
  timeZone = APP_TIMEZONE,
) {
  const scheduled = scheduledWeekdays(prefs, now, timeZone);
  const today = zonedParts(startOfZonedDay(now, timeZone), timeZone);
  const todayKey = civilKey(today.year, today.month, today.day);
  const windowStart = streakWindowStart(now, timeZone);
  const window = zonedParts(windowStart, timeZone);
  const windowKey = civilKey(window.year, window.month, window.day);
  const done = new Set<string>();
  for (const key of completedKeys) {
    if (key >= windowKey && key <= todayKey) done.add(key);
  }

  let cursor: CivilDay = {
    year: window.year,
    month: window.month,
    day: window.day,
    weekday: window.weekday,
  };
  let run = 0;
  let best = 0;
  for (let step = 0; step < STREAK_LOOKBACK_DAYS; step += 1) {
    const key = civilKey(cursor.year, cursor.month, cursor.day);
    if (scheduled.has(cursor.weekday)) {
      if (done.has(key)) {
        run += 1;
        if (run > best) best = run;
      } else if (key !== todayKey) {
        run = 0;
      }
    }
    if (key === todayKey) break;
    cursor = nextCivilDay(cursor);
  }
  return { current: run, longest: Math.max(best, run) };
}

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
  return trainingStreakCounts(completedKeys, prefs, now, timeZone).current;
}

export function longestTrainingStreak(
  completedKeys: Iterable<string>,
  prefs: PlannerPrefs,
  now = new Date(),
  timeZone = APP_TIMEZONE,
) {
  return trainingStreakCounts(completedKeys, prefs, now, timeZone).longest;
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

/** Share of the streak ring to paint. A current streak that is also the best fills the ring. */
export function streakRingRatio(current: number, longest: number) {
  const safeCurrent = Number.isFinite(current) ? Math.max(0, current) : 0;
  const safeLongest = Number.isFinite(longest) ? Math.max(0, longest) : 0;
  const target = Math.max(safeLongest, safeCurrent, 1);
  return Math.min(1, safeCurrent / target);
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
  const sinceMs = streakHistorySince(now, timeZone).getTime();
  const keys = completedDaySet(
    input.completedDates.filter((date) => date.getTime() >= sinceMs),
    timeZone,
  );
  const { current, longest } = trainingStreakCounts(keys, input.prefs, now, timeZone);
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
  const todayDone = streak.weekDots.some((dot) => dot.isToday && dot.completed);
  if (todayDone) {
    const unit = streak.current === 1 ? "day" : "days";
    return `Today counts. Streak is ${streak.current} ${unit}.`;
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
  trainingFocus?: string | null;
  liftDaysPerWeek?: number | null;
  experienceLevel?: string | null;
  email?: string | null;
  outsideTraining?: PlannerPrefs["outsideTraining"];
  onboardingCompletedAt?: Date | null;
}): PlannerPrefs {
  return {
    primaryFocus: profile.primaryFocus,
    weeklyAvailability: profile.weeklyAvailability ?? [],
    sessionsPerWeek: profile.sessionsPerWeek,
    trainingFocus: profile.trainingFocus,
    liftDaysPerWeek: profile.liftDaysPerWeek,
    experienceLevel: profile.experienceLevel,
    email: profile.email,
    outsideTraining: profile.outsideTraining ?? [],
    planAnchor: profile.onboardingCompletedAt ?? undefined,
  };
}
