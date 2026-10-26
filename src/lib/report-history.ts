import { BAGWORK_PRESCRIPTION, bagworkTrainingLoadFromSession } from "@/lib/bagwork";
import { DIFFICULTY_RATINGS, difficultyScore } from "@/lib/difficulty";
import { liftRegionForExercise, type LiftRegion } from "@/lib/lift-region";
import { setHasLoggedWork } from "@/lib/logged-work";
import { formatTelemetryNumber, loggedSetVolume } from "@/lib/home-telemetry";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { prisma } from "@/lib/prisma";
import { sessionAppearsOnProgress } from "@/lib/progress";
import { exerciseMatchesRoundType } from "@/lib/round-session";
import { sessionDurationSeconds } from "@/lib/share-card";
import { buildTrainingStreak, plannerPrefsFromProfile } from "@/lib/streaks";
import type { PlannerPrefs } from "@/lib/week-plan";
import { exerciseUsesBikeLogger } from "@/lib/timer-session";
import {
  addZonedDays,
  dayKey,
  mondayOfZoned,
  weekdayInZone,
  zonedCivilToUtc,
  zonedParts,
} from "@/lib/timezone";
import type { LoadUnit } from "@/lib/units";
import { sessionCivilDay, sessionCompletionDay } from "@/lib/performed-at";
import { readTimerFieldsByIds } from "@/lib/workout-timer-columns";
import { bikeCardioDurationSeconds } from "@/lib/workout-complete";

export const REPORT_FOCUSES = [
  { id: "all", label: "All" },
  { id: "bike", label: "Assault Bike" },
  { id: "lower", label: "Lifting – Lower body" },
  { id: "upper", label: "Lifting – Upper body" },
] as const;

export type ReportFocus = (typeof REPORT_FOCUSES)[number]["id"];
export type ReportKind = "week" | "month";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const ROUND_KINDS = ["bag", "pads", "sparring", "grappling"] as const;
type RoundKind = (typeof ROUND_KINDS)[number];

export type ReportSet = {
  exerciseName: string;
  reps: number | null;
  loadValue: number | null;
  loadUnit: string;
  logMode: string;
  durationSeconds: number | null;
  completed: boolean;
  prescriptionKey: string;
};

export type ReportSession = {
  id: string;
  performedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  status: string;
  title: string;
  difficultyRating: string;
  sessionRpe: number | null;
  elapsedSeconds: number | null;
  backfilled: boolean;
  sets: ReportSet[];
};

export type ReportOutside = {
  dateKey: string;
  rounds: number;
  minutesPerRound: number;
  sessionRating: number | null;
  roundType: string;
};

export type RoundTotals = Record<RoundKind, number> & { total: number };

export type SparringSplit = {
  amateur: number;
  pro: number;
  unspecified: number;
  total: number;
};

export type PeriodMetrics = {
  sessions: number;
  trainingSeconds: number;
  sets: number;
  volume: number;
  bagLoad: number;
  trainingLoad: number;
  rounds: RoundTotals;
  bikeSeconds: number;
  difficultyAverage: number | null;
  difficultyCount: number;
  difficultyLabel: string;
  sessionRpeAverage: number | null;
  sessionRpeCount: number;
  sparring: SparringSplit;
  sparringRatingAverage: number | null;
  sparringRatingCount: number;
  streakCurrent: number;
};

export type PeriodDelta = {
  direction: "up" | "down" | "flat";
  absolute: number;
  /** Null when the baseline is 0. A percent is not invented from nothing. */
  percent: number | null;
};

export type MetricCard = {
  id: string;
  label: string;
  value: string;
  current: number;
  baseline: number;
  mode: "count" | "percent";
  places?: number;
  hint?: string;
  /** False when one side has no rating, so a missing score is not a zero. */
  comparable?: boolean;
};

export type ChartPoint = {
  label: string;
  detail: string;
  current: number;
  baseline: number;
};

export type SparringChartPoint = {
  label: string;
  detail: string;
  amateur: number;
  pro: number;
  unspecified: number;
  baseline: number;
};

export type ChartModel = {
  id: string;
  title: string;
  description: string;
  unit: string;
  points: ChartPoint[];
};

export type DayBucket = {
  key: string;
  label: string;
  detail: string;
  dayKeys: string[];
};

export type ReportHistory = {
  userId: string;
  timeZone: string;
  displayUnit: LoadUnit;
  prefs: PlannerPrefs;
  sessions: ReportSession[];
  outside: ReportOutside[];
  now: Date;
};

export function parseReportFocus(value: string | null | undefined): ReportFocus {
  if (value === "bike" || value === "lower" || value === "upper") return value;
  return "all";
}

export function periodDelta(current: number, baseline: number, places = 0): PeriodDelta {
  const scale = 10 ** places;
  const cur = Math.round(current * scale) / scale;
  const base = Math.round(baseline * scale) / scale;
  const raw = Math.round((cur - base) * scale) / scale;
  if (raw === 0) return { direction: "flat", absolute: 0, percent: base === 0 ? null : 0 };
  const direction = raw > 0 ? "up" : "down";
  const percent = base === 0 ? null : Math.round((Math.abs(raw) / Math.abs(base)) * 100);
  return { direction, absolute: Math.abs(raw), percent };
}

