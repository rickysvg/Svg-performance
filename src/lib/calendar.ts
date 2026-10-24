import { prisma } from "@/lib/prisma";
import { sparringLogsForWeek } from "@/lib/outside-log";
import { easePlanForUser } from "@/lib/recovery-ease";
import { resolveAiCoach } from "@/lib/coaches";
import type { SparringLog } from "@/lib/outside-log";
import { finalizePastLoggedDrafts, listWorkoutSessionsForUser } from "@/lib/workouts";
import {
  prescribedSetTotal,
  loggedNameMatchesPlanned,
  offPlanSessionDone,
  setIsTicked,
  tickedSetCount,
} from "@/lib/logged-work";
import { sessionProgress } from "@/lib/session-progress";
import { namedSetRows, visibleDoseForSession, type MemberExerciseEdits } from "@/lib/finish-plan";
import { loadMemberExerciseEdits } from "@/lib/member-exercise-edits";
import { trainingBlockKey } from "@/lib/exercise-swap";
import { calendarScaleContext, withCalendarScaleMemory, type ScaledDayPlan } from "@/lib/plan-doses";
import { memberFacingTitle } from "@/lib/member-copy";
import { sessionCompletionDay } from "@/lib/performed-at";
import { shapeDayPlan } from "@/lib/fight-camp";
import { getChallengeProgressForUser } from "@/lib/challenges";
import { formatDayParam, sameLocalDay } from "@/lib/home";
import { startOfLocalDay } from "@/lib/nutrition";
import { planForDate, resolvePlanSessions } from "@/lib/week-plan";
import { sessionOpenHref } from "@/lib/timer-session";
import { listDayPlansForUser } from "@/lib/my-workouts";
import { summaryAfterDayPlans, withDayPlans } from "@/lib/my-workout-plan";
import { getWeekPlanSwapsForUser } from "@/lib/week-plan-swap-store";
import {
  APP_TIMEZONE,
  addZonedDays,
  mondayOfZoned,
  weekdayInZone,
  zonedParts,
} from "@/lib/timezone";

export { calendarPlanDoses, calendarScaledCatalog } from "@/lib/plan-doses";

export const DEFAULT_TRAINING_WEEKDAYS = ["Monday", "Wednesday", "Friday"] as const;

const JS_WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type CalendarActivityKind = "workout" | "report" | "challenge";
export type CalendarActivityStatus = "scheduled" | "complete";

/** A finished session lists the work that was logged. Unlogged plan rows stay off that card. */
export function visibleCalendarExercises<T extends { state: string }>(rows: T[], done: boolean): T[] {
  if (!done) return rows;
  return rows.filter((row) => row.state !== "open");
}

export type CalendarActivity = {
  kind: CalendarActivityKind;
  title: string;
  subtitle: string;
  href: string;
  status: CalendarActivityStatus;
  programDayId?: string;
  /** Set on workouts that can be moved within the week. */
  sessionKey?: string;
  /** Calendar weekday this card is sitting on. */
  weekday?: string;
  /** Lift, hard bag, or hard conditioning. */
  heavy?: boolean;
  /** "4 sets" or "1/4 sets". Empty when the plan has no prescribed sets. */
  setCountLabel?: string;
  /** Per-exercise tick counts when a log is matched to this card. */
  exercises?: { name: string; ticked: number; planned: number; state: "complete" | "partial" | "open" }[];
  /** A saved workout applied to this day. It is not a program session, so it cannot be moved. */
  customPlan?: boolean;
  customPlanId?: string;
};

export type CalendarDay = {
  date: Date;
  heading: string;
  isToday: boolean;
  activities: CalendarActivity[];
  sparring?: {
    dateKey: string;
    weekday: string;
    timeLabel: string;
    saved: SparringLog | null;
  } | null;
  easeNote?: string | null;
  coachCheckIn?: { name: string; image: string; message: string } | null;
  /** Same summary the day list was built from, including recovery ease and camp. */
  summary: string;
  active: boolean;
  movedFrom?: string;
  /** Set when this civil day has a saved workout applied. */
  revertKey?: string;
};

export type ProgramDaySummary = {
  id: string;
  title: string;
  dayNumber: number;
};

