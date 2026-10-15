import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { DEMO_PROGRAM_SLUG, getDemoProgram } from "@/lib/programs";
import {
  EXERCISE_LIBRARY,
  canonicalExerciseName,
  libraryExercise,
} from "@/lib/exercise-library";
import {
  applySwapsToExercises,
  sensiblePrescription,
  trainingBlockKey,
} from "@/lib/exercise-swap";
import { applyExerciseSwap } from "@/lib/exercise-swap-store";
import { skipsFormVideo, formVideoFieldsFor } from "@/lib/form-videos";
import { figureForBlock } from "@/lib/mobility-poses";
import { scaleExercise, scaleProgramDay } from "@/lib/training-scale";
import {
  getPreviousLoadsForSlots,
  startWorkoutFromDay,
  updateWorkoutSessionForUser,
} from "@/lib/workouts";
import { buildProgressSummary } from "@/lib/progress";
import { isLogMode } from "@/lib/exercise-log-mode";
import { APP_TIMEZONE } from "@/lib/timezone";

const lunge = {
  name: "Reverse lunge",
  sets: 3,
  reps: "8 / leg",
  loadText: "2-4 RIR · Front knee tracks over the toes.",
  restSeconds: 75,
  logMode: "load_reps",
};

describe("exercise swap prescriptions", () => {
  it("keeps sets, RIR, and rest for the same kind of work", () => {
    const same = sensiblePrescription(lunge, "Walking lunge");
    expect(same).toMatchObject({
      name: "Walking lunge",
      sets: 3,
      reps: "8 / leg",
      restSeconds: 75,
      logMode: "load_reps",
    });
    expect(same?.loadText).toMatch(/2-4 RIR/);

    const scheme = sensiblePrescription(lunge, "Goblet squat");
    expect(scheme).toMatchObject({
      name: "Goblet squat",
      sets: 3,
      reps: "6",
      restSeconds: 75,
      logMode: "load_reps",
    });
    expect(scheme?.loadText).toMatch(/2-4 RIR/);
  });

  it("uses the replacement's own prescription when the pattern changes", () => {
    const plank = sensiblePrescription(lunge, "Front plank");
    expect(plank).toMatchObject({
      name: "Front plank",
      sets: 3,
      reps: "30 sec",
      restSeconds: 45,
      logMode: "timed",
      loadText: "Hold — no weight",
    });
    const pulldown = sensiblePrescription(
      {
        name: "Chin-up",
        sets: 4,
        reps: "5",
        loadText: "1-3 RIR · Full hang.",
        restSeconds: 90,
        logMode: "reps_only",
      },
      "Lat pulldown",
    );
    const target = libraryExercise("Lat pulldown");
    expect(pulldown).toMatchObject({
      name: "Lat pulldown",
      sets: target?.sets,
      reps: target?.reps,
      loadText: target?.loadText,
      restSeconds: target?.restSeconds,
      logMode: target?.logMode,
      notes: target?.notes,
    });
  });

  it("lists one name per library exercise and gives mobility a figure", () => {
    const names = EXERCISE_LIBRARY.map((exercise) => exercise.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.some((name) => / or /i.test(name))).toBe(false);
    expect(libraryExercise("Shadowboxing")).toBeNull();
    expect(skipsFormVideo("Shadowboxing")).toBe(true);
    for (const exercise of EXERCISE_LIBRARY.filter((row) => row.category === "mobility")) {
      expect(exercise.figureKey, exercise.name).toBeTruthy();
      expect(figureForBlock(exercise.figureKey ?? ""), exercise.name).toBeTruthy();
    }
    for (const exercise of EXERCISE_LIBRARY) {
      if (skipsFormVideo(exercise.name)) continue;
      const video = formVideoFieldsFor(exercise.name);
      if (!video.formVideoUrl) continue;
      expect(video.formVideoPending, exercise.name).toBe(false);
    }
  });

  it("shows one exercise name on a scaled strength day", () => {
    const scaled = scaleExercise(
      {
        name: "Band pull-apart or face pull",
        sets: 3,
        reps: "15",
        loadText: "2-4 RIR",
        restSeconds: 45,
        logMode: "reps_only",
      },
      { band: "intermediate", programSlug: DEMO_PROGRAM_SLUG, dayNumber: 2 },
    );
    expect(canonicalExerciseName("Chin-up, band-assist, or lat pulldown")).toBe("Chin-up");
    expect(scaled.name).toBe("Face pull");
    expect(scaled.name).not.toMatch(/ or /i);
  });
});

