import { prisma } from "@/lib/prisma";
import { findDemoTrainingCatalog } from "@/lib/programs";
import { listWorkoutSessionsForUser } from "@/lib/workouts";
import { getNutritionSummaryForDay, startOfLocalDay } from "@/lib/nutrition";
import { listPublishedLessons, listLessonProgressForUser } from "@/lib/lessons";
import { getProfileForUser, firstNameFrom, nutritionTargetsFromProfile } from "@/lib/profile";
import {
  competitionNote,
  demoSuggestionCopy,
  needsDeepOnboardingPrompt,
  preferredLearnLevel,
  preferredLearnTopic,
  sessionLengthHint,
  trainingLocationHint,
} from "@/lib/onboarding";
import { planForDate, resolvePlanSessions, weekdayInAppZone, weekStrip } from "@/lib/week-plan";

export type WeeklyActivity = {
  daysActive: number;
  totalDays: 7;
  message: string;
};

function startOfLocalWeek(now = new Date()) {
  const start = startOfLocalDay(now);
  const weekday = start.getDay(); // 0 Sunday
  start.setDate(start.getDate() - weekday);
  return start;
}

function dayKey(value: Date) {
  return `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
}

export function weeklyActivityCopy(daysActive: number): string {
  if (daysActive <= 0) {
    return "No workout or food logs this week yet. That is okay — one entry is a start when you are ready.";
  }
  if (daysActive >= 7) {
    return "You logged something on every day this week. Nice consistency.";
  }
  return `You logged a workout and/or food on ${daysActive} day${daysActive === 1 ? "" : "s"} this week.`;
}

export async function getWeeklyActivity(userId: string, now = new Date()): Promise<WeeklyActivity> {
  const weekStart = startOfLocalWeek(now);
  const [workouts, foods] = await Promise.all([
    prisma.workoutSession.findMany({
      where: {
        userId,
        status: "complete",
        performedAt: { gte: weekStart },
      },
      select: { performedAt: true },
    }),
    prisma.nutritionEntry.findMany({
      where: { userId, eatenAt: { gte: weekStart } },
      select: { eatenAt: true },
    }),
  ]);
  const days = new Set<string>();
  for (const row of workouts) days.add(dayKey(row.performedAt));
  for (const row of foods) days.add(dayKey(row.eatenAt));
  const daysActive = days.size;
  return {
    daysActive,
    totalDays: 7,
    message: weeklyActivityCopy(daysActive),
  };
}

export function parseDayParam(value: string | undefined, now = new Date()) {
  if (!value) return startOfLocalDay(now);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return startOfLocalDay(now);
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(parsed.getTime())) return startOfLocalDay(now);
  return startOfLocalDay(parsed);
}

export function mondayOf(date: Date) {
  const start = startOfLocalDay(date);
  const weekday = start.getDay(); // 0 Sunday
  const diff = weekday === 0 ? -6 : 1 - weekday;
  start.setDate(start.getDate() + diff);
  return start;
}

export function weekStripDays(selected: Date) {
  const monday = mondayOf(selected);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return day;
  });
}

export function sameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatDayParam(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export async function hasActivityOnLocalDay(userId: string, day: Date) {
  const start = startOfLocalDay(day);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const [workouts, foods] = await Promise.all([
    prisma.workoutSession.count({
      where: {
        userId,
        status: "complete",
        performedAt: { gte: start, lt: end },
      },
    }),
    prisma.nutritionEntry.count({
      where: { userId, eatenAt: { gte: start, lt: end } },
    }),
  ]);
  return workouts + foods > 0;
}

export async function homeLoad<T>(label: string, task: Promise<T>, fallback: T): Promise<T> {
  try {
    return await task;
  } catch (error) {
    console.error(`[home] ${label} failed`, error);
    return fallback;
  }
}

export function emptyHomeToday(selectedDay = new Date()) {
  const selected = startOfLocalDay(selectedDay);
  return {
    selected,
    isToday: sameLocalDay(selected, new Date()),
    suggestedDay: null,
    plannedSessions: [] as ReturnType<typeof resolvePlanSessions>,
    weekStrip: [] as ReturnType<typeof weekStrip>,
    planWeekday: weekdayInAppZone(selected),
    planSummary: "",
    suggestionCopy:
      "DEMO training days are not loaded on this preview yet. Your account and logs still work.",
    draft: undefined,
    loggedOnSelected: null,
    foodToday: { entryCount: 0, calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    foodNudge: "No food logged this day yet. A rough estimate is enough.",
    incompleteLesson: null,
    activity: {
      daysActive: 0,
      totalDays: 7 as const,
      message: weeklyActivityCopy(0),
    },
    targets: nutritionTargetsFromProfile(null),
    firstName: "",
    goals: "",
    sessions: [] as Awaited<ReturnType<typeof listWorkoutSessionsForUser>>,
    needsDeepPrompt: false,
    sessionHint: "",
    locationHint: "",
    competitionNote: "",
  };
}

export async function getHomeToday(userId: string, selectedDay = new Date()) {
  const selected = startOfLocalDay(selectedDay);
  const [catalog, sessions, foodToday, allLessons, progress, activity, profile] =
    await Promise.all([
      findDemoTrainingCatalog(),
      listWorkoutSessionsForUser(userId),
      getNutritionSummaryForDay(userId, selected),
      listPublishedLessons(),
      listLessonProgressForUser(userId),
      getWeeklyActivity(userId),
      getProfileForUser(userId),
    ]);
  const { strength, skill } = catalog;
  const hasCatalog = Boolean(strength || skill);

  const draft = sessions.find((session) => session.status === "draft");
  const prefs = {
    primaryFocus: profile?.primaryFocus,
    weeklyAvailability: profile?.weeklyAvailability ?? [],
    sessionsPerWeek: profile?.sessionsPerWeek ?? null,
  };
  const todayPlan = planForDate(prefs, selected);
  const plannedSessions = resolvePlanSessions(todayPlan, { strength, skill });
  const suggestedDay =
    plannedSessions.find((session) => session.day)?.day ??
    plannedSessions[0]?.day ??
    null;
  const loggedOnSelected = sessions.find(
    (session) =>
      session.status === "complete" && sameLocalDay(session.performedAt, selected),
  );

  const completedLessonIds = new Set(
    progress.filter((row) => row.completed).map((row) => row.lessonId),
  );
  const preferredLevel = preferredLearnLevel(profile);
  const preferredTopic = preferredLearnTopic(profile);
  const matchedLessons = allLessons.filter((lesson) => {
    const levelOk = lesson.skillLevel === preferredLevel;
    const topicOk = !preferredTopic || lesson.topic === preferredTopic;
    return levelOk && topicOk;
  });
  const fallbackLessons = allLessons.filter((lesson) => lesson.skillLevel === "beginner");
  const lessonPool = matchedLessons.length > 0 ? matchedLessons : fallbackLessons;
  const incompleteLesson =
    lessonPool.find((lesson) => !completedLessonIds.has(lesson.id)) ??
    allLessons.find((lesson) => !completedLessonIds.has(lesson.id)) ??
    null;

  return {
    selected,
    isToday: sameLocalDay(selected, new Date()),
    suggestedDay,
    plannedSessions,
    weekStrip: weekStrip(prefs, selected),
    planWeekday: todayPlan.weekday,
    planSummary: todayPlan.active ? todayPlan.summary : "Rest / skip",
    suggestionCopy: hasCatalog
      ? demoSuggestionCopy({
          goalKey: profile?.goalKey,
          primaryFocus: profile?.primaryFocus,
        })
      : "DEMO training days are not loaded on this preview yet. Your account and logs still work.",
    draft: sameLocalDay(selected, new Date()) ? draft : undefined,
    loggedOnSelected: loggedOnSelected ?? null,
    foodToday,
    foodNudge:
      foodToday.entryCount === 0
        ? "No food logged this day yet. A rough estimate is enough."
        : null,
    incompleteLesson,
    activity,
    targets: nutritionTargetsFromProfile(profile),
    firstName: firstNameFrom(profile?.displayName ?? ""),
    goals: profile?.goals ?? "",
    sessions,
    needsDeepPrompt: needsDeepOnboardingPrompt(profile),
    sessionHint: sessionLengthHint(profile?.sessionLengthMin ?? null),
    locationHint: trainingLocationHint(profile?.trainingLocation ?? ""),
    competitionNote: competitionNote(
      profile?.competitionStatus ?? "",
      profile?.nextFightDate ?? null,
    ),
  };
}
