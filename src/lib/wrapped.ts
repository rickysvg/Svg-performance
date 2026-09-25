import { prisma } from "@/lib/prisma";
import { recentDifficultyAverage } from "@/lib/difficulty";
import { timeZoneForUser } from "@/lib/profile";
import {
  APP_TIMEZONE,
  addZonedDays,
  dayKey as zonedDayKey,
  startOfZonedDay,
} from "@/lib/timezone";

export type WeeklyWrapped = {
  from: Date;
  to: Date;
  daysTrained: number;
  workoutsLogged: number;
  mealsLogged: number;
  lessonsCompleted: number;
  ratedWorkouts: number;
  avgDifficulty: number | null;
  avgDifficultyLabel: string;
  copy: string;
};

export function lastSevenLocalDays(now = new Date(), timeZone = APP_TIMEZONE) {
  const to = startOfZonedDay(now, timeZone);
  const from = addZonedDays(to, -6, timeZone);
  const endExclusive = addZonedDays(to, 1, timeZone);
  return { from, to, endExclusive };
}

export function weeklyWrappedCopy(input: {
  daysTrained: number;
  workoutsLogged: number;
  mealsLogged: number;
  lessonsCompleted: number;
}) {
  const total =
    input.daysTrained + input.workoutsLogged + input.mealsLogged + input.lessonsCompleted;
  if (total === 0) {
    return "A quiet seven days. That is okay — counts stay at zero until you log something.";
  }
  return "Last seven days, counts only. No meal names. Not a report card.";
}

export async function getWeeklyWrapped(
  userId: string,
  now = new Date(),
  timeZone?: string,
): Promise<WeeklyWrapped> {
  const tz = timeZone ?? (await timeZoneForUser(userId));
  const { from, to, endExclusive } = lastSevenLocalDays(now, tz);
  const [workouts, meals, lessons] = await Promise.all([
    prisma.workoutSession.findMany({
      where: {
        userId,
        status: "complete",
        performedAt: { gte: from, lt: endExclusive },
      },
      select: { performedAt: true, difficultyRating: true },
    }),
    prisma.nutritionEntry.count({
      where: { userId, eatenAt: { gte: from, lt: endExclusive } },
    }),
    prisma.lessonProgress.count({
      where: {
        userId,
        completed: true,
        completedAt: { gte: from, lt: endExclusive },
      },
    }),
  ]);
  const trainedDays = new Set(workouts.map((row) => zonedDayKey(row.performedAt, tz)));
  const difficulty = recentDifficultyAverage(workouts, workouts.length);
  const daysTrained = trainedDays.size;
  const workoutsLogged = workouts.length;
  return {
    from,
    to,
    daysTrained,
    workoutsLogged,
    mealsLogged: meals,
    lessonsCompleted: lessons,
    ratedWorkouts: difficulty.count,
    avgDifficulty: difficulty.average,
    avgDifficultyLabel: difficulty.label,
    copy: weeklyWrappedCopy({
      daysTrained,
      workoutsLogged,
      mealsLogged: meals,
      lessonsCompleted: lessons,
    }),
  };
}
