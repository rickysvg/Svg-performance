import { prisma } from "@/lib/prisma";
import { getDemoProgram } from "@/lib/programs";
import { listWorkoutSessionsForUser } from "@/lib/workouts";
import { getTodayNutritionSummary, startOfLocalDay } from "@/lib/nutrition";
import { listPublishedLessons, listLessonProgressForUser } from "@/lib/lessons";

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

export async function getHomeToday(userId: string) {
  const [program, sessions, foodToday, lessons, progress, activity] = await Promise.all([
    getDemoProgram(),
    listWorkoutSessionsForUser(userId),
    getTodayNutritionSummary(userId),
    listPublishedLessons(),
    listLessonProgressForUser(userId),
    getWeeklyActivity(userId),
  ]);

  const completedDayIds = new Set(
    sessions
      .filter((session) => session.status === "complete" && session.programDayId)
      .map((session) => session.programDayId as string),
  );
  const draft = sessions.find((session) => session.status === "draft");
  const suggestedDay =
    program.days.find((day) => !completedDayIds.has(day.id)) ?? program.days[0] ?? null;

  const completedLessonIds = new Set(
    progress.filter((row) => row.completed).map((row) => row.lessonId),
  );
  const incompleteLesson =
    lessons.find((lesson) => !completedLessonIds.has(lesson.id)) ?? null;

  return {
    suggestedDay,
    draft,
    foodToday,
    foodNudge:
      foodToday.entryCount === 0
        ? "No food logged today yet. A rough estimate is enough."
        : null,
    incompleteLesson,
    activity,
  };
}
