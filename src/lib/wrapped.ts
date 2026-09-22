import { prisma } from "@/lib/prisma";
import { startOfLocalDay } from "@/lib/nutrition";
import { recentDifficultyAverage } from "@/lib/difficulty";

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

function dayKey(value: Date) {
  return `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
}

export function lastSevenLocalDays(now = new Date()) {
  const to = startOfLocalDay(now);
  const from = startOfLocalDay(now);
  from.setDate(from.getDate() - 6);
  const end = startOfLocalDay(now);
  end.setDate(end.getDate() + 1);
  return { from, to, endExclusive: end };
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

export async function getWeeklyWrapped(userId: string, now = new Date()): Promise<WeeklyWrapped> {
  const { from, to, endExclusive } = lastSevenLocalDays(now);
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
  const trainedDays = new Set(workouts.map((row) => dayKey(row.performedAt)));
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
