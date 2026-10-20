import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { DEMO_PROGRAM_SLUG, getDemoProgram } from "@/lib/programs";
import { formVideoFieldsFor } from "@/lib/form-videos";
import { trainingBlockKey } from "@/lib/exercise-swap";
import { applyExerciseSwap, mergeReplacementSets } from "@/lib/exercise-swap-store";
import { fieldEnterFinishesWorkout } from "@/lib/workout-form-submit";
import { isLogMode } from "@/lib/exercise-log-mode";
import {
  reopenCompletedWorkoutForUser,
  startWorkoutFromDay,
  updateWorkoutSessionForUser,
} from "@/lib/workouts";
import { scaleProgramDay } from "@/lib/training-scale";
import { APP_TIMEZONE } from "@/lib/timezone";

describe("swap search must not finish the workout", () => {
  it("treats Enter in a text field as an accidental SAVE", () => {
    expect(fieldEnterFinishesWorkout("INPUT", "text")).toBe(true);
    expect(fieldEnterFinishesWorkout("input", "search")).toBe(true);
    expect(fieldEnterFinishesWorkout("input", "number")).toBe(true);
    expect(fieldEnterFinishesWorkout("textarea", null)).toBe(false);
    expect(fieldEnterFinishesWorkout("button", "submit")).toBe(false);
    expect(fieldEnterFinishesWorkout("input", "checkbox")).toBe(false);
  });
});