export function formatTrainingTime(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.round((total % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

export function isMondayKey(key: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const instant = zonedCivilToUtc(year, month, day, timeZone);
  if (dayKey(instant, timeZone) !== key) return false;
  return weekdayInZone(instant, timeZone) === "Monday";
}

export function isMonthKey(key: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

export function currentWeekKey(now: Date, timeZone: string) {
  return dayKey(mondayOfZoned(now, timeZone), timeZone);
}

export function currentMonthKey(now: Date, timeZone: string) {
  return dayKey(now, timeZone).slice(0, 7);
}

export function shiftWeekKey(key: string, weeks: number, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const instant = zonedCivilToUtc(Number(match[1]), Number(match[2]), Number(match[3]), timeZone);
  return dayKey(addZonedDays(instant, weeks * 7, timeZone), timeZone);
}

export function shiftMonthKey(key: string, months: number) {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return null;
  const shifted = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + months, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function formatWeekRange(weekStartKey: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekStartKey);
  if (!match) return weekStartKey;
  const start = zonedCivilToUtc(Number(match[1]), Number(match[2]), Number(match[3]), timeZone);
  const end = addZonedDays(start, 6, timeZone);
  const startParts = zonedParts(start, timeZone);
  const endParts = zonedParts(end, timeZone);
  const monthOf = (date: Date) =>
    new Intl.DateTimeFormat("en-US", { month: "short", timeZone }).format(date);
  const range =
    startParts.month === endParts.month && startParts.year === endParts.year
      ? `${monthOf(start)} ${startParts.day}–${endParts.day}`
      : `${monthOf(start)} ${startParts.day} – ${monthOf(end)} ${endParts.day}`;
  return `${range}, ${endParts.year}`;
}

export function formatMonthLabel(monthKey: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return monthKey;
  const instant = zonedCivilToUtc(Number(match[1]), Number(match[2]), 1, timeZone);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone }).format(instant);
}

function emptyRounds(): RoundTotals {
  return { bag: 0, pads: 0, sparring: 0, grappling: 0, total: 0 };
}

export function emptyMetrics(): PeriodMetrics {
  return {
    sessions: 0,
    trainingSeconds: 0,
    sets: 0,
    volume: 0,
    bagLoad: 0,
    trainingLoad: 0,
    rounds: emptyRounds(),
    bikeSeconds: 0,
    difficultyAverage: null,
    difficultyCount: 0,
    difficultyLabel: "",
    sessionRpeAverage: null,
    sessionRpeCount: 0,
    sparring: { amateur: 0, pro: 0, unspecified: 0, total: 0 },
    sparringRatingAverage: null,
    sparringRatingCount: 0,
    streakCurrent: 0,
  };
}

function asShare(session: ReportSession) {
  return {
    title: session.title,
    performedAt: session.performedAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    status: session.status,
    elapsedSeconds: session.elapsedSeconds,
    backfilled: session.backfilled,
    sets: session.sets,
  };
}

function setIsAssaultBike(set: ReportSet) {
  return exerciseUsesBikeLogger(set.exerciseName, set.prescriptionKey);
}

function roundKindOf(set: ReportSet): RoundKind | null {
  if (set.completed === false) return null;
  if (!setHasLoggedWork(set)) return null;
  const key = set.prescriptionKey ?? "";
  if (key === BAGWORK_PRESCRIPTION || key.startsWith("round:bag:")) return "bag";
  if (key.startsWith("round:pads:")) return "pads";
  if (key.startsWith("round:sparring:")) return "sparring";
  if (key.startsWith("round:grappling:")) return "grappling";
  if (key.startsWith("round:bike:") || setIsAssaultBike(set)) return null;
  if (exerciseMatchesRoundType(set.exerciseName, set.logMode, "sparring")) return "sparring";
  if (exerciseMatchesRoundType(set.exerciseName, set.logMode, "pads")) return "pads";
  if (exerciseMatchesRoundType(set.exerciseName, set.logMode, "grappling")) return "grappling";
  if (exerciseMatchesRoundType(set.exerciseName, set.logMode, "bag")) return "bag";
  return null;
}

function setMatchesFocus(set: ReportSet, focus: ReportFocus) {
  if (!setHasLoggedWork(set)) return false;
  if (focus === "all") return true;
  if (focus === "bike") return setIsAssaultBike(set);
  return liftRegionForExercise(set.exerciseName) === focus;
}

function bikeSecondsForSession(session: ReportSession) {
  const logged = session.sets.filter((set) => setHasLoggedWork(set));
  const bikeSets = logged.filter((set) => setIsAssaultBike(set));
  if (bikeSets.length === 0) return 0;
  if (logged.every((set) => setIsAssaultBike(set))) {
    return bikeCardioDurationSeconds(asShare(session));
  }
  return bikeSets.reduce(
    (sum, set) => sum + (set.durationSeconds != null && set.durationSeconds > 0 ? set.durationSeconds : 0),
    0,
  );
}

function regionSeconds(session: ReportSession, region: LiftRegion) {
  const logged = session.sets.filter((set) => setHasLoggedWork(set));
  const matching = logged.filter((set) => liftRegionForExercise(set.exerciseName) === region);
  if (matching.length === 0) return 0;
  if (logged.every((set) => liftRegionForExercise(set.exerciseName) === region)) {
    return sessionDurationSeconds(asShare(session));
  }
  return matching.reduce(
    (sum, set) => sum + (set.durationSeconds != null && set.durationSeconds > 0 ? set.durationSeconds : 0),
    0,
  );
}

function roundTypeBucket(value: string): "amateur" | "pro" | "unspecified" {
  if (value === "amateur" || value === "pro") return value;
  return "unspecified";
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function difficultySummary(sessions: ReportSession[]) {
  const scores = sessions
    .map((session) => difficultyScore(session.difficultyRating))
    .filter((score) => score != null);
  const averageScore = average(scores);
  if (averageScore == null) return { average: null, count: 0, label: "" };
  const nearest = DIFFICULTY_RATINGS.reduce((best, item) =>
    Math.abs(item.score - averageScore) < Math.abs(best.score - averageScore) ? item : best,
  );
  return { average: averageScore, count: scores.length, label: nearest.label };
}

export function summarizePeriod(input: {
  sessions: ReportSession[];
  outside: ReportOutside[];
  focus: ReportFocus;
  displayUnit: LoadUnit;
}): PeriodMetrics {
  const metrics = emptyMetrics();
  const counted: ReportSession[] = [];
  for (const session of input.sessions) {
    if (!sessionAppearsOnProgress(session)) continue;
    const sets = session.sets.filter((set) => set.completed !== false && setMatchesFocus(set, input.focus));
    if (input.focus !== "all" && sets.length === 0) continue;
    counted.push(session);
    metrics.sessions += 1;
    metrics.sets += sets.filter((set) => set.completed !== false).length;
    metrics.volume += loggedSetVolume(sets, input.displayUnit);
    if (input.focus === "all") {
      metrics.trainingSeconds += sessionDurationSeconds(asShare(session));
      metrics.bagLoad += bagworkTrainingLoadFromSession(session);
      for (const set of session.sets) {
        const kind = roundKindOf(set);
        if (!kind) continue;
        metrics.rounds[kind] += 1;
        metrics.rounds.total += 1;
        if (kind === "sparring") metrics.sparring.unspecified += 1;
      }
    } else if (input.focus === "bike") {
      metrics.trainingSeconds += bikeSecondsForSession(session);
    } else {
      metrics.trainingSeconds += regionSeconds(session, input.focus);
    }
    metrics.bikeSeconds += input.focus === "lower" || input.focus === "upper" ? 0 : bikeSecondsForSession(session);
  }
  if (input.focus === "all") {
    for (const log of input.outside) {
      const rounds = Math.max(0, log.rounds);
      if (rounds <= 0) continue;
      metrics.sessions += 1;
      metrics.rounds.sparring += rounds;
      metrics.rounds.total += rounds;
      metrics.sparring[roundTypeBucket(log.roundType)] += rounds;
      const minutes = Math.max(0, log.rounds) * Math.max(0, log.minutesPerRound);
      metrics.trainingSeconds += minutes * 60;
      if (log.sessionRating != null && log.sessionRating >= 1 && log.sessionRating <= 5) {
        metrics.sparringRatingCount += 1;
      }
    }
    const ratings = input.outside
      .map((log) => log.sessionRating)
      .filter((value): value is number => value != null && value >= 1 && value <= 5);
    metrics.sparringRatingAverage = average(ratings);
  }
  metrics.sparring.total = metrics.sparring.amateur + metrics.sparring.pro + metrics.sparring.unspecified;
  metrics.volume = Math.round(metrics.volume);
  metrics.bagLoad = Math.round(metrics.bagLoad);
  metrics.trainingLoad = metrics.volume + (input.focus === "all" ? metrics.bagLoad : 0);
  const difficulty = difficultySummary(counted);
  metrics.difficultyAverage = difficulty.average;
  metrics.difficultyCount = difficulty.count;
  metrics.difficultyLabel = difficulty.label;
  const rpes = counted
    .map((session) => session.sessionRpe)
    .filter((value): value is number => value != null && value >= 1 && value <= 10);
  metrics.sessionRpeAverage = average(rpes);
  metrics.sessionRpeCount = rpes.length;
  return metrics;
}

function indexHistory(history: Pick<ReportHistory, "sessions" | "outside" | "timeZone">) {
  const sessionsByDay = new Map<string, ReportSession[]>();
  for (const session of history.sessions) {
    const key = sessionCivilDay(session, history.timeZone);
    const list = sessionsByDay.get(key) ?? [];
    list.push(session);
    sessionsByDay.set(key, list);
  }
  const outsideByDay = new Map<string, ReportOutside[]>();
  for (const log of history.outside) {
    const list = outsideByDay.get(log.dateKey) ?? [];
    list.push(log);
    outsideByDay.set(log.dateKey, list);
  }
  return { sessionsByDay, outsideByDay };
}

function rowsForDays(
  index: ReturnType<typeof indexHistory>,
  dayKeys: readonly string[],
) {
  const sessions: ReportSession[] = [];
  const outside: ReportOutside[] = [];
  for (const key of dayKeys) {
    sessions.push(...(index.sessionsByDay.get(key) ?? []));
    outside.push(...(index.outsideByDay.get(key) ?? []));
  }
  return { sessions, outside };
}

export function weekDayKeys(weekStartKey: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekStartKey);
  if (!match) return [];
  const start = zonedCivilToUtc(Number(match[1]), Number(match[2]), Number(match[3]), timeZone);
  return Array.from({ length: 7 }, (_, index) => dayKey(addZonedDays(start, index, timeZone), timeZone));
}

export function weekBuckets(weekStartKey: string, timeZone: string): DayBucket[] {
  return weekDayKeys(weekStartKey, timeZone).map((key, index) => ({
    key,
    label: DAY_LABELS[index] ?? "M",
    detail: DAY_NAMES[index] ?? "Monday",
    dayKeys: [key],
  }));
}

export function monthDayKeys(monthKey: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return [];
  const year = Number(match[1]);
  const month = Number(match[2]);
  const start = zonedCivilToUtc(year, month, 1, timeZone);
  const next = zonedCivilToUtc(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, 1, timeZone);
  const keys: string[] = [];
  let cursor = start;
  while (cursor.getTime() < next.getTime() && keys.length < 31) {
    keys.push(dayKey(cursor, timeZone));
    cursor = addZonedDays(cursor, 1, timeZone);
  }
  return keys;
}

export function monthBuckets(monthKey: string, timeZone: string): DayBucket[] {
  const days = monthDayKeys(monthKey, timeZone);
  if (days.length === 0) return [];
  const first = days[0]!;
  const last = days[days.length - 1]!;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(first);
  if (!match) return [];
  let monday = mondayOfZoned(
    zonedCivilToUtc(Number(match[1]), Number(match[2]), Number(match[3]), timeZone),
    timeZone,
  );
  const buckets: DayBucket[] = [];
  while (buckets.length < 6) {
    const mondayKey = dayKey(monday, timeZone);
    if (mondayKey > last) break;
    const dayKeys = weekDayKeys(mondayKey, timeZone).filter((key) => key >= first && key <= last);
    if (dayKeys.length > 0) {
      const labelDate = zonedCivilToUtc(
        Number(mondayKey.slice(0, 4)),
        Number(mondayKey.slice(5, 7)),
        Number(mondayKey.slice(8, 10)),
        timeZone,
      );
      buckets.push({
        key: mondayKey,
        label: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone }).format(labelDate),
        detail: formatWeekRange(mondayKey, timeZone),
        dayKeys,
      });
    }
    monday = addZonedDays(monday, 7, timeZone);
  }
  return buckets;
}

