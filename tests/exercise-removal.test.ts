import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { DEMO_PROGRAM_SLUG, getDemoProgram } from "@/lib/programs";
import { loggerCursor } from "@/lib/logger-progress";
import {
  hiddenNamesForRemovals,
  omitRemovedSlots,
  restoreSnapshotSets,
  snapshotRemovedSets,
  visibleExerciseCount,
  withoutExerciseName,
} from "@/lib/exercise-removal";
import { removeSessionExercise, undoExerciseRemoval } from "@/lib/exercise-removal-store";
import { trainingBlockKey } from "@/lib/exercise-swap";
import { scaleProgramDay } from "@/lib/training-scale";
import { startWorkoutFromDay } from "@/lib/workouts";
import { APP_TIMEZONE } from "@/lib/timezone";

const blockKey = trainingBlockKey(new Date(), APP_TIMEZONE);

describe("exercise removal", () => {
  it("drops one slot and the logger counts that follow it", () => {
    const programmed = [
      { name: "Goblet squat", sets: 4 },
      { name: "One-arm row", sets: 3 },
      { name: "Face pull", sets: 3 },
    ];
    const omitted = omitRemovedSlots(
      programmed,
      programmed,
      [{ originalName: "One-arm row", exerciseName: "One-arm row", workoutSessionId: "s1" }],
      { sessionId: "s1" },
    );
    expect(omitted.shown.map((row) => row.name)).toEqual(["Goblet squat", "Face pull"]);
    expect(omitted.programmed.map((row) => row.name)).toEqual(["Goblet squat", "Face pull"]);

    const sets = [
      { exerciseName: "Goblet squat", setNumber: 1 },
      { exerciseName: "Goblet squat", setNumber: 2 },
      { exerciseName: "One-arm row", setNumber: 1 },
      { exerciseName: "Face pull", setNumber: 1 },
    ];
    const kept = withoutExerciseName(sets, "One-arm row");
    expect(visibleExerciseCount(omitted.shown, kept)).toBe(2);
    const groups = [
      { name: "Goblet squat", sets: [{ id: "a", completed: true }, { id: "b", completed: false }] },
      { name: "One-arm row", sets: [{ id: "c", completed: false }] },
      { name: "Face pull", sets: [{ id: "d", completed: false }, { id: "e", completed: false }, { id: "f", completed: false }] },
    ];
    expect(loggerCursor(groups)).toMatchObject({
      exerciseIndex: 1,
      exerciseCount: 3,
      exerciseName: "Goblet squat",
      setIndex: 2,
      setCount: 2,
    });
    const after = groups.filter((group) => group.name !== "One-arm row");
    expect(loggerCursor(after)).toMatchObject({
      exerciseIndex: 1,
      exerciseCount: 2,
      exerciseName: "Goblet squat",
      setIndex: 2,
      setCount: 2,
    });
    expect(hiddenNamesForRemovals(
      [{ originalName: "One-arm row", exerciseName: "One-arm row", workoutSessionId: "s1" }],
      after.map((group) => group.name),
    )).toEqual(["One-arm row"]);
  });

  it("puts a removed block of sets back where it was", () => {
    const sets = [
      { exerciseName: "Goblet squat", setNumber: 1, reps: 6, loadValue: 50, loadUnit: "lb" as const, completed: true },
      { exerciseName: "One-arm row", setNumber: 1, reps: 8, loadValue: 30, loadUnit: "lb" as const, completed: true },
      { exerciseName: "Face pull", setNumber: 1, reps: null, loadValue: null, loadUnit: "lb" as const, completed: false },
    ];
    const snapshot = snapshotRemovedSets(sets, "One-arm row");
    const next = withoutExerciseName(sets, "One-arm row");
    expect(restoreSnapshotSets(next, snapshot).map((set) => set.exerciseName)).toEqual([
      "Goblet squat",
      "One-arm row",
      "Face pull",
    ]);
  });
});

