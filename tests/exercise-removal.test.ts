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
import { listRemovalsForDay, removeSessionExercise, undoExerciseRemoval } from "@/lib/exercise-removal-store";
import { applySwapsToExercises, trainingBlockKey } from "@/lib/exercise-swap";
import { applyExerciseSwap } from "@/lib/exercise-swap-store";
import { isLogMode } from "@/lib/exercise-log-mode";
import { scaleProgramDay } from "@/lib/training-scale";
import { sessionCountsAsPlannedCompletion } from "@/lib/logged-work";
import { startWorkoutFromDay, updateWorkoutSessionForUser, type WorkoutSetInput } from "@/lib/workouts";
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
    expect(hiddenNamesForRemovals(
      [{ originalName: "One-arm row", exerciseName: "Goblet squat · 2", workoutSessionId: "s1" }],
      ["Goblet squat", "Face pull"],
    )).toEqual(["Goblet squat · 2"]);
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
    await prisma.workoutSession.update({
      where: { id: first.id },
      data: { performedAt: new Date("2026-09-01T18:00:00.000Z") },
    });

    const second = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
      scale: { experienceLevel: "intermediate", weightAccess: "gym" },
    });
    expect(second.sets.some((set) => set.exerciseName === "One-arm row")).toBe(true);
  });

  it("keeps Goblet squat removed when it was swapped in and then removed", async () => {
    const user = await makeUser("swap-then-remove@example.com");
    const program = await getDemoProgram();
    const day = program.days.find((row) => row.dayNumber === 1)!;
    const scaled = scaleProgramDay(day, {
      band: "intermediate",
      programSlug: DEMO_PROGRAM_SLUG,
      weightAccess: "gym",
    });
    const source = scaled.exercises.find((exercise) => exercise.name === "One-arm row");
    expect(source).toBeTruthy();
    const started = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
      scale: { experienceLevel: "intermediate", weightAccess: "gym" },
    });
    const swapped = await applyExerciseSwap({
      userId: user.id,
      programSlug: DEMO_PROGRAM_SLUG,
      dayNumber: day.dayNumber,
      originalName: "One-arm row",
      currentName: "One-arm row",
      replacementName: "Goblet squat",
      scope: "session",
      workoutSessionId: started.id,
      blockKey,
      source: {
        sets: source!.sets,
        reps: source!.reps,
        loadText: source!.loadText,
        restSeconds: source!.restSeconds,
        logMode: source!.logMode,
        notes: source!.notes,
      },
    });
    const introduced = swapped.sets?.find(
      (set) => set.exerciseName.startsWith("Goblet squat") && set.exerciseName !== "Goblet squat",
    );
    const swappedName = introduced?.exerciseName ?? "Goblet squat";
    expect(swapped.sets?.some((set) => set.exerciseName === swappedName)).toBe(true);
    const beforeRemove = (swapped.sets ?? []).map((set) => ({
      exerciseName: set.exerciseName,
      setNumber: set.setNumber,
      reps: set.reps,
      loadValue: set.loadValue,
      loadUnit: "lb" as const,
      logMode: isLogMode(set.logMode) ? set.logMode : undefined,
      durationSeconds: set.durationSeconds,
      completed: set.completed,
      notes: set.notes,
      prescriptionKey: set.prescriptionKey,
      rir: set.rir,
    }));

    // The open logger still has the pre-swap slot list, so it sends the new
    // card name as the programmed slot. That used to save a removal the reload ignored.
    const removed = await removeSessionExercise({
      userId: user.id,
      programSlug: DEMO_PROGRAM_SLUG,
      dayNumber: day.dayNumber,
      programDayId: day.id,
      originalName: swappedName,
      exerciseName: swappedName,
      workoutSessionId: started.id,
      blockKey,
      currentSets: beforeRemove,
    });
    expect(removed.sets?.some((set) => set.exerciseName === swappedName)).toBe(false);

    const stored = await prisma.exerciseRemoval.findFirstOrThrow({ where: { userId: user.id } });
    expect(stored.originalName).toBe("One-arm row");
    expect(stored.exerciseName).toBe(swappedName);

    const late = await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: started.id,
      title: started.title,
      performedAt: started.performedAt,
      notes: started.notes,
      status: "draft",
      sets: beforeRemove,
    });
    expect(late.sets.some((set) => set.exerciseName === swappedName)).toBe(false);
    expect(late.sets.some((set) => set.exerciseName === "One-arm row")).toBe(false);

    const reloaded = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: started.id },
      include: { sets: true },
    });
    const swaps = await (await import("@/lib/exercise-swap-store")).listSwapsForDay({
      userId: user.id,
      programSlug: DEMO_PROGRAM_SLUG,
      dayNumber: day.dayNumber,
    });
    const shown = applySwapsToExercises(scaled.exercises, swaps, {
      sessionId: started.id,
      blockKey,
      includePending: false,
    });
    const removals = await listRemovalsForDay({
      userId: user.id,
      programSlug: DEMO_PROGRAM_SLUG,
      dayNumber: day.dayNumber,
    });
    const omitted = omitRemovedSlots(scaled.exercises, shown, removals, {
      sessionId: started.id,
      includePending: false,
    });
    expect(omitted.shown.some((row) => row.name === swappedName || row.name === "One-arm row")).toBe(false);
    expect(reloaded.sets.some((set) => set.exerciseName === swappedName)).toBe(false);
    expect(reloaded.status).toBe("draft");

    const withOriginal = [
      ...beforeRemove.filter((set) => set.exerciseName !== swappedName),
      {
        ...beforeRemove[0]!,
        exerciseName: "One-arm row",
        setNumber: 1,
        reps: 8,
        completed: true,
      },
    ];
    const readded = await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: started.id,
      title: started.title,
      performedAt: started.performedAt,
      notes: started.notes,
      status: "draft",
      sets: withOriginal,
    });
    expect(readded.sets.some((set) => set.exerciseName === "One-arm row")).toBe(true);
    expect(readded.sets.some((set) => set.exerciseName === swappedName)).toBe(false);
  });

  it("lowers the completion target when an exercise is removed and still requires every remaining set", async () => {
    const user = await makeUser("remove-completion@example.com");
    const program = await getDemoProgram();
    const day = program.days.find((row) => row.dayNumber === 1)!;
    const started = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
      scale: { experienceLevel: "intermediate", weightAccess: "gym" },
    });
    expect(started.plannedSetCount).toBe(started.sets.length);
    const removedRows = started.sets.filter((set) => set.exerciseName === "One-arm row").length;
    expect(removedRows).toBeGreaterThan(0);

    await removeSessionExercise({
      userId: user.id,
      programSlug: DEMO_PROGRAM_SLUG,
      dayNumber: day.dayNumber,
      programDayId: day.id,
      originalName: "One-arm row",
      exerciseName: "One-arm row",
      workoutSessionId: started.id,
      blockKey,
    });
    const dropped = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: started.id },
      include: { sets: true },
    });
    expect(dropped.plannedSetCount).toBe((started.plannedSetCount ?? 0) - removedRows);
    expect(dropped.sets.some((set) => set.exerciseName === "One-arm row")).toBe(false);

    await undoExerciseRemoval({ userId: user.id, removalId: (await prisma.exerciseRemoval.findFirstOrThrow({ where: { userId: user.id } })).id });
    const undone = await prisma.workoutSession.findUniqueOrThrow({ where: { id: started.id } });
    expect(undone.plannedSetCount).toBe(started.plannedSetCount);

    await removeSessionExercise({
      userId: user.id,
      programSlug: DEMO_PROGRAM_SLUG,
      dayNumber: day.dayNumber,
      programDayId: day.id,
      originalName: "One-arm row",
      exerciseName: "One-arm row",
      workoutSessionId: started.id,
      blockKey,
    });
    const session = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: started.id },
      include: { sets: true },
    });
    const names = [...new Set(started.sets.map((set) => set.exerciseName))];
    const one = await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: started.id,
      title: started.title,
      performedAt: started.performedAt,
      notes: started.notes,
      status: "complete",
      sets: ticked(session.sets, "one"),
    });
    expect(sessionCountsAsPlannedCompletion(one, names)).toBe(false);

    const done = await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: started.id,
      title: started.title,
      performedAt: started.performedAt,
      notes: started.notes,
      status: "complete",
      sets: ticked(session.sets, "all"),
    });
    expect(done.plannedSetCount).toBe((started.plannedSetCount ?? 0) - removedRows);
    expect(sessionCountsAsPlannedCompletion(done, names)).toBe(true);
    expect(done.sets.some((set) => set.exerciseName === "One-arm row")).toBe(false);
  });

  it("saves an empty set list when every exercise has been removed", async () => {
    const user = await makeUser("remove-all@example.com");
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
    await prisma.exerciseRemoval.createMany({
      data: names.map((name) => ({
        userId: user.id,
        programSlug: DEMO_PROGRAM_SLUG,
        dayNumber: day.dayNumber,
        originalName: name,
        exerciseName: name,
        workoutSessionId: started.id,
      })),
    });
    const saved = await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: started.id,
      title: started.title,
      performedAt: started.performedAt,
      notes: started.notes,
      status: "draft",
      sets: ticked(started.sets, "none"),
    });
    expect(saved.sets).toHaveLength(0);
  });
});

function ticked(
  sets: {
    exerciseName: string;
    setNumber: number;
    reps: number | null;
    loadValue: number | null;
    logMode: string | null;
    durationSeconds: number | null;
    notes: string;
    prescriptionKey: string;
    rir: string;
  }[],
  mode: "all" | "one" | "none",
): WorkoutSetInput[] {
  return sets.map((set, index) => {
    const completed = mode === "all" || (mode === "one" && index === 0);
    const duration = set.durationSeconds != null && set.durationSeconds > 0 ? set.durationSeconds : null;
    return {
      exerciseName: set.exerciseName,
      setNumber: set.setNumber,
      reps: completed && set.reps == null && duration == null ? 8 : set.reps,
      loadValue: set.loadValue,
      loadUnit: "lb",
      logMode: isLogMode(set.logMode) ? set.logMode : undefined,
      durationSeconds: completed && set.reps == null && set.loadValue == null ? duration ?? 30 : set.durationSeconds,
      completed,
      notes: set.notes,
      prescriptionKey: set.prescriptionKey,
      rir: set.rir,
    };
  });
}
