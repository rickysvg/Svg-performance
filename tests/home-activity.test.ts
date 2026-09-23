import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { getHomeToday, getWeeklyActivity, weeklyActivityCopy } from "@/lib/home";
import { getTodayGuide } from "@/lib/today";
import { getPathProgress } from "@/lib/paths";
import { createNutritionEntryForUser } from "@/lib/nutrition";
import { startWorkoutFromDay, updateWorkoutSessionForUser } from "@/lib/workouts";
import { DEMO_PROGRAM_SLUG, getDemoProgram } from "@/lib/programs";
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
    expect(today.targets.calories).toBe(2200);
    expect(today.firstName).toBe("streak");
  });

  it("keeps Home and Today usable when the DEMO program is not seeded", async () => {
    const snapshot = await prisma.program.findUnique({
      where: { slug: DEMO_PROGRAM_SLUG },
      include: { days: { include: { exercises: true }, orderBy: { dayNumber: "asc" } } },
    });
    expect(snapshot).toBeTruthy();
    await prisma.program.delete({ where: { slug: DEMO_PROGRAM_SLUG } });
    try {
      const user = await makeUser("empty-seed-home@example.com");
      const today = await getHomeToday(user.id);
      expect(today.suggestedDay).toBeNull();
      expect(today.suggestionCopy).toMatch(/not loaded/i);
      expect(today.activity.daysActive).toBe(0);

      const path = await getPathProgress(user.id);
      expect(path.path.slug).toBeTruthy();

      const guide = await getTodayGuide(user.id);
      expect(guide.path.path.title).toBeTruthy();
      expect(guide.today.suggestedDay).toBeNull();
    } finally {
      if (snapshot) {
        await prisma.program.create({
          data: {
            slug: snapshot.slug,
            title: snapshot.title,
            description: snapshot.description,
            isDemo: snapshot.isDemo,
            days: {
              create: snapshot.days.map((day) => ({
                dayNumber: day.dayNumber,
                title: day.title,
                focus: day.focus,
                exercises: {
                  create: day.exercises
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((exercise) => ({
                      sortOrder: exercise.sortOrder,
                      name: exercise.name,
                      sets: exercise.sets,
                      reps: exercise.reps,
                      loadText: exercise.loadText,
                      restSeconds: exercise.restSeconds,
                      notes: exercise.notes,
                      formVideoUrl: exercise.formVideoUrl,
                      formVideoPending: exercise.formVideoPending,
                    })),
                },
              })),
            },
          },
        });
      }
    }
  });
});

describe("SVG Coach content pack wiring", () => {
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
