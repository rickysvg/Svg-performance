import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { getHomeToday, getWeeklyActivity, weeklyActivityCopy } from "@/lib/home";
import { createNutritionEntryForUser } from "@/lib/nutrition";
import { startWorkoutFromDay, updateWorkoutSessionForUser } from "@/lib/workouts";
import { getDemoProgram } from "@/lib/programs";
import { listRuntimeKnowledgeFiles, loadKnowledgeBase } from "@/lib/coach/knowledge";

describe("home aggregation and weekly activity", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("uses no-shame copy for zero, some, and seven days", () => {
    expect(weeklyActivityCopy(0)).toMatch(/okay/i);
    expect(weeklyActivityCopy(0)).not.toMatch(/fail|lazy|behind|broken streak/i);
    expect(weeklyActivityCopy(2)).toMatch(/2 days/i);
    expect(weeklyActivityCopy(7)).toMatch(/every day/i);
  });

  it("counts unique days with a workout or food log this week", async () => {
    const user = await makeUser("streak@example.com");
    const program = await getDemoProgram();
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: program.days[0].id,
      preferredUnits: "lb",
    });
    const now = new Date();
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: session.title,
      performedAt: now,
      notes: "",
      status: "complete",
      sets: [
        {
          exerciseName: "Goblet squat",
          setNumber: 1,
          reps: 8,
          loadValue: 30,
          loadUnit: "lb",
          completed: true,
        },
      ],
    });
    await createNutritionEntryForUser(user.id, {
      name: "Yogurt",
      mealType: "snack",
      servings: 1,
      servingLabel: "cup",
      calories: 130,
      proteinG: 20,
      carbsG: 8,
      fatG: 0,
      eatenAt: now,
    });
    const activity = await getWeeklyActivity(user.id, now);
    expect(activity.daysActive).toBe(1);

    const today = await getHomeToday(user.id);
    expect(today.suggestedDay).toBeTruthy();
    expect(today.foodNudge).toBeNull();
    expect(today.incompleteLesson).toBeTruthy();
  });
});

describe("Coach Savage content pack wiring", () => {
  it("loads the guide and DEMO seeds, not the interview worksheet", () => {
    const files = listRuntimeKnowledgeFiles();
    expect(files).toContain("COACHING_GUIDE.md");
    expect(files).toContain("DEMO-seeds.md");
    expect(files).not.toContain("INTERVIEW.md");
    expect(files[0]).toBe("COACHING_GUIDE.md");
    const kb = loadKnowledgeBase();
    expect(kb).toMatch(/DEMO — Missed class/);
    expect(kb).not.toMatch(/Target: 30–50 questions/);
  });
});
