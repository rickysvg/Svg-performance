import { findDemoTrainingCatalog } from "@/lib/programs";
import { getProfileForUser } from "@/lib/profile";
import { listWorkoutSessionsForUser } from "@/lib/workouts";
import { getChallengeProgressForUser } from "@/lib/challenges";
import { formatDayParam, sameLocalDay } from "@/lib/home";
import { startOfLocalDay } from "@/lib/nutrition";
import { planForDate, resolvePlanSessions } from "@/lib/week-plan";
import { scaleDemoCatalog } from "@/lib/training-scale";

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
};

export type CalendarDay = {
  date: Date;
  heading: string;
  isToday: boolean;
  activities: CalendarActivity[];
};

export type ProgramDaySummary = {
  id: string;
  title: string;
  dayNumber: number;
};

export function weekdayName(date: Date) {
  return JS_WEEKDAYS[date.getDay()] ?? "Monday";
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

export function formatCalendarHeading(date: Date, now = new Date()) {
  const month = date.toLocaleDateString("en-US", { month: "long" });
  const day = ordinalDay(date.getDate());
  if (sameLocalDay(date, now)) {
    return `Today, ${month} ${day}`;
  }
  const tomorrow = startOfLocalDay(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (sameLocalDay(date, tomorrow)) {
    return `Tomorrow, ${month} ${day}`;
  }
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  return `${weekday}, ${month} ${day}`;
}

export function listCalendarDates(now = new Date(), count = 8) {
  const start = startOfLocalDay(now);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
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
}): CalendarDay[] {
  const dates = listCalendarDates(input.now, input.dayCount ?? 8);
  const trainingDays = new Set(resolveTrainingWeekdays(input.availability));
  const programDays = [...input.programDays];
  const startIndex = input.startDayId
    ? programDays.findIndex((day) => day.id === input.startDayId)
    : programDays.findIndex((day) => day.dayNumber === input.startDayNumber);
  let cursor = startIndex >= 0 ? startIndex : 0;

  const days: CalendarDay[] = dates.map((date) => ({
    date,
    heading: formatCalendarHeading(date, input.now),
    isToday: sameLocalDay(date, input.now),
    activities: [],
  }));

  if (programDays.length > 0) {
    for (const day of days) {
      if (!trainingDays.has(weekdayName(day.date))) continue;
      const program = programDays[cursor % programDays.length];
      if (!program) continue;
      cursor += 1;
      const done = input.completedOnDay.has(formatDayParam(day.date));
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
    const sunday = days.find((day) => weekdayName(day.date) === "Sunday");
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
    const saturday = days.find((day) => weekdayName(day.date) === "Saturday");
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

export async function getCalendarSchedule(userId: string, now = new Date()) {
  const [catalog, profile, sessions, challenge] = await Promise.all([
    findDemoTrainingCatalog(),
    getProfileForUser(userId),
    listWorkoutSessionsForUser(userId),
    getChallengeProgressForUser(userId),
  ]);
  const { strength, skill } = scaleDemoCatalog(catalog, {
    experienceLevel: profile?.experienceLevel,
    competitionStatus: profile?.competitionStatus,
  });
  const completedOnDay = new Set(
    sessions
      .filter((session) => session.status === "complete")
      .map((session) => formatDayParam(session.performedAt)),
  );
  const prefs = {
    primaryFocus: profile?.primaryFocus,
    weeklyAvailability: profile?.weeklyAvailability ?? [],
    sessionsPerWeek: profile?.sessionsPerWeek ?? null,
  };
  const dates = listCalendarDates(now, 8);
  const days: CalendarDay[] = dates.map((date) => ({
    date,
    heading: formatCalendarHeading(date, now),
    isToday: sameLocalDay(date, now),
    activities: [],
  }));

  for (const day of days) {
    const plan = planForDate(prefs, day.date);
    const resolved = resolvePlanSessions(plan, { strength, skill });
    const done = completedOnDay.has(formatDayParam(day.date));
    for (const session of resolved) {
      if (!session.href || !session.dayId) continue;
      day.activities.push({
        kind: "workout",
        title: session.title,
        subtitle: done
          ? "Logged this day. Open to review or run a session again."
          : `${session.label} — Core week plan (DEMO).`,
        href: session.href,
        status: done ? "complete" : "scheduled",
        programDayId: session.dayId,
      });
    }
  }

  const sunday = days.find((day) => weekdayName(day.date) === "Sunday");
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
    const saturday = days.find((day) => weekdayName(day.date) === "Saturday");
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

  const titles = [skill?.title, strength?.title].filter((title): title is string => Boolean(title));

  return {
    programTitle: titles.join(" · ") || null,
    days,
  };
}