function periodEnd(endExclusive: Date, now: Date) {
  const last = new Date(endExclusive.getTime() - 1);
  return last.getTime() > now.getTime() ? now : last;
}

function weekBounds(weekStartKey: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekStartKey);
  if (!match) return null;
  const from = zonedCivilToUtc(Number(match[1]), Number(match[2]), Number(match[3]), timeZone);
  return { from, endExclusive: addZonedDays(from, 7, timeZone), dayKeys: weekDayKeys(weekStartKey, timeZone) };
}

function monthBounds(monthKey: string, timeZone: string) {
  const days = monthDayKeys(monthKey, timeZone);
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match || days.length === 0) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const from = zonedCivilToUtc(year, month, 1, timeZone);
  const endExclusive = zonedCivilToUtc(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, 1, timeZone);
  return { from, endExclusive, dayKeys: days };
}

export function streakAt(history: ReportHistory, at: Date) {
  const dates = history.sessions
    .filter((session) => session.status === "complete" && session.performedAt.getTime() <= at.getTime())
    .map((session) => {
      const key = sessionCompletionDay(session, history.timeZone);
      const [year, month, day] = key.split("-").map(Number);
      return zonedCivilToUtc(year!, month!, day!, history.timeZone);
    });
  return buildTrainingStreak({
    completedDates: dates,
    prefs: history.prefs,
    now: at,
    timeZone: history.timeZone,
  }).current;
}