export function weekdayName(date: Date, timeZone = APP_TIMEZONE) {
  const weekday = weekdayInZone(date, timeZone);
  return JS_WEEKDAYS.includes(weekday) ? weekday : "Monday";
}

export function ordinalDay(n: number) {
  const mod = n % 100;
  if (mod >= 11 && mod <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function formatCalendarHeading(
  date: Date,
  now = new Date(),
  timeZone = APP_TIMEZONE,
) {
  const parts = zonedParts(date, timeZone);
  const month = date.toLocaleDateString("en-US", { month: "long", timeZone });
  const dated = `${parts.weekday}, ${month} ${ordinalDay(parts.day)}`;
  if (sameLocalDay(date, now, timeZone)) {
    return `Today · ${dated}`;
  }
  const tomorrow = addZonedDays(startOfLocalDay(now, timeZone), 1, timeZone);
  if (sameLocalDay(date, tomorrow, timeZone)) {
    return `Tomorrow · ${dated}`;
  }
  return dated;
}

export function listCalendarDates(
  now = new Date(),
  count = 8,
  timeZone = APP_TIMEZONE,
) {
  const start = startOfLocalDay(now, timeZone);
  return Array.from({ length: count }, (_, index) => addZonedDays(start, index, timeZone));
}

/** Monday through Sunday of the week that contains `anchor`. */
export function listWeekDates(anchor: Date, timeZone = APP_TIMEZONE) {
  const monday = mondayOfZoned(anchor, timeZone);
  return Array.from({ length: 7 }, (_, index) => addZonedDays(monday, index, timeZone));
}

export function resolveTrainingWeekdays(availability: string[]) {
  const allowed = new Set<string>(JS_WEEKDAYS);
  const picked = availability.filter((day) => allowed.has(day));
  return picked.length > 0 ? picked : [...DEFAULT_TRAINING_WEEKDAYS];
}

export function buildCalendarDays(input: {
  now: Date;
  programDays: ProgramDaySummary[];
  availability: string[];
  completedOnDay: Set<string>;
  startDayNumber?: number;
  startDayId?: string;
  includeReport?: boolean;
  challenge?: { title: string; complete: boolean } | null;
  dayCount?: number;
  timeZone?: string;
}): CalendarDay[] {
  const timeZone = input.timeZone ?? APP_TIMEZONE;
  const dates = listCalendarDates(input.now, input.dayCount ?? 8, timeZone);
  const trainingDays = new Set(resolveTrainingWeekdays(input.availability));
  const programDays = [...input.programDays];
  const startIndex = input.startDayId
    ? programDays.findIndex((day) => day.id === input.startDayId)
    : programDays.findIndex((day) => day.dayNumber === input.startDayNumber);
  let cursor = startIndex >= 0 ? startIndex : 0;

  const days: CalendarDay[] = dates.map((date) => ({
    date,
    heading: formatCalendarHeading(date, input.now, timeZone),
    isToday: sameLocalDay(date, input.now, timeZone),
    activities: [],
    summary: "",
    active: false,
  }));

  if (programDays.length > 0) {
    for (const day of days) {
      if (!trainingDays.has(weekdayName(day.date, timeZone))) continue;
      const program = programDays[cursor % programDays.length];
      if (!program) continue;
      cursor += 1;
      const done = input.completedOnDay.has(formatDayParam(day.date, timeZone));
      day.activities.push({
        kind: "workout",
        title: program.title,
        subtitle: done
          ? "Workout logged. Open to review or run it again."
          : "Complete your scheduled workout.",
        href: `/training/${program.id}`,
        status: done ? "complete" : "scheduled",
        programDayId: program.id,
      });
    }
  }

  if (input.includeReport !== false) {
    const sunday = days.find((day) => weekdayName(day.date, timeZone) === "Sunday");
    if (sunday) {
      sunday.activities.push({
        kind: "report",
        title: "Weekly SVG report",
        subtitle: "Automated summary — not a grade.",
        href: "/report",
        status: "scheduled",
      });
    }
  }

  if (input.challenge) {
    const saturday = days.find((day) => weekdayName(day.date, timeZone) === "Saturday");
    const target =
      saturday ?? days.find((day) => day.activities.length === 0) ?? days[days.length - 1];
    if (target) {
      target.activities.push({
        kind: "challenge",
        title: input.challenge.title,
        subtitle: "Monthly challenge — days you train or eat, not heaviest lift.",
        href: "/challenges",
        status: input.challenge.complete ? "complete" : "scheduled",
      });
    }
  }

  return days;
}

/** Planned workouts this week, counted by session rather than by calendar day. */
export function weekSessionTally(days: CalendarDay[]) {
  let done = 0;
  let partial = 0;
  let total = 0;
  for (const day of days) {
    for (const activity of day.activities) {
      if (activity.kind !== "workout") continue;
      total += 1;
      if (activity.status === "complete") done += 1;
      else if (subtitleShowsPartial(activity.subtitle)) partial += 1;
    }
  }
  return { done, partial, total };
}

type LoggedPlanSession = {
  id: string;
  title: string;
  status: string;
  programDayId: string | null;
  savedWorkoutId?: string | null;
  dayPlanId?: string | null;
  performedAt: Date;
  createdAt?: Date | null;
  plannedSetCount?: number | null;
  savedWorkout?: { name: string } | null;
  sets: {
    exerciseName?: string | null;
    completed?: boolean | null;
    reps: number | null;
    loadValue: number | null;
    durationSeconds: number | null;
  }[];
  programDay: {
    dayNumber: number;
    program: { slug: string };
    exercises?: { name?: string | null; sets?: number | null }[];
  } | null;
};

function prescribedSetCount(exercises: readonly { sets?: number | null }[] | null | undefined) {
  return prescribedSetTotal(exercises ? [...exercises] : undefined);
}

function namesOverlap(log: LoggedPlanSession, plannedNames: string[]) {
  const ticked = log.sets.filter((set) => setIsTicked(set));
  if (ticked.length === 0) return false;
  if (plannedNames.length === 0) return true;
  return plannedNames.some((planned) =>
    ticked.some((set) => loggedNameMatchesPlanned(planned, set.exerciseName ?? "")),
  );
}

function performedDayKey(session: { performedAt: Date }, timeZone: string) {
  return sessionCompletionDay(session, timeZone);
}

/** Ticked work that does not finish its own dose. A past plan card must not say Missed beside it. */
function logIsOpenPartial(
  log: LoggedPlanSession,
  planByDay: ReadonlyMap<string, ScaledDayPlan>,
  edits: MemberExerciseEdits,
  timeZone: string,
  anchor: Date | null,
) {
  if (tickedSetCount(log.sets) === 0) return false;
  if (!log.programDayId) return !offPlanSessionDone(log, 0, []);
  const plan = planByDay.get(log.programDayId);
  const exercises =
    plan?.exercises && plan.exercises.length > 0 ? plan.exercises : (log.programDay?.exercises ?? []);
  const catalog = plan && plan.dose > 0 ? plan.dose : prescribedSetCount(exercises);
  const visible = visibleDoseForSession({
    exercises,
    catalogDose: catalog,
    sessionId: log.id,
    blockKey: trainingBlockKey(log.performedAt, timeZone, anchor),
    programSlug: log.programDay?.program.slug,
    dayNumber: log.programDay?.dayNumber,
    edits,
    loggedSets: log.sets,
  });
  return !offPlanSessionDone(log, visible.dose, visible.names);
}

function titlesMatch(loggedTitle: string, plannedTitle: string) {
  const logged = memberFacingTitle(loggedTitle);
  const planned = memberFacingTitle(plannedTitle);
  return logged.length > 0 && logged === planned;
}

function idMatch(log: LoggedPlanSession, planned: { dayId?: string }) {
  return Boolean(planned.dayId && log.programDayId === planned.dayId);
}

function dayNumberMatch(
  log: LoggedPlanSession,
  planned: { dayNumber?: number; programSlug?: string },
) {
  return Boolean(
    planned.dayNumber != null &&
      planned.programSlug &&
      log.programDay?.dayNumber === planned.dayNumber &&
      log.programDay.program.slug === planned.programSlug,
  );
}

/** "Missed a workout?" counts a plan that was not done, including one replaced by other partial work. */
export function subtitleCountsAsMissed(subtitle: string) {
  return (
    subtitle.startsWith("Missed") ||
    subtitle.includes("· Missed") ||
    subtitle.startsWith("Not done — you logged ")
  );
}

function loggedInsteadName(names: readonly string[]) {
  if (names.length <= 1) return names[0] || "another workout";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/**
 * Selected-day header. A card that says Partial stays Partial on a past day.
 * "Partly logged" is only a mix of finished and unfinished workouts with no Partial card.
 */
export function calendarFocusStatusSuffix(input: {
  workouts: readonly { status: string; subtitle: string }[];
  past: boolean;
  active: boolean;
}) {
  const done = input.workouts.filter((item) => item.status === "complete").length;
  if (input.workouts.length > 0 && done === input.workouts.length) return " · Logged";
  if (input.workouts.some((item) => subtitleShowsPartial(item.subtitle))) return " · Partial";
  if (done > 0) return " · Partly logged";
  if (input.past && input.active) return " · Missed";
  return "";
}

/** A card line for one session. The chip still rolls the day up. */
export function sessionStatusLine(name: string, state: "Missed" | "Partial" | "Done") {
  return `${name} · ${state}`;
}

/**
 * Selected-day summary. Subtitles already carry the session name and Done or
 * Partial, so the header must not say them again.
 */
export function loggedSessionCardLine(item: {
  title: string;
  status: string;
  subtitle?: string | null;
}) {
  const statusWord = item.status === "complete" ? "Done" : "Partial";
  const title = item.title.trim();
  const subtitle = (item.subtitle ?? "").trim().replace(/^Logged this day\.\s*/i, "");
  if (!subtitle) return `${title} · ${statusWord}`;
  const hasStatus = subtitle.includes(statusWord);
  const hasTitle = title.length > 0 && subtitle.includes(title);
  if (hasTitle && hasStatus) return subtitle;
  if (hasStatus) return `${title} · ${subtitle}`;
  if (hasTitle) return `${subtitle} · ${statusWord}`;
  return `${title} · ${statusWord} · ${subtitle}`;
}

export function subtitleShowsPartial(subtitle: string) {
  return subtitle.startsWith("Partial") || subtitle.includes("· Partial");
}

export function subtitleShowsMissed(subtitle: string) {
  return subtitle.startsWith("Missed") || subtitle.includes("· Missed");
}

function workoutStatusName(kind: string) {
  if (kind === "strength") return "Lift";
  if (kind === "skill") return "Bag";
  if (kind === "conditioning") return "Bike";
  if (kind === "mobility") return "Mobility";
  return "Session";
}

/** A saved log belongs to this planned session even if a reseed replaced the day id. */
function logMatchesPlanned(
  log: LoggedPlanSession,
  planned: {
    dayId?: string;
    dayNumber?: number;
    programSlug?: string;
    title: string;
    day?: { exercises?: { name?: string | null }[] } | null;
  },
  plannedToday: { dayId?: string; dayNumber?: number; programSlug?: string; title: string }[],
) {
  // Start now and My Workouts keep their own card. They are not the program session.
  if (log.savedWorkoutId && !log.programDayId) return false;
  if (
    log.programDayId &&
    planned.dayId &&
    log.programDayId !== planned.dayId &&
    !dayNumberMatch(log, planned)
  ) {
    return false;
  }
  const plannedNames = (planned.day?.exercises ?? [])
    .map((exercise) => (exercise.name ?? "").trim())
    .filter((name) => name.length > 0);
  // Same program day. A 1-set save whose name is off the scaled list (a swap,
  // or a rename from calendarPlanDoses) still belongs on this card. Completion
  // uses offPlanSessionDone, so a swap that covers the dose is logged and a
  // short one stays partial. A push-up does not finish a bike.
  // The today/upcoming subtitle is only the fallback when nothing matched.
  if (idMatch(log, planned) && tickedSetCount(log.sets) > 0) return true;
  if (!namesOverlap(log, plannedNames)) return false;
  if (dayNumberMatch(log, planned)) return true;
  if (!titlesMatch(log.title, planned.title)) return false;
  const sameTitle = plannedToday.filter((row) => titlesMatch(log.title, row.title));
  if (sameTitle.length !== 1) return false;
  const owned = plannedToday.find(
    (row) => row !== planned && (idMatch(log, row) || dayNumberMatch(log, row)),
  );
  return !owned;
}

export function getCalendarSchedule(
  userId: string,
  now = new Date(),
  /** When set, the list is that Monday–Sunday, including days already past. */
  weekAnchor?: Date,
) {
  // Hold the week scale until every civil day in this list has been read.
  return withCalendarScaleMemory(() => loadCalendarSchedule(userId, now, weekAnchor));
}

async function loadCalendarSchedule(
  userId: string,
  now = new Date(),
  weekAnchor?: Date,
) {
  const [scale, swaps, account, edits] = await Promise.all([
    calendarScaleContext(userId, weekAnchor ?? now),
    getWeekPlanSwapsForUser(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
    loadMemberExerciseEdits(userId),
  ]);
  const { profile, tz, strength, skill } = scale;
  await finalizePastLoggedDrafts(userId, now, tz);
  const sessions = await listWorkoutSessionsForUser(userId);
  const challenge = await getChallengeProgressForUser(userId, tz);
  const loggedSessions = sessions.filter(
    (session) =>
      (session.status === "complete" || session.status === "partial" || session.status === "draft") &&
      tickedSetCount(session.sets) > 0,
  );
  const loggedTitles = new Map<string, string[]>();
  for (const session of loggedSessions) {
    const key = performedDayKey(session, tz);
    const titles = loggedTitles.get(key) ?? [];
    const title = session.title.trim();
    if (title && !titles.includes(title)) titles.push(title);
    loggedTitles.set(key, titles);
  }
  const linkRepairs: { id: string; programDayId: string }[] = [];
  const prefs = {
    primaryFocus: profile?.primaryFocus,
    weeklyAvailability: profile?.weeklyAvailability ?? [],
    sessionsPerWeek: profile?.sessionsPerWeek ?? null,
    trainingFocus: profile?.trainingFocus,
    liftDaysPerWeek: profile?.liftDaysPerWeek,
    experienceLevel: profile?.experienceLevel,
    email: account?.email,
    outsideTraining: profile?.outsideTraining,
    planAnchor: profile?.onboardingCompletedAt ?? null,
  };
  const sparringWeek = await sparringLogsForWeek(userId, weekAnchor ?? now, tz);
  const sparringByDay = new Map(sparringWeek.logs.map((log) => [log.dateKey, log]));
  const dates = weekAnchor ? listWeekDates(weekAnchor, tz) : listCalendarDates(now, 8, tz);
  const todayKey = formatDayParam(now, tz);
  const days: CalendarDay[] = dates.map((date) => ({
    date,
    heading: formatCalendarHeading(date, now, tz),
    isToday: sameLocalDay(date, now, tz),
    activities: [],
    summary: "",
    active: false,
  }));

  for (const day of days) {
    // Each civil day uses the dose for its own week. The default 8-day list
    // crosses a Monday, so it cannot reuse today's scale for every row.
    const dayScale = await calendarScaleContext(userId, day.date);
    const { camp, planByDay } = dayScale;
    const built = planForDate({ ...prefs, forcedWeekIndex: dayScale.campWeek }, day.date, tz, swaps);
    const shaped =
      camp && camp.phase !== "complete" && camp.phase !== "pre-camp"
        ? shapeDayPlan(built, camp.phase)
        : built;
    const eased = await easePlanForUser(userId, day.date, tz, shaped);
    const plan = eased.plan;
    day.summary = plan.summary;
    day.active = plan.active;
    day.movedFrom = plan.movedFrom;
    day.easeNote = plan.easeNote ?? null;
    day.coachCheckIn = eased.checkIn;
    const resolved = resolvePlanSessions(plan, {
      strength: dayScale.strength,
      skill: dayScale.skill,
    });
    const dayKey = formatDayParam(day.date, tz);
    const past = dayKey < todayKey;
    const loggedSummary = (loggedTitles.get(dayKey) ?? []).join(" · ");
    const dayLogs = loggedSessions.filter((session) => performedDayKey(session, tz) === dayKey);
    const matchedLogIds = new Set<string>();
    const calendarWeekday = weekdayName(day.date, tz);
    if (plan.outside?.kind === "sparring") {
      const timeLabel = plan.outside.label.replace(/^Sparring\s*·\s*/, "");
      day.sparring = {
        dateKey: dayKey,
        weekday: calendarWeekday,
        timeLabel,
        saved: sparringByDay.get(dayKey) ?? null,
      };
    }
    for (const session of resolved) {
      if (session.kind === "rest") continue;
      const matched = dayLogs.find(
        (log) => !matchedLogIds.has(log.id) && logMatchesPlanned(log, session, resolved),
      );
      if (matched) matchedLogIds.add(matched.id);
      if (matched && session.dayId && matched.programDayId !== session.dayId) {
        linkRepairs.push({ id: matched.id, programDayId: session.dayId });
        matched.programDayId = session.dayId;
      }
      const scaledPlan = session.dayId ? planByDay.get(session.dayId) : undefined;
      const scaledExercises =
        scaledPlan?.exercises && scaledPlan.exercises.length > 0
          ? scaledPlan.exercises
          : (session.day?.exercises ?? []);
      const catalogDose =
        scaledPlan && scaledPlan.dose > 0 ? scaledPlan.dose : prescribedSetCount([...scaledExercises]);
      const visible = visibleDoseForSession({
        exercises: namedSetRows(scaledExercises),
        catalogDose,
        sessionId: matched?.id ?? "",
        blockKey: trainingBlockKey(
          matched?.performedAt ?? day.date,
          tz,
          profile?.onboardingCompletedAt ?? null,
        ),
        programSlug: matched?.programDay?.program.slug ?? session.programSlug,
        dayNumber: matched?.programDay?.dayNumber ?? session.dayNumber,
        edits,
        loggedSets: matched?.sets,
      });
      const dose = visible.dose;
      const view = matched
        ? sessionProgress(matched, { dose, names: visible.names, exercises: visible.exercises })
        : null;
      const sessionDone = Boolean(view?.done);
      const ticked = view?.ticked ?? 0;
      const setCountLabel = view && ticked > 0 ? view.text : dose > 0 ? `${dose} sets` : "";
      const exerciseRows =
        view && ticked > 0 ? visibleCalendarExercises(view.rows, view.done) : [];
      const partial = Boolean(view && !view.done && ticked > 0);
      const dayHasPartialWork = dayLogs.some((log) =>
        logIsOpenPartial(log, planByDay, edits, tz, profile?.onboardingCompletedAt ?? null),
      );
      const href =
        sessionOpenHref(session, sessionDone) ??
        (session.dayId ? `/training/${session.dayId}` : undefined);
      if (!href) continue;
      const missed = past && !sessionDone && !partial && !dayHasPartialWork;
      // Other partial work must not leave this plan sounding like it is still ahead.
      const notDoneInstead = past && !sessionDone && !partial && dayHasPartialWork;
      const insteadNames = [
        ...new Set(
          dayLogs
            .filter((log) =>
              log.id !== matched?.id &&
              logIsOpenPartial(log, planByDay, edits, tz, profile?.onboardingCompletedAt ?? null),
            )
            .map((log) => memberFacingTitle(log.title).trim() || log.title.trim())
            .filter((name) => name.length > 0),
        ),
      ];
      const origin =
        session.sourceWeekday && session.sourceWeekday !== calendarWeekday
          ? session.sourceWeekday
          : plan.movedFrom;
      const statusName = workoutStatusName(session.kind);
      day.activities.push({
        kind: "workout",
        title: matched?.savedWorkout?.name?.trim() || session.title,
        subtitle: view
          ? view.done
            ? loggedSummary || view.text
            : view.text
          : missed
              ? sessionStatusLine(statusName, "Missed")
              : notDoneInstead
                ? `Not done — you logged ${loggedInsteadName(insteadNames)} instead. Tap Move to reschedule.`
                : origin
                  ? `${session.label} — ${origin}’s workout, this week.`
                  : session.label,
        href,
        status: sessionDone ? "complete" : "scheduled",
        programDayId: session.dayId,
        sessionKey: session.sessionKey,
        weekday: calendarWeekday,
        heavy: Boolean(session.heavy),
        setCountLabel,
        exercises: exerciseRows.length > 0 ? exerciseRows : undefined,
      });
    }
    for (const log of dayLogs) {
      if (matchedLogIds.has(log.id) || log.dayPlanId) continue;
      if (!log.programDayId) {
        const title = log.savedWorkout?.name?.trim() || memberFacingTitle(log.title) || log.title;
        const view = sessionProgress(log);
        day.activities.push({
          kind: "workout",
          title,
          subtitle: view.done ? sessionStatusLine(title, "Done") : view.text,
          href: `/training/log/${log.id}`,
          status: view.done ? "complete" : "scheduled",
          weekday: calendarWeekday,
          setCountLabel: view.text,
        });
        continue;
      }
      const title = log.savedWorkout?.name?.trim() || memberFacingTitle(log.title) || log.title;
      const plan = planByDay.get(log.programDayId);
      const exercises =
        plan?.exercises && plan.exercises.length > 0 ? plan.exercises : (log.programDay?.exercises ?? []);
      const catalogDose = plan && plan.dose > 0 ? plan.dose : prescribedSetCount(exercises);
      const visible = visibleDoseForSession({
        exercises,
        catalogDose,
        sessionId: log.id,
        blockKey: trainingBlockKey(log.performedAt, tz, profile?.onboardingCompletedAt ?? null),
        programSlug: log.programDay?.program.slug,
        dayNumber: log.programDay?.dayNumber,
        edits,
        loggedSets: log.sets,
      });
      const view = sessionProgress(log, {
        dose: visible.dose,
        names: visible.names,
        exercises: visible.exercises,
      });
      day.activities.push({
        kind: "workout",
        title,
        subtitle: view.done ? title : view.text,
        href: `/training/${log.programDayId}`,
        status: view.done ? "complete" : "scheduled",
        programDayId: log.programDayId,
        weekday: calendarWeekday,
        setCountLabel: view.text,
        exercises: (() => {
          if (view.ticked <= 0) return undefined;
          const rows = visibleCalendarExercises(view.rows, view.done);
          return rows.length > 0 ? rows : undefined;
        })(),
      });
    }
  }

  const sunday = days.find((day) => weekdayName(day.date, tz) === "Sunday");
  if (sunday) {
    sunday.activities.push({
      kind: "report",
      title: "Weekly SVG report",
      subtitle: "Automated summary — not a grade.",
      href: "/report",
      status: "scheduled",
    });
  }

  if (challenge?.enrollment) {
    const saturday = days.find((day) => weekdayName(day.date, tz) === "Saturday");
    const target =
      saturday ?? days.find((day) => day.activities.length === 0) ?? days[days.length - 1];
    if (target) {
      target.activities.push({
        kind: "challenge",
        title: challenge.challenge.title,
        subtitle: "Monthly challenge — days you train or eat, not heaviest lift.",
        href: "/challenges",
        status: challenge.complete ? "complete" : "scheduled",
      });
    }
  }

  const uniqueRepairs = new Map<string, string>();
  for (const repair of linkRepairs) uniqueRepairs.set(repair.id, repair.programDayId);
  await Promise.all(
    [...uniqueRepairs.entries()].map(([id, programDayId]) =>
      prisma.workoutSession.updateMany({
        where: { id, userId },
        data: { programDayId },
      }),
    ),
  );

  const applied = await listDayPlansForUser(
    userId,
    days.map((day) => formatDayParam(day.date, tz)),
  );
  const appliedByDay = new Map<string, typeof applied>();
  for (const plan of applied) {
    const list = appliedByDay.get(plan.dayKey) ?? [];
    list.push(plan);
    appliedByDay.set(plan.dayKey, list);
  }
  for (const day of days) {
    const key = formatDayParam(day.date, tz);
    const plans = appliedByDay.get(key) ?? [];
    if (plans.length === 0) continue;
    day.activities = withDayPlans(day.activities, plans);
    day.summary = summaryAfterDayPlans(day.summary, plans);
    day.revertKey = key;
  }

  const titles = [skill?.title, strength?.title].filter((title): title is string => Boolean(title));

  const coach = resolveAiCoach(profile?.aiCoachId);
  return {
    programTitle: titles.join(" · ") || null,
    days,
    coachName: coach.name,
    coachImage: coach.circle,
  };
}
