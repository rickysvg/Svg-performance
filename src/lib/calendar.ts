import { prisma } from "@/lib/prisma";
import { findDemoTrainingCatalog } from "@/lib/programs";
import { sparringLogsForWeek } from "@/lib/outside-log";
import { easePlanForUser } from "@/lib/recovery-ease";
import { resolveAiCoach } from "@/lib/coaches";
import type { SparringLog } from "@/lib/outside-log";
import { getProfileForUser } from "@/lib/profile";
import { finalizePastLoggedDrafts, listWorkoutSessionsForUser } from "@/lib/workouts";
import { sessionHasLoggedWork } from "@/lib/logged-work";
import { memberFacingTitle } from "@/lib/member-copy";
import { sessionCivilDay } from "@/lib/performed-at";
import { campPlanWeekIndex, getActiveCampSnapshot, shapeDayPlan } from "@/lib/fight-camp";
import { getChallengeProgressForUser } from "@/lib/challenges";
import { formatDayParam, sameLocalDay } from "@/lib/home";
import { startOfLocalDay } from "@/lib/nutrition";
import { planForDate, planWeekIndex, resolvePlanSessions } from "@/lib/week-plan";
import { getWeekPlanSwapsForUser } from "@/lib/week-plan-swap-store";
import { scaleDemoCatalog } from "@/lib/training-scale";
import { timeZoneForUser } from "@/lib/profile";
import {
  APP_TIMEZONE,
  addZonedDays,
  mondayOfZoned,
  weekdayInZone,
  zonedParts,
} from "@/lib/timezone";

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
  let total = 0;
  for (const day of days) {
    for (const activity of day.activities) {
      if (activity.kind !== "workout") continue;
      total += 1;
      if (activity.status === "complete") done += 1;
    }
  }
  return { done, total };
}

type LoggedPlanSession = {
  id: string;
  title: string;
  status: string;
  programDayId: string | null;
  performedAt: Date;
  createdAt?: Date | null;
  sets: { reps: number | null; loadValue: number | null; durationSeconds: number | null }[];
  programDay: { dayNumber: number; program: { slug: string } } | null;
};

function performedDayKey(
  session: { performedAt: Date; createdAt?: Date | null },
  timeZone: string,
) {
  return sessionCivilDay(session, timeZone);
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

/** A saved log belongs to this planned session even if a reseed replaced the day id. */
function logMatchesPlanned(
  log: LoggedPlanSession,
  planned: { dayId?: string; dayNumber?: number; programSlug?: string; title: string },
  plannedToday: { dayId?: string; dayNumber?: number; programSlug?: string; title: string }[],
) {
  if (idMatch(log, planned) || dayNumberMatch(log, planned)) return true;
  if (!titlesMatch(log.title, planned.title)) return false;
  const sameTitle = plannedToday.filter((row) => titlesMatch(log.title, row.title));
  if (sameTitle.length !== 1) return false;
  const owned = plannedToday.find(
    (row) => row !== planned && (idMatch(log, row) || dayNumberMatch(log, row)),
  );
  return !owned;
}

export async function getCalendarSchedule(
  userId: string,
  now = new Date(),
  /** When set, the list is that Monday–Sunday, including days already past. */
  weekAnchor?: Date,
) {
  const [catalog, profile, swaps, account] = await Promise.all([
    findDemoTrainingCatalog(),
    getProfileForUser(userId),
    getWeekPlanSwapsForUser(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);
  const tz = await timeZoneForUser(userId, profile?.timeZone ?? null);
  await finalizePastLoggedDrafts(userId, now, tz);
  const sessions = await listWorkoutSessionsForUser(userId);
  const challenge = await getChallengeProgressForUser(userId, tz);
  const camp = await getActiveCampSnapshot(userId, now, tz);
  const campWeek = campPlanWeekIndex(camp);
  const { strength, skill } = scaleDemoCatalog(catalog, {
    experienceLevel: profile?.experienceLevel,
    competitionStatus: profile?.competitionStatus,
    weightAccess: profile?.weightAccess,
    weekIndex: campWeek ?? planWeekIndex(now, tz, profile?.onboardingCompletedAt ?? null),
    campPhase: camp && camp.phase !== "complete" ? camp.phase : null,
  });
  const loggedSessions = sessions.filter(
    (session) => session.status === "complete" && sessionHasLoggedWork(session.sets),
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
    forcedWeekIndex: campWeek,
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
    const built = planForDate(prefs, day.date, tz, swaps);
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
    const resolved = resolvePlanSessions(plan, { strength, skill });
    const dayKey = formatDayParam(day.date, tz);
    const past = dayKey < todayKey;
    const loggedSummary = (loggedTitles.get(dayKey) ?? []).join(" · ");
    const dayLogs = loggedSessions.filter((session) => performedDayKey(session, tz) === dayKey);
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
      const href = session.href ?? (session.dayId ? `/training/${session.dayId}` : undefined);
      if (!href) continue;
      const matched = dayLogs.find((log) => logMatchesPlanned(log, session, resolved));
      if (matched && session.dayId && matched.programDayId !== session.dayId) {
        linkRepairs.push({ id: matched.id, programDayId: session.dayId });
        matched.programDayId = session.dayId;
      }
      const sessionDone = Boolean(matched);
      const missed = past && !sessionDone;
      const origin =
        session.sourceWeekday && session.sourceWeekday !== calendarWeekday
          ? session.sourceWeekday
          : plan.movedFrom;
      day.activities.push({
        kind: "workout",
        title: session.title,
        subtitle: sessionDone
          ? loggedSummary
            ? `Logged this day. ${loggedSummary}`
            : "Logged this day. Open to review or run a session again."
          : missed
            ? "Missed. Tap Move to do it another day."
            : origin
              ? `${session.label} — ${origin}’s workout, this week.`
              : `${session.label} — Core week plan.`,
        href,
        status: sessionDone ? "complete" : "scheduled",
        programDayId: session.dayId,
        sessionKey: session.sessionKey,
        weekday: calendarWeekday,
        heavy: Boolean(session.heavy),
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

  const titles = [skill?.title, strength?.title].filter((title): title is string => Boolean(title));

  const coach = resolveAiCoach(profile?.aiCoachId);
  return {
    programTitle: titles.join(" · ") || null,
    days,
    coachName: coach.name,
    coachImage: coach.circle,
  };
}