function metricsForDays(
  history: ReportHistory,
  index: ReturnType<typeof indexHistory>,
  dayKeys: string[],
  focus: ReportFocus,
  endExclusive: Date,
) {
  const rows = rowsForDays(index, dayKeys);
  const metrics = summarizePeriod({
    sessions: rows.sessions,
    outside: rows.outside,
    focus,
    displayUnit: history.displayUnit,
  });
  if (focus === "all") {
    metrics.streakCurrent = streakAt(history, periodEnd(endExclusive, history.now));
  }
  return metrics;
}

type ChartMetric = "load" | "volume" | "rounds" | "bike" | "sets" | "sessions";

function chartValue(metrics: PeriodMetrics, metric: ChartMetric) {
  if (metric === "load") return metrics.trainingLoad;
  if (metric === "volume") return metrics.volume;
  if (metric === "rounds") return metrics.rounds.total;
  if (metric === "bike") return Math.round(metrics.bikeSeconds / 60);
  if (metric === "sets") return metrics.sets;
  return metrics.sessions;
}

function comparePoints(
  history: ReportHistory,
  index: ReturnType<typeof indexHistory>,
  current: DayBucket[],
  baseline: DayBucket[],
  focus: ReportFocus,
  metric: ChartMetric,
): ChartPoint[] {
  const length = Math.max(current.length, baseline.length);
  const points: ChartPoint[] = [];
  for (let i = 0; i < length; i += 1) {
    const bucket = current[i] ?? baseline[i];
    if (!bucket) continue;
    const currentMetrics = current[i]
      ? summarizePeriod({
          ...rowsForDays(index, current[i]!.dayKeys),
          focus,
          displayUnit: history.displayUnit,
        })
      : emptyMetrics();
    const baselineMetrics = baseline[i]
      ? summarizePeriod({
          ...rowsForDays(index, baseline[i]!.dayKeys),
          focus,
          displayUnit: history.displayUnit,
        })
      : emptyMetrics();
    points.push({
      label: current[i]?.label ?? baseline[i]!.label,
      detail: current[i]?.detail ?? baseline[i]!.detail,
      current: chartValue(currentMetrics, metric),
      baseline: chartValue(baselineMetrics, metric),
    });
  }
  return points;
}