describe("swapped logging and progress", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("keeps previous goblet numbers and progress after a lunge swap", async () => {
    const user = await makeUser("swap-logger@example.com");
    const program = await getDemoProgram();
    const day = program.days.find((row) => row.dayNumber === 1)!;
    const scaled = scaleProgramDay(day, {
      band: "intermediate",
      programSlug: DEMO_PROGRAM_SLUG,
      weightAccess: "gym",
    });
    expect(scaled.exercises.some((exercise) => / or /i.test(exercise.name))).toBe(false);
    const source = scaled.exercises.find((exercise) => exercise.name === "Reverse lunge")!;
    const blockKey = trainingBlockKey(new Date(), APP_TIMEZONE);

    const first = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    const gobletKey = first.sets.find((set) => set.exerciseName === "Goblet squat")?.prescriptionKey;
    expect(gobletKey).toBeTruthy();
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: first.id,
      title: first.title,
      performedAt: new Date(),
      notes: "",
      status: "complete",
      sets: first.sets.map((set) => ({
        exerciseName: set.exerciseName,
        setNumber: set.setNumber,
        reps: set.exerciseName === "Goblet squat" ? 6 : null,
        loadValue: set.exerciseName === "Goblet squat" ? 50 : null,
        loadUnit: "lb" as const,
        logMode: isLogMode(set.logMode) ? set.logMode : undefined,
        durationSeconds: set.durationSeconds,
        completed: set.exerciseName === "Goblet squat",
        notes: "",
        prescriptionKey: set.prescriptionKey,
        rir: set.rir,
      })),
    });

    const second = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    expect(second.sets.some((set) => set.exerciseName === "Reverse lunge")).toBe(true);
    await applyExerciseSwap({
      userId: user.id,
      programSlug: DEMO_PROGRAM_SLUG,
      dayNumber: day.dayNumber,
      originalName: "Reverse lunge",
      currentName: "Reverse lunge",
      replacementName: "Goblet squat",
      scope: "session",
      workoutSessionId: second.id,
      blockKey,
      source: {
        sets: source.sets,
        reps: source.reps,
        loadText: source.loadText,
        restSeconds: source.restSeconds,
        logMode: source.logMode,
      },
    });
    const swapped = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: second.id },
      include: { sets: true },
    });
    expect(swapped.sets.some((set) => set.exerciseName === "Reverse lunge")).toBe(false);
    const replacement = swapped.sets.filter(
      (set) => set.exerciseName === "Goblet squat" && set.prescriptionKey === gobletKey,
    );
    expect(replacement.length).toBeGreaterThan(0);
    const previous = await getPreviousLoadsForSlots(
      user.id,
      replacement.map((set) => ({
        exerciseName: set.exerciseName,
        prescriptionKey: set.prescriptionKey,
      })),
      swapped.id,
    );
    expect(previous["Goblet squat"]?.[1]?.loadValue).toBe(50);

    const finished = await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: swapped.id,
      title: swapped.title,
      performedAt: new Date(),
      notes: "",
      status: "complete",
      sets: swapped.sets.map((set) => ({
        exerciseName: set.exerciseName,
        setNumber: set.setNumber,
        reps: set.exerciseName === "Goblet squat" ? 6 : null,
        loadValue: set.exerciseName === "Goblet squat" ? 95 : null,
        loadUnit: "lb" as const,
        logMode: isLogMode(set.logMode) ? set.logMode : undefined,
        durationSeconds: set.durationSeconds,
        completed: set.exerciseName === "Goblet squat",
        notes: "",
        prescriptionKey: set.prescriptionKey,
        rir: set.rir,
      })),
    });
    const summary = buildProgressSummary([finished], "lb");
    expect(summary.exerciseBests.map((best) => best.exerciseName)).toContain("Goblet squat");
    expect(summary.exerciseBests.map((best) => best.exerciseName)).not.toContain("Reverse lunge");
    expect(summary.exerciseBests.find((best) => best.exerciseName === "Goblet squat")?.bestLoad).toBe(95);
  });

  it("applies a block swap to the next session in that block only", async () => {
    const user = await makeUser("swap-block@example.com");
    const program = await getDemoProgram();
    const day = program.days.find((row) => row.dayNumber === 1)!;
    const scaled = scaleProgramDay(day, {
      band: "intermediate",
      programSlug: DEMO_PROGRAM_SLUG,
      weightAccess: "gym",
    });
    const source = scaled.exercises.find((exercise) => exercise.name === "Reverse lunge")!;
    const blockKey = trainingBlockKey(new Date(), APP_TIMEZONE);

    const earlier = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: earlier.id,
      title: earlier.title,
      performedAt: new Date(Date.now() - 60_000),
      notes: "",
      status: "complete",
      sets: earlier.sets.map((set) => ({
        exerciseName: set.exerciseName,
        setNumber: set.setNumber,
        reps: set.exerciseName === "Goblet squat" ? 6 : null,
        loadValue: set.exerciseName === "Goblet squat" ? 40 : null,
        loadUnit: "lb" as const,
        logMode: isLogMode(set.logMode) ? set.logMode : undefined,
        completed: set.exerciseName === "Goblet squat",
        prescriptionKey: set.prescriptionKey,
        rir: set.rir,
      })),
    });

    await applyExerciseSwap({
      userId: user.id,
      programSlug: DEMO_PROGRAM_SLUG,
      dayNumber: day.dayNumber,
      originalName: "Reverse lunge",
      currentName: "Reverse lunge",
      replacementName: "Goblet squat",
      scope: "block",
      blockKey,
      source: {
        sets: source.sets,
        reps: source.reps,
        loadText: source.loadText,
        restSeconds: source.restSeconds,
        logMode: source.logMode,
      },
    });

    const next = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    expect(next.sets.some((set) => set.exerciseName === "Reverse lunge")).toBe(false);
    const previous = await getPreviousLoadsForSlots(
      user.id,
      next.sets
        .filter((set) => set.exerciseName === "Goblet squat")
        .map((set) => ({
          exerciseName: set.exerciseName,
          prescriptionKey: set.prescriptionKey,
        })),
      next.id,
    );
    expect(previous["Goblet squat"]?.[1]?.loadValue).toBe(40);

    const other = applySwapsToExercises(scaled.exercises, [
      {
        originalName: "Reverse lunge",
        replacementName: "Goblet squat",
        scope: "block",
        workoutSessionId: "",
        blockKey: "1999-01-04:Z",
        sets: source.sets,
        reps: "6",
        loadText: source.loadText,
        restSeconds: source.restSeconds,
        logMode: "load_reps",
        notes: "",
        retiredNames: ["Reverse lunge"],
      },
    ], { blockKey, includePending: false });
    expect(other.find((exercise) => exercise.name === "Reverse lunge")).toBeTruthy();
  });
});