describe("persisted session removal", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("removes one exercise, undoes it, and refuses the last exercise", async () => {
    const user = await makeUser("remove-session@example.com");
    const program = await getDemoProgram();
    const day = program.days.find((row) => row.dayNumber === 1)!;
    const started = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
      scale: { experienceLevel: "intermediate", weightAccess: "gym" },
    });
    const names = [...new Set(started.sets.map((set) => set.exerciseName))];
    expect(names.length).toBeGreaterThan(1);
    expect(names).toContain("One-arm row");

    const removed = await removeSessionExercise({
      userId: user.id,
      programSlug: DEMO_PROGRAM_SLUG,
      dayNumber: day.dayNumber,
      programDayId: day.id,
      originalName: "One-arm row",
      exerciseName: "One-arm row",
      workoutSessionId: started.id,
      blockKey,
    });
    const after = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: started.id },
      include: { sets: true },
    });
    expect(after.status).toBe("draft");
    expect(after.sets.some((set) => set.exerciseName === "One-arm row")).toBe(false);
    expect(new Set(after.sets.map((set) => set.exerciseName)).size).toBe(names.length - 1);
    expect(removed.sets?.some((set) => set.exerciseName === "One-arm row")).toBe(false);

    const restored = await undoExerciseRemoval({
      userId: user.id,
      removalId: removed.id,
    });
    expect(restored.sets?.some((set) => set.exerciseName === "One-arm row")).toBe(true);
    expect(await prisma.exerciseRemoval.count({ where: { userId: user.id } })).toBe(0);

    let current = [...names];
    const sessionId = started.id;
    while (current.length > 1) {
      const exerciseName = current[0]!;
      const result = await removeSessionExercise({
        userId: user.id,
        programSlug: DEMO_PROGRAM_SLUG,
        dayNumber: day.dayNumber,
        programDayId: day.id,
        originalName: exerciseName,
        exerciseName,
        workoutSessionId: sessionId,
        blockKey,
      });
      current = [...new Set((result.sets ?? []).map((set) => set.exerciseName))];
    }
    await expect(
      removeSessionExercise({
        userId: user.id,
        programSlug: DEMO_PROGRAM_SLUG,
        dayNumber: day.dayNumber,
        programDayId: day.id,
        originalName: current[0]!,
        exerciseName: current[0]!,
        workoutSessionId: sessionId,
        blockKey,
      }),
    ).rejects.toThrow(/Keep at least one exercise/);
    const finished = await prisma.workoutSession.findUniqueOrThrow({ where: { id: started.id } });
    expect(finished.status).toBe("draft");
  });

  it("keeps a removal on the next start of this session and not the one after", async () => {
    const user = await makeUser("remove-pending@example.com");
    const program = await getDemoProgram();
    const day = program.days.find((row) => row.dayNumber === 1)!;
    const scaled = scaleProgramDay(day, {
      band: "intermediate",
      programSlug: DEMO_PROGRAM_SLUG,
      weightAccess: "gym",
    });
    expect(scaled.exercises.some((exercise) => exercise.name === "One-arm row")).toBe(true);

    await removeSessionExercise({
      userId: user.id,
      programSlug: DEMO_PROGRAM_SLUG,
      dayNumber: day.dayNumber,
      programDayId: day.id,
      originalName: "One-arm row",
      exerciseName: "One-arm row",
      blockKey,
    });
    const first = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
      scale: { experienceLevel: "intermediate", weightAccess: "gym" },
    });
    expect(first.sets.some((set) => set.exerciseName === "One-arm row")).toBe(false);
    expect(first.sets.length).toBeGreaterThan(0);
    expect(first.status).toBe("draft");
    const bound = await prisma.exerciseRemoval.findFirstOrThrow({ where: { userId: user.id } });
    expect(bound.workoutSessionId).toBe(first.id);

    const second = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
      scale: { experienceLevel: "intermediate", weightAccess: "gym" },
    });
    expect(second.sets.some((set) => set.exerciseName === "One-arm row")).toBe(true);
  });
});