function sparringPoints(
  history: ReportHistory,
  index: ReturnType<typeof indexHistory>,
  current: DayBucket[],
  baseline: DayBucket[],
): SparringChartPoint[] {
  const length = Math.max(current.length, baseline.length);
  const points: SparringChartPoint[] = [];
  for (let i = 0; i < length; i += 1) {
    const currentMetrics = current[i]
      ? summarizePeriod({
          ...rowsForDays(index, current[i]!.dayKeys),
          focus: "all",
          displayUnit: history.displayUnit,
        })
      : emptyMetrics();
    const baselineMetrics = baseline[i]
      ? summarizePeriod({
          ...rowsForDays(index, baseline[i]!.dayKeys),
          focus: "all",
          displayUnit: history.displayUnit,
        })
      : emptyMetrics();
    const bucket = current[i] ?? baseline[i]!;
    points.push({
      label: bucket.label,
      detail: bucket.detail,
      amateur: currentMetrics.sparring.amateur,
      pro: currentMetrics.sparring.pro,
      unspecified: currentMetrics.sparring.unspecified,
      baseline: baselineMetrics.sparring.total,
    });
  }
  return points;
}

function hasNumber(current: number, baseline: number) {
  return current !== 0 || baseline !== 0;
}

export function metricCards(
  current: PeriodMetrics,
  baseline: PeriodMetrics,
  focus: ReportFocus,
  unit: LoadUnit,
): MetricCard[] {
  const cards: MetricCard[] = [];
  const add = (card: MetricCard) => {
    if (!hasNumber(card.current, card.baseline)) return;
    cards.push(card);
  };
  add({
    id: "sessions",
    label: "Sessions",
    value: String(current.sessions),
    current: current.sessions,
    baseline: baseline.sessions,
    mode: "count",
  });
  add({
    id: "time",
    label: "Training time",
    value: formatTrainingTime(current.trainingSeconds),
    current: current.trainingSeconds,
    baseline: baseline.trainingSeconds,
    mode: "percent",
    hint: focus === "bike" ? "Inferred from logged assault-bike sets. There is no separate bike log." : undefined,
  });
  if (focus !== "bike") {
    add({
      id: "sets",
      label: "Sets",
      value: String(current.sets),
      current: current.sets,
      baseline: baseline.sets,
      mode: "count",
    });
    add({
      id: "volume",
      label: "Volume",
      value: formatTelemetryNumber(current.volume),
      current: current.volume,
      baseline: baseline.volume,
      mode: "percent",
      hint: unit === "kg" ? "kg" : "lb",
    });
  }
  if (focus === "all") {
    add({
      id: "rounds",
      label: "Rounds",
      value: String(current.rounds.total),
      current: current.rounds.total,
      baseline: baseline.rounds.total,
      mode: "count",
    });
    const roundLabels: Record<RoundKind, string> = {
      bag: "Bag rounds",
      pads: "Pad rounds",
      sparring: "Sparring rounds",
      grappling: "Grappling rounds",
    };
    for (const kind of ROUND_KINDS) {
      add({
        id: `rounds-${kind}`,
        label: roundLabels[kind],
        value: String(current.rounds[kind]),
        current: current.rounds[kind],
        baseline: baseline.rounds[kind],
        mode: "count",
      });
    }
  }
  if (focus === "all") {
    add({
      id: "bike",
      label: "Assault bike",
      value: formatTrainingTime(current.bikeSeconds),
      current: current.bikeSeconds,
      baseline: baseline.bikeSeconds,
      mode: "percent",
      hint: "Inferred from logged assault-bike sets. There is no separate bike log.",
    });
  }
  if (current.difficultyCount > 0 || baseline.difficultyCount > 0) {
    add({
      id: "difficulty",
      label: "Difficulty",
      value: current.difficultyAverage == null ? "—" : `${current.difficultyAverage} · ${current.difficultyLabel}`,
      current: current.difficultyAverage ?? 0,
      baseline: baseline.difficultyAverage ?? 0,
      mode: "count",
      places: 1,
      hint: "Session rating you picked. Higher means the work felt harder.",
      comparable: current.difficultyCount > 0 && baseline.difficultyCount > 0,
    });
  }
  if (current.sessionRpeCount > 0 || baseline.sessionRpeCount > 0) {
    add({
      id: "rpe",
      label: "Session RPE",
      value: current.sessionRpeAverage == null ? "—" : String(current.sessionRpeAverage),
      current: current.sessionRpeAverage ?? 0,
      baseline: baseline.sessionRpeAverage ?? 0,
      mode: "count",
      places: 1,
      comparable: current.sessionRpeCount > 0 && baseline.sessionRpeCount > 0,
    });
  }
  if (focus === "all") {
    add({
      id: "streak",
      label: "Streak",
      value: String(current.streakCurrent),
      current: current.streakCurrent,
      baseline: baseline.streakCurrent,
      mode: "count",
      hint: "Scheduled training days in a row, as of the end of this period.",
    });
  }
  return cards;
}

