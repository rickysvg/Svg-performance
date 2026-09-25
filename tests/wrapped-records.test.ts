import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { createNutritionEntryForUser } from "@/lib/nutrition";
import { startWorkoutFromDay, updateWorkoutSessionForUser } from "@/lib/workouts";
import { toggleLessonComplete, listPublishedLessons } from "@/lib/lessons";
import { getDemoProgram } from "@/lib/programs";
import { getWeeklyWrapped, weeklyWrappedCopy } from "@/lib/wrapped";
import {
  buildPersonalRecords,
  currentConsecutiveDays,
  longestConsecutiveDays,
  uniqueActiveDayKeys,
} from "@/lib/records";
import { rateWorkoutSessionForUser } from "@/lib/workouts";

async function logWorkout(
  userId: string,
  performedAt: Date,
  loadValue = 40,
  exerciseName = "Goblet squat",
) {
  const program = await getDemoProgram();
  const session = await startWorkoutFromDay({
    userId,
    programDayId: program.days[0].id,
    preferredUnits: "lb",
  });
  return updateWorkoutSessionForUser({
    userId,
    workoutId: session.id,
    title: session.title,
    performedAt,
    notes: "",
    status: "complete",
    sets: [
      {
        exerciseName,
        setNumber: 1,
        reps: 8,
        loadValue,
        loadUnit: "lb",
        completed: true,
      },
    ],
  });
}

describe("weekly wrapped and personal records", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("uses no-shame copy for a quiet week", () => {
    const copy = weeklyWrappedCopy({
      daysTrained: 0,
      workoutsLogged: 0,
      mealsLogged: 0,
      lessonsCompleted: 0,
    });
    expect(copy).toMatch(/okay|quiet/i);
    expect(copy).not.toMatch(/fail|lazy|behind|shame|slacking/i);
  });

  it("summarizes last 7 days with counts only — no food names", async () => {
    const user = await makeUser("wrap@example.com");
    const now = new Date("2026-09-22T15:00:00");
    const workout = await logWorkout(user.id, now, 50);
    await rateWorkoutSessionForUser({
      userId: user.id,
      workoutId: workout.id,
      difficultyRating: "hard",
    });
    await createNutritionEntryForUser(user.id, {
      name: "Secret burrito",
      mealType: "lunch",
      servings: 1,
      servingLabel: "each",
      calories: 700,
      proteinG: 30,
      carbsG: 70,
      fatG: 25,
      eatenAt: now,
    });
    const lessons = await listPublishedLessons();
    expect(lessons[0]).toBeTruthy();
    await toggleLessonComplete(user.id, lessons[0]!.id);
    await prisma.lessonProgress.updateMany({
      where: { userId: user.id, lessonId: lessons[0]!.id },
      data: { completedAt: now },
    });

    const wrap = await getWeeklyWrapped(user.id, now);
    expect(wrap.daysTrained).toBe(1);
    expect(wrap.workoutsLogged).toBe(1);
    expect(wrap.mealsLogged).toBe(1);
    expect(wrap.lessonsCompleted).toBe(1);
    expect(wrap.avgDifficultyLabel).toBe("Hard");
    expect(JSON.stringify(wrap)).not.toMatch(/Secret burrito/i);
    expect(wrap.copy).toMatch(/counts only/i);
  });

  it("ignores logs older than 7 days in the wrap", async () => {
    const user = await makeUser("old-wrap@example.com");
    const now = new Date("2026-09-22T12:00:00");
    const stale = new Date("2026-09-10T12:00:00");
    await logWorkout(user.id, stale);
    await createNutritionEntryForUser(user.id, {
      name: "Old oats",
      mealType: "breakfast",
      servings: 1,
      servingLabel: "bowl",
      calories: 300,
      proteinG: 10,
      carbsG: 40,
      fatG: 8,
      eatenAt: stale,
    });
    const wrap = await getWeeklyWrapped(user.id, now);
    expect(wrap.daysTrained).toBe(0);
    expect(wrap.workoutsLogged).toBe(0);
    expect(wrap.mealsLogged).toBe(0);
  });

  it("returns an empty PR board when nothing is logged", () => {
    const records = buildPersonalRecords({
      sessions: [],
      activityDates: [],
      displayUnit: "lb",
    });
    expect(records.empty).toBe(true);
    expect(records.loadRecords).toEqual([]);
    expect(records.longestActiveStreak).toBe(0);
  });

  it("recalculates heaviest load per exercise and days-active streak from existing logs", async () => {
    const user = await makeUser("prs@example.com");
    const day1 = new Date("2026-09-20T12:00:00");
    const day2 = new Date("2026-09-21T12:00:00");
    const day3 = new Date("2026-09-22T12:00:00");
    await logWorkout(user.id, day1, 30, "Goblet squat");
    await logWorkout(user.id, day2, 55, "Goblet squat");
    await createNutritionEntryForUser(user.id, {
      name: "Eggs",
      mealType: "breakfast",
      servings: 1,
      servingLabel: "plate",
      calories: 200,
      proteinG: 18,
      carbsG: 2,
      fatG: 12,
      eatenAt: day3,
    });

    const sessions = await prisma.workoutSession.findMany({
      where: { userId: user.id },
      include: { sets: true },
    });
    const foods = await prisma.nutritionEntry.findMany({
      where: { userId: user.id },
      select: { eatenAt: true },
    });
    const records = buildPersonalRecords({
      sessions,
      activityDates: [
        ...sessions.map((row) => row.performedAt),
        ...foods.map((row) => row.eatenAt),
      ],
      displayUnit: "lb",
      now: day3,
    });
    expect(records.empty).toBe(false);
    const squat = records.loadRecords.find((row) => row.exerciseName === "Goblet squat");
    expect(squat?.bestLoad).toBe(55);
    expect(records.longestActiveStreak).toBe(3);
    expect(records.currentActiveStreak).toBe(3);
    expect(JSON.stringify(records)).not.toMatch(/Eggs/i);
  });

  it("counts consecutive local days for streaks", () => {
    const keys = uniqueActiveDayKeys([
      new Date(2026, 8, 20, 12),
      new Date(2026, 8, 21, 12),
      new Date(2026, 8, 23, 12),
    ]);
    expect(longestConsecutiveDays(keys)).toBe(2);
    expect(currentConsecutiveDays(keys, new Date(2026, 8, 23, 12))).toBe(1);
    expect(currentConsecutiveDays(keys, new Date(2026, 8, 24, 12))).toBe(0);
  });
});
