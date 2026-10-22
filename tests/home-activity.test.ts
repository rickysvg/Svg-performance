import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { getHomeToday, getWeeklyActivity, hasActivityOnLocalDay, weeklyActivityCopy } from "@/lib/home";
import { getTodayGuide } from "@/lib/today";
import { getPathProgress } from "@/lib/paths";
import { createNutritionEntryForUser } from "@/lib/nutrition";
import {
  completedProgramDayIdsOnDay,
  startWorkoutFromDay,
  updateWorkoutSessionForUser,
} from "@/lib/workouts";
import { APP_TIMEZONE } from "@/lib/timezone";
import { DEMO_PROGRAM_SLUG, DEMO_SKILL_PROGRAM_SLUG, getDemoProgram } from "@/lib/programs";
import { listRuntimeKnowledgeFiles, loadKnowledgeBase } from "@/lib/coach/knowledge";

describe("home aggregation and weekly activity", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("uses Sunday for cardio on an open week", async () => {
    const user = await makeUser("rest-sunday@example.com");
    const sunday = new Date(2026, 8, 27, 10, 0, 0);
    const today = await getHomeToday(user.id, sunday);
    expect(today.planSummary).toMatch(/Cardio/i);
    expect(today.plannedSessions.some((session) => session.kind === "conditioning")).toBe(true);
    expect(today.plannedSessions.some((session) => session.kind === "skill")).toBe(false);
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

  it("does not mark the selected day done for a one-set or partial log", async () => {
    const user = await makeUser("partial-home@example.com");
    const program = await getDemoProgram();
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: program.days[0].id,
      preferredUnits: "lb",
    });
    expect(session.plannedSetCount).toBeGreaterThan(1);
    const now = new Date();
    const one = session.sets[0];
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: session.title,
      performedAt: now,
      notes: "",
      status: "complete",
      sets: [
        {
          exerciseName: one?.exerciseName || "Goblet squat",
          setNumber: one?.setNumber || 1,
          reps: 8,
          loadValue: 30,
          loadUnit: "lb",
          completed: true,
        },
      ],
    });
    const partialSave = await getHomeToday(user.id, now);
    expect(partialSave.loggedOnSelected).toBeNull();
    expect(partialSave.resumeByDay[program.days[0].id]).toMatchObject({
      id: session.id,
      partial: true,
    });
    expect(
      await completedProgramDayIdsOnDay(user.id, [program.days[0].id], now, APP_TIMEZONE),
    ).toEqual([]);

    await prisma.workoutSession.update({
      where: { id: session.id },
      data: { status: "partial" },
    });
    const markedPartial = await getHomeToday(user.id, now);
    expect(markedPartial.loggedOnSelected).toBeNull();

    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: session.title,
      performedAt: now,
      notes: "",
      status: "complete",
      sets: session.sets.map((set) => ({
        exerciseName: set.exerciseName,
        setNumber: set.setNumber,
        reps: set.logMode === "timed" || set.logMode === "timed_round" ? null : 8,
        loadValue:
          set.logMode === "reps_only" || set.logMode === "timed" || set.logMode === "timed_round"
            ? null
            : 40,
        loadUnit: "lb" as const,
        durationSeconds:
          set.logMode === "timed" || set.logMode === "timed_round" || set.logMode === "load_timed"
            ? 60
            : null,
        completed: true,
      })),
    });
    const finished = await getHomeToday(user.id, now);
    expect(finished.loggedOnSelected?.id).toBe(session.id);
  });

  it("does not count a one-set save as a day of activity", async () => {
    const user = await makeUser("partial-week@example.com");
    const program = await getDemoProgram();
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: program.days[0].id,
      preferredUnits: "lb",
    });
    expect(session.plannedSetCount).toBeGreaterThan(1);
    const now = new Date();
    const one = session.sets[0];
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: session.title,
      performedAt: now,
      notes: "",
      status: "complete",
      sets: [
        {
          exerciseName: one?.exerciseName || "Goblet squat",
          setNumber: one?.setNumber || 1,
          reps: 8,
          loadValue: 30,
          loadUnit: "lb",
          completed: true,
        },
      ],
    });
    await prisma.workoutSession.update({
      where: { id: session.id },
      data: { plannedSetCount: null },
    });
    const quiet = await getWeeklyActivity(user.id, now);
    expect(quiet.daysActive).toBe(0);
    expect(await hasActivityOnLocalDay(user.id, now, APP_TIMEZONE)).toBe(false);

    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: session.title,
      performedAt: now,
      notes: "",
      status: "complete",
      sets: session.sets.map((set) => ({
        exerciseName: set.exerciseName,
        setNumber: set.setNumber,
        reps: set.logMode === "timed" || set.logMode === "timed_round" ? null : 8,
        loadValue:
          set.logMode === "reps_only" || set.logMode === "timed" || set.logMode === "timed_round"
            ? null
            : 40,
        loadUnit: "lb" as const,
        durationSeconds:
          set.logMode === "timed" || set.logMode === "timed_round" || set.logMode === "load_timed"
            ? 60
            : null,
        completed: true,
      })),
    });
    await prisma.workoutSession.update({
      where: { id: session.id },
      data: { plannedSetCount: session.plannedSetCount },
    });
    const active = await getWeeklyActivity(user.id, now);
    expect(active.daysActive).toBe(1);
    expect(await hasActivityOnLocalDay(user.id, now, APP_TIMEZONE)).toBe(true);
  });

  it("keeps Home and Today usable when the DEMO program is not seeded", async () => {
    const include = {
      days: { include: { exercises: true }, orderBy: { dayNumber: "asc" as const } },
    };
    const snapshots = await Promise.all([
      prisma.program.findUnique({ where: { slug: DEMO_PROGRAM_SLUG }, include }),
      prisma.program.findUnique({ where: { slug: DEMO_SKILL_PROGRAM_SLUG }, include }),
    ]);
    expect(snapshots[0]).toBeTruthy();
    await prisma.program.deleteMany({
      where: { slug: { in: [DEMO_PROGRAM_SLUG, DEMO_SKILL_PROGRAM_SLUG] } },
    });
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
      for (const snapshot of snapshots) {
        if (!snapshot) continue;
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