function chartsFor(
  history: ReportHistory,
  index: ReturnType<typeof indexHistory>,
  currentBuckets: DayBucket[],
  baselineBuckets: DayBucket[],
  current: PeriodMetrics,
  baseline: PeriodMetrics,
  focus: ReportFocus,
): ChartModel[] {
  const unit = history.displayUnit;
  const specs: Array<{ id: string; title: string; description: string; unit: string; metric: ChartMetric; show: boolean }> = [];
  const either = (read: (metrics: PeriodMetrics) => number) => read(current) > 0 || read(baseline) > 0;
  if (focus === "bike") {
    specs.push({
      id: "bike",
      title: "Assault bike",
      description: "Minutes inferred from logged assault-bike sets. Easy bike and jump rope stay out. There is no separate bike log.",
      unit: "min",
      metric: "bike",
      show: either((metrics) => metrics.bikeSeconds),
    });
    specs.push({
      id: "sessions",
      title: "Bike sessions",
      description: "Sessions with assault-bike work. These logs did not store a ride time.",
      unit: "sessions",
      metric: "sessions",
      show: !either((metrics) => metrics.bikeSeconds) && either((metrics) => metrics.sessions),
    });
  } else if (focus === "lower" || focus === "upper") {
    const region = focus === "lower" ? "Lower body" : "Upper body";
    specs.push({
      id: "volume",
      title: `${region} volume`,
      description: `Reps × load for ${region.toLowerCase()} lifts.`,
      unit,
      metric: "volume",
      show: either((metrics) => metrics.volume),
    });
    specs.push({
      id: "sets",
      title: `${region} sets`,
      description: `Logged sets classified as ${region.toLowerCase()}.`,
      unit: "sets",
      metric: "sets",
      show: either((metrics) => metrics.sets),
    });
  } else {
    specs.push({
      id: "load",
      title: "Training load",
      description: "Lifting volume plus bagwork rounds × minutes × RPE. Grey is the comparison period.",
      unit: current.bagLoad > 0 || baseline.bagLoad > 0 ? "load" : unit,
      metric: "load",
      show: either((metrics) => metrics.trainingLoad),
    });
    specs.push({
      id: "rounds",
      title: "Rounds",
      description: "Bag, pads, sparring, and grappling, including outside-gym sparring logs.",
      unit: "rounds",
      metric: "rounds",
      show: either((metrics) => metrics.rounds.total),
    });
    specs.push({
      id: "bike",
      title: "Assault bike",
      description: "Minutes inferred from logged assault-bike sets. There is no separate bike log.",
      unit: "min",
      metric: "bike",
      show: either((metrics) => metrics.bikeSeconds),
    });
    specs.push({
      id: "sessions",
      title: "Sessions",
      description: "Logged sessions by day.",
      unit: "sessions",
      metric: "sessions",
      show: specs.every((spec) => !spec.show) && either((metrics) => metrics.sessions),
    });
  }
  return specs
    .filter((spec) => spec.show)
    .map((spec) => ({
      id: spec.id,
      title: spec.title,
      description: spec.description,
      unit: spec.unit,
      points: comparePoints(history, index, currentBuckets, baselineBuckets, focus, spec.metric),
    }));
}

export function sparringCards(current: PeriodMetrics, baseline: PeriodMetrics): MetricCard[] {
  const cards: MetricCard[] = [];
  const add = (card: MetricCard) => {
    if (!hasNumber(card.current, card.baseline)) return;
    cards.push(card);
  };
  add({
    id: "sparring-total",
    label: "Sparring rounds",
    value: String(current.sparring.total),
    current: current.sparring.total,
    baseline: baseline.sparring.total,
    mode: "count",
  });
  add({
    id: "sparring-amateur",
    label: "Amateur",
    value: String(current.sparring.amateur),
    current: current.sparring.amateur,
    baseline: baseline.sparring.amateur,
    mode: "count",
  });
  add({
    id: "sparring-pro",
    label: "Pro",
    value: String(current.sparring.pro),
    current: current.sparring.pro,
    baseline: baseline.sparring.pro,
    mode: "count",
  });
  add({
    id: "sparring-unspecified",
    label: "Unspecified",
    value: String(current.sparring.unspecified),
    current: current.sparring.unspecified,
    baseline: baseline.sparring.unspecified,
    mode: "count",
    hint: "In-gym rounds and sparring logs left blank. They are not counted as amateur or pro.",
  });
  if (current.sparringRatingCount > 0 || baseline.sparringRatingCount > 0) {
    add({
      id: "sparring-rating",
      label: "Sparring session rating",
      value: current.sparringRatingAverage == null ? "—" : String(current.sparringRatingAverage),
      current: current.sparringRatingAverage ?? 0,
      baseline: baseline.sparringRatingAverage ?? 0,
      mode: "count",
      places: 1,
      comparable: current.sparringRatingCount > 0 && baseline.sparringRatingCount > 0,
    });
  }
  return cards;
}

export type WeekArchiveRow = {
  weekStartKey: string;
  label: string;
  sessions: number;
  trainingLoad: number;
  trainingSeconds: number;
  rounds: number;
  delta: PeriodDelta | null;
  deltaMode: "count" | "percent";
  deltaLabel: string;
};

function archiveDelta(current: PeriodMetrics, previous: PeriodMetrics) {
  if (current.trainingLoad > 0 || previous.trainingLoad > 0) {
    return {
      delta: periodDelta(current.trainingLoad, previous.trainingLoad),
      deltaMode: "percent" as const,
      deltaLabel: "load",
    };
  }
  if (current.sessions > 0 || previous.sessions > 0) {
    return {
      delta: periodDelta(current.sessions, previous.sessions),
      deltaMode: "count" as const,
      deltaLabel: "sessions",
    };
  }
  if (current.rounds.total > 0 || previous.rounds.total > 0) {
    return {
      delta: periodDelta(current.rounds.total, previous.rounds.total),
      deltaMode: "count" as const,
      deltaLabel: "rounds",
    };
  }
  return { delta: null, deltaMode: "count" as const, deltaLabel: "" };
}