describe("mid-workout swap", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("keeps other exercises when the target is already in the workout", () => {
    const merged = mergeReplacementSets(
      [
        {
          exerciseName: "Squat jump",
          setNumber: 1,
          reps: 3,
          loadValue: null,
          loadUnit: "lb",
          logMode: "reps_only",
          completed: true,
        },
        {
          exerciseName: "Dumbbell bench press",
          setNumber: 1,
          reps: 8,
          loadValue: 40,
          loadUnit: "lb",
          logMode: "load_reps",
          completed: true,
          rir: "0-2 RIR",
        },
        {
          exerciseName: "Dumbbell bench press",
          setNumber: 2,
          reps: null,
          loadValue: null,
          loadUnit: "lb",
          logMode: "load_reps",
          completed: false,
        },
        {
          exerciseName: "One-arm row",
          setNumber: 1,
          reps: 8,
          loadValue: 30,
          loadUnit: "lb",
          logMode: "load_reps",
          completed: true,
        },
      ],
      ["Dumbbell bench press"],
      {
        name: "One-arm row",
        sets: 4,
        reps: "8 / side",
        loadText: "0-2 RIR · Heavy dumbbell",
        logMode: "load_reps",
      },
      { programSlug: "demo", dayNumber: 3, loadUnit: "lb" },
    );
    expect(merged.some((set) => set.exerciseName === "Dumbbell bench press")).toBe(false);
    expect(merged.some((set) => / \(2\)|\(second\)/i.test(set.exerciseName))).toBe(false);
    const squat = merged.find((set) => set.exerciseName === "Squat jump");
    expect(squat).toMatchObject({ reps: 3, completed: true });
    const rowLogs = merged.filter((set) => set.exerciseName === "One-arm row" && set.reps === 8);
    expect(rowLogs.length).toBeGreaterThanOrEqual(2);
    expect(rowLogs.some((set) => set.loadValue === 30)).toBe(true);
    expect(rowLogs.some((set) => set.loadValue === 40)).toBe(true);
  });

  it("stays a draft, keeps the other logs, and gives the new press its own video", async () => {
    const user = await makeUser("swap-bench@example.com");
    const program = await getDemoProgram();
    const day = program.days.find((row) => row.dayNumber === 1);
    expect(day, "Monday full-body day").toBeTruthy();
    const scaled = scaleProgramDay(day!, {
      band: "intermediate",
      programSlug: DEMO_PROGRAM_SLUG,
      weightAccess: "gym",
    });
    const bench = scaled.exercises.find((exercise) => exercise.name === "Dumbbell bench press");
    expect(bench).toBeTruthy();
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day!.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    expect(session.sets.filter((set) => set.exerciseName === "Dumbbell bench press").length).toBeGreaterThan(0);
    const neighbor = session.sets.find(
      (set) => set.exerciseName === "One-arm row" && set.setNumber === 1,
    );
    expect(neighbor).toBeTruthy();

    const withLogs = session.sets.map((set) => ({
      exerciseName: set.exerciseName,
      setNumber: set.setNumber,
      reps: set.exerciseName === "Dumbbell bench press" && set.setNumber === 1 ? 8 : set.reps,
      loadValue:
        set.exerciseName === "Dumbbell bench press" && set.setNumber === 1 ? 45 : set.loadValue,
      loadUnit: "lb" as const,
      logMode: isLogMode(set.logMode) ? set.logMode : undefined,
      durationSeconds: set.durationSeconds,
      completed: set.id === neighbor!.id || (set.exerciseName === "Dumbbell bench press" && set.setNumber === 1),
      notes: set.notes,
      prescriptionKey: set.prescriptionKey,
      rir: set.rir,
    }));
    if (neighbor) {
      const loggedNeighbor = withLogs.find((set) => set.exerciseName === neighbor.exerciseName && set.setNumber === neighbor.setNumber);
      if (loggedNeighbor) {
        loggedNeighbor.reps = loggedNeighbor.reps ?? 6;
        loggedNeighbor.completed = true;
      }
    }

    const updated = await applyExerciseSwap({
      userId: user.id,
      programSlug: DEMO_PROGRAM_SLUG,
      dayNumber: day!.dayNumber,
      originalName: "Dumbbell bench press",
      currentName: "Dumbbell bench press",
      replacementName: "Barbell bench press",
      scope: "session",
      workoutSessionId: session.id,
      blockKey: trainingBlockKey(new Date(), APP_TIMEZONE),
      source: {
        sets: bench!.sets,
        reps: bench!.reps,
        loadText: bench!.loadText,
        restSeconds: bench!.restSeconds,
        logMode: bench!.logMode,
        notes: bench!.notes,
      },
      currentSets: withLogs,
    });

    expect(updated.sets).toBeTruthy();
    const fresh = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: session.id },
      include: { sets: true },
    });
    expect(fresh.id).toBe(session.id);
    expect(fresh.status).toBe("draft");
    expect(fresh.sets.some((set) => set.exerciseName === "Dumbbell bench press")).toBe(false);
    const barbell = fresh.sets.filter((set) => set.exerciseName === "Barbell bench press");
    expect(barbell.length).toBeGreaterThan(0);
    expect(barbell.some((set) => set.reps === 8 && set.loadValue === 45 && set.completed)).toBe(true);
    expect(barbell.map((set) => set.exerciseName).join(" ")).not.toMatch(/\(2\)|\(second\)/i);
    const kept = fresh.sets.find((set) => set.exerciseName === neighbor!.exerciseName);
    expect(kept?.reps).toBe(6);
    expect(kept?.completed).toBe(true);

    const swap = await prisma.exerciseSwap.findFirst({
      where: { workoutSessionId: session.id, replacementName: "Barbell bench press" },
    });
    expect(swap?.restSeconds).toBe(bench!.restSeconds);
    expect(swap?.loadText).toMatch(/RIR/);
    expect(swap?.sets).toBe(bench!.sets);

    const video = formVideoFieldsFor("Barbell bench press");
    expect(video.formVideoUrl).toContain("0cXAp6WhSj4");
    expect(video.formVideoUrl).not.toContain("qFTnmyC-nf4");
    expect(video.formVideoPending).toBe(false);

    const finished = await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: fresh.title,
      performedAt: fresh.performedAt,
      notes: fresh.notes,
      status: "complete",
      sets: fresh.sets.map((set) => ({
        exerciseName: set.exerciseName,
        setNumber: set.setNumber,
        reps: set.reps,
        loadValue: set.loadValue,
        loadUnit: "lb",
        logMode: isLogMode(set.logMode) ? set.logMode : undefined,
        durationSeconds: set.durationSeconds,
        completed: set.completed,
        notes: set.notes,
        prescriptionKey: set.prescriptionKey,
        rir: set.rir,
      })),
    });
    expect(finished.status).toBe("complete");
    const reopened = await reopenCompletedWorkoutForUser(user.id, session.id);
    expect(reopened.status).toBe("draft");
    expect(reopened.sets.some((set) => set.exerciseName === "Barbell bench press" && set.reps === 8)).toBe(
      true,
    );
    expect(reopened.sets.some((set) => set.exerciseName === neighbor!.exerciseName && set.reps === 6)).toBe(
      true,
    );
  });
});
