import { findDemoProgram } from "@/lib/programs";
import { getProfileForUser } from "@/lib/profile";
import { listWorkoutSessionsForUser } from "@/lib/workouts";
import { getChallengeProgressForUser } from "@/lib/challenges";
import { suggestDemoProgramDay } from "@/lib/onboarding";
import { formatDayParam, sameLocalDay } from "@/lib/home";
import { startOfLocalDay } from "@/lib/nutrition";

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
  includeReport?: boolean;
  challenge?: { title: string; complete: boolean } | null;
  dayCount?: number;
}): CalendarDay[] {
  const dates = listCalendarDates(input.now, input.dayCount ?? 8);
  const trainingDays = new Set(resolveTrainingWeekdays(input.availability));
  const programDays = [...input.programDays].sort((a, b) => a.dayNumber - b.dayNumber);
  const startIndex = programDays.findIndex((day) => day.dayNumber === input.startDayNumber);
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
  const [program, profile, sessions, challenge] = await Promise.all([
    findDemoProgram(),
    getProfileForUser(userId),
    listWorkoutSessionsForUser(userId),
    getChallengeProgressForUser(userId),
  ]);
  const completedOnDay = new Set(
    sessions
      .filter((session) => session.status === "complete")
      .map((session) => formatDayParam(session.performedAt)),
  );
  const completedDayIds = new Set(
    sessions
      .filter((session) => session.status === "complete" && session.programDayId)
      .map((session) => session.programDayId as string),
  );
  const suggested = suggestDemoProgramDay(program?.days ?? [], completedDayIds, {
    goalKey: profile?.goalKey,
    primaryFocus: profile?.primaryFocus,
  });

  return {
    programTitle: program?.title ?? null,
    days: buildCalendarDays({
      now,
      programDays: (program?.days ?? []).map((day) => ({
        id: day.id,
        title: day.title,
        dayNumber: day.dayNumber,
      })),
      availability: profile?.weeklyAvailability ?? [],
      completedOnDay,
      startDayNumber: suggested?.dayNumber,
      includeReport: true,
      challenge: challenge?.enrollment
        ? { title: challenge.challenge.title, complete: challenge.complete }
        : null,
    }),
  };
}