export function buildWeekArchive(history: ReportHistory): WeekArchiveRow[] {
  const index = indexHistory(history);
  const dayKeys = [
    ...index.sessionsByDay.keys(),
    ...index.outsideByDay.keys(),
  ].filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key));
  const currentKey = currentWeekKey(history.now, history.timeZone);
  const earliest = dayKeys.sort()[0];
  const earliestInstant = earliest
    ? zonedCivilToUtc(
        Number(earliest.slice(0, 4)),
        Number(earliest.slice(5, 7)),
        Number(earliest.slice(8, 10)),
        history.timeZone,
      )
    : null;
  const startKey = earliestInstant
    ? dayKey(mondayOfZoned(earliestInstant, history.timeZone), history.timeZone)
    : currentKey;
  const keys: string[] = [];
  let cursor = startKey > currentKey ? currentKey : startKey;
  while (cursor <= currentKey && keys.length < 520) {
    keys.push(cursor);
    const next = shiftWeekKey(cursor, 1, history.timeZone);
    if (!next || next === cursor) break;
    cursor = next;
  }
  const metricsByWeek = new Map<string, PeriodMetrics>();
  for (const key of keys) {
    const bounds = weekBounds(key, history.timeZone);
    metricsByWeek.set(
      key,
      bounds
        ? metricsForDays(history, index, bounds.dayKeys, "all", bounds.endExclusive)
        : emptyMetrics(),
    );
  }
  return [...keys].reverse().map((key) => {
    const metrics = metricsByWeek.get(key) ?? emptyMetrics();
    const previousKey = shiftWeekKey(key, -1, history.timeZone);
    const previous = previousKey ? metricsByWeek.get(previousKey) ?? emptyMetrics() : emptyMetrics();
    const delta = archiveDelta(metrics, previous);
    return {
      weekStartKey: key,
      label: formatWeekRange(key, history.timeZone),
      sessions: metrics.sessions,
      trainingLoad: metrics.trainingLoad,
      trainingSeconds: metrics.trainingSeconds,
      rounds: metrics.rounds.total,
      delta: delta.delta,
      deltaMode: delta.deltaMode,
      deltaLabel: delta.deltaLabel,
    };
  });
}

function earlierKeys(keys: string[], selected: string) {
  return keys.filter((key) => key < selected).sort((a, b) => (a < b ? 1 : -1));
}

export function reportHref(input: {
  kind: ReportKind;
  key: string;
  currentKey: string;
  focus: ReportFocus;
  compareKey?: string | null;
}) {
  const path =
    input.kind === "week"
      ? input.key === input.currentKey
        ? "/report"
        : `/report/${input.key}`
      : input.key === input.currentKey
        ? "/report/month"
        : `/report/month/${input.key}`;
  const params = new URLSearchParams();
  if (input.focus !== "all") params.set("focus", input.focus);
  if (input.compareKey) params.set("compare", input.compareKey);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export type PeriodReportModel = {
  kind: ReportKind;
  key: string;
  currentKey: string;
  focus: ReportFocus;
  rangeLabel: string;
  baselineLabel: string;
  baselineKey: string;
  prevHref: string | null;
  nextHref: string | null;
  weekHref: string;
  monthHref: string;
  formPath: string;
  compareValue: string;
  compareOptions: Array<{ value: string; label: string }>;
  cards: MetricCard[];
  charts: ChartModel[];
  sparring: { cards: MetricCard[]; points: SparringChartPoint[]; note: string } | null;
  quiet: boolean;
};

function activityWeekKeys(history: ReportHistory) {
  return buildWeekArchive(history).map((row) => row.weekStartKey);
}

function activityMonthKeys(history: ReportHistory) {
  const index = indexHistory(history);
  const months = new Set<string>();
  for (const key of [...index.sessionsByDay.keys(), ...index.outsideByDay.keys()]) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) months.add(key.slice(0, 7));
  }
  const current = currentMonthKey(history.now, history.timeZone);
  months.add(current);
  return [...months].filter((key) => key <= current).sort((a, b) => (a < b ? 1 : -1));
}

function firstMondayInMonth(monthKey: string, timeZone: string) {
  const days = monthDayKeys(monthKey, timeZone);
  for (const key of days) {
    if (isMondayKey(key, timeZone)) return key;
  }
  return currentWeekKey(new Date(), timeZone);
}

export function buildPeriodReport(
  history: ReportHistory,
  kind: ReportKind,
  key: string,
  requestedCompare: string | null | undefined,
  focus: ReportFocus,
): PeriodReportModel | null {
  const timeZone = history.timeZone;
  const currentKey = kind === "week" ? currentWeekKey(history.now, timeZone) : currentMonthKey(history.now, timeZone);
  if (kind === "week") {
    if (!isMondayKey(key, timeZone) || key > currentKey) return null;
  } else if (!isMonthKey(key) || key > currentKey) {
    return null;
  }
  const bounds = kind === "week" ? weekBounds(key, timeZone) : monthBounds(key, timeZone);
  if (!bounds) return null;
  const previousKey = kind === "week" ? shiftWeekKey(key, 1 * -1, timeZone) : shiftMonthKey(key, -1);
  if (!previousKey) return null;
  const known = kind === "week" ? activityWeekKeys(history) : activityMonthKeys(history);
  const options = earlierKeys(known, key);
  const compareKey = requestedCompare && options.includes(requestedCompare) ? requestedCompare : previousKey;
  const compareBounds = kind === "week" ? weekBounds(compareKey, timeZone) : monthBounds(compareKey, timeZone);
  if (!compareBounds) return null;
  const index = indexHistory(history);
  const current = metricsForDays(history, index, bounds.dayKeys, focus, bounds.endExclusive);
  const baseline = metricsForDays(history, index, compareBounds.dayKeys, focus, compareBounds.endExclusive);
  const currentBuckets = kind === "week" ? weekBuckets(key, timeZone) : monthBuckets(key, timeZone);
  const baselineBuckets = kind === "week" ? weekBuckets(compareKey, timeZone) : monthBuckets(compareKey, timeZone);
  const nextKey = kind === "week" ? shiftWeekKey(key, 1, timeZone) : shiftMonthKey(key, 1);
  const prevKey = previousKey;
  const weekTarget = kind === "week" ? key : key === currentMonthKey(history.now, timeZone) ? currentWeekKey(history.now, timeZone) : firstMondayInMonth(key, timeZone);
  const monthTarget = kind === "month" ? key : key.slice(0, 7);
  const quiet =
    current.sessions === 0 &&
    current.sparring.total === 0 &&
    baseline.sessions === 0 &&
    baseline.sparring.total === 0 &&
    current.bikeSeconds === 0 &&
    baseline.bikeSeconds === 0;
  const sparringVisible =
    focus === "all" && (current.sparring.total > 0 || baseline.sparring.total > 0);
  return {
    kind,
    key,
    currentKey,
    focus,
    rangeLabel: kind === "week" ? formatWeekRange(key, timeZone) : formatMonthLabel(key, timeZone),
    baselineLabel: kind === "week" ? formatWeekRange(compareKey, timeZone) : formatMonthLabel(compareKey, timeZone),
    baselineKey: compareKey,
    prevHref: reportHref({ kind, key: prevKey, currentKey, focus }),
    nextHref:
      nextKey && nextKey <= currentKey
        ? reportHref({ kind, key: nextKey, currentKey, focus })
        : null,
    weekHref: reportHref({
      kind: "week",
      key: weekTarget,
      currentKey: currentWeekKey(history.now, timeZone),
      focus,
    }),
    monthHref: reportHref({
      kind: "month",
      key: monthTarget,
      currentKey: currentMonthKey(history.now, timeZone),
      focus,
    }),
    formPath: reportHref({ kind, key, currentKey, focus: "all" }).split("?")[0]!,
    compareValue: compareKey,
    compareOptions: [previousKey, ...options.filter((option) => option !== previousKey)].map((option) => ({
      value: option,
      label:
        (kind === "week" ? formatWeekRange(option, timeZone) : formatMonthLabel(option, timeZone)) +
        (option === previousKey ? " · previous" : ""),
    })),
    cards: metricCards(current, baseline, focus, history.displayUnit),
    charts: chartsFor(history, index, currentBuckets, baselineBuckets, current, baseline, focus),
    sparring: sparringVisible
      ? {
          cards: sparringCards(current, baseline),
          points: sparringPoints(history, index, currentBuckets, baselineBuckets),
          note: "Amateur and pro come from the sparring log. Blank logs and in-gym round-timer rounds stay unspecified.",
        }
      : null,
    quiet,
  };
}

export async function loadReportHistory(userId: string, now = new Date()): Promise<ReportHistory> {
  const profile = await getProfileForUser(userId);
  const timeZone = await timeZoneForUser(userId, profile?.timeZone ?? null);
  const displayUnit: LoadUnit = profile?.preferredUnits === "kg" ? "kg" : "lb";
  const [sessions, outside] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { userId, status: { in: ["complete", "partial"] } },
      select: {
        id: true,
        performedAt: true,
        createdAt: true,
        updatedAt: true,
        status: true,
        title: true,
        difficultyRating: true,
        sessionRpe: true,
        backfilled: true,
        sets: {
          select: {
            exerciseName: true,
            reps: true,
            loadValue: true,
            loadUnit: true,
            logMode: true,
            durationSeconds: true,
            completed: true,
            prescriptionKey: true,
          },
        },
      },
    }),
    prisma.outsideSessionLog.findMany({
      where: { userId },
      select: {
        dateKey: true,
        rounds: true,
        minutesPerRound: true,
        sessionRating: true,
        roundType: true,
      },
    }),
  ]);
  const timers = await readTimerFieldsByIds(
    sessions.map((session) => session.id),
    prisma,
  );
  const shaped: ReportSession[] = sessions
    .map((session) => ({
      ...session,
      elapsedSeconds: timers.get(session.id)?.elapsedSeconds ?? null,
      sets: session.sets.map((set) => ({
        exerciseName: set.exerciseName,
        reps: set.reps,
        loadValue: set.loadValue,
        loadUnit: set.loadUnit,
        logMode: set.logMode,
        durationSeconds: set.durationSeconds,
        completed: set.completed,
        prescriptionKey: set.prescriptionKey,
      })),
    }))
    .filter((session) => sessionAppearsOnProgress(session));
  return {
    userId,
    timeZone,
    displayUnit,
    prefs: plannerPrefsFromProfile(profile ?? {}),
    sessions: shaped,
    outside,
    now,
  };
}

export function anchorForWeek(weekStartKey: string, timeZone: string, now: Date) {
  if (weekStartKey === currentWeekKey(now, timeZone)) return now;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekStartKey);
  if (!match) return now;
  return new Date(zonedCivilToUtc(Number(match[1]), Number(match[2]), Number(match[3]), timeZone).getTime() + 60 * 60 * 1000);
}
