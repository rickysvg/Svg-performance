import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { EXERCISE_LIBRARY, filterExerciseLibrary, libraryExercise } from "@/lib/exercise-library";
import { isDurationMode, isLogMode, resolveLogMode } from "@/lib/exercise-log-mode";
import { gymExerciseKey } from "@/lib/gym-exercise";
import { restoreLoggerSets } from "@/lib/logger-sets";
import {
  addedPrescriptionKey,
  draftsForLibraryExercise,
  exerciseNamesInOrder,
  insertSetsAtExercise,
  loggedExerciseNamesInOrder,
  moveExercise,
  parseAddedPlan,
  removeExerciseSets,
} from "@/lib/logger-insert";
import { buildProgressSummary } from "@/lib/progress";
import { getDemoProgram } from "@/lib/programs";
import { sessionVolume } from "@/lib/share-card";
import {
  listWorkoutSessionsForUser,
  startWorkoutFromDay,
  updateWorkoutSessionForUser,
} from "@/lib/workouts";
import { makeUser, resetDatabase } from "./helpers";

type Row = { exerciseName: string; setNumber: number; reps?: number | null; loadValue?: number | null };

function row(exerciseName: string, setNumber = 1): Row {
  return { exerciseName, setNumber };
}

describe("insert an exercise anywhere in the logger", () => {
  it("inserts between two exercises, moves it, and removes it", () => {
    const sets = [row("Warm-up"), row("Squat", 1), row("Squat", 2), row("Hinge")];
    const goblet = libraryExercise("Goblet squat");
    expect(goblet).toBeTruthy();
    const drafts = draftsForLibraryExercise(
      sets.map((set) => set.exerciseName),
      goblet!,
    );
    expect(drafts).toHaveLength(goblet!.sets);
    expect(drafts.every((draft) => draft.reps === 6 && draft.restSeconds === 120)).toBe(true);
    expect(drafts[0]?.exerciseName).toBe("Goblet squat");

    const inserted = insertSetsAtExercise(
      sets,
      1,
      drafts.map((draft) => row(draft.exerciseName, draft.setNumber)),
    );
    expect(exerciseNamesInOrder(inserted)).toEqual(["Warm-up", "Goblet squat", "Squat", "Hinge"]);

    const again = draftsForLibraryExercise(
      inserted.map((set) => set.exerciseName),
      goblet!,
    );
    expect(again[0]?.exerciseName).toBe("Goblet squat · 2");
    const key = addedPrescriptionKey({
      exerciseName: again[0]!.exerciseName,
      reps: goblet!.reps,
      restSeconds: 90,
    });
    expect(parseAddedPlan(key)).toEqual({ reps: "6", restSeconds: 90 });

    expect(exerciseNamesInOrder(moveExercise(inserted, "Goblet squat", "up"))).toEqual([
      "Goblet squat",
      "Warm-up",
      "Squat",
      "Hinge",
    ]);
    expect(exerciseNamesInOrder(moveExercise(inserted, "Goblet squat", "down"))).toEqual([
      "Warm-up",
      "Squat",
      "Goblet squat",
      "Hinge",
    ]);
    expect(exerciseNamesInOrder(moveExercise(inserted, "Warm-up", "up"))).toEqual(
      exerciseNamesInOrder(inserted),
    );
    expect(exerciseNamesInOrder(removeExerciseSets(inserted, "Goblet squat"))).toEqual([
      "Warm-up",
      "Squat",
      "Hinge",
    ]);
  });

  it("offers the swap library and leaves unreviewed clips out", () => {
    const hidden = EXERCISE_LIBRARY.filter((exercise) => exercise.memberHidden);
    expect(hidden.length).toBeGreaterThan(0);
    const gym = filterExerciseLibrary({ equipment: "gym" });
    const floor = filterExerciseLibrary({ equipment: "none" });
    for (const exercise of hidden) {
      expect(gym.some((row) => row.name === exercise.name)).toBe(false);
      expect(floor.some((row) => row.name === exercise.name)).toBe(false);
    }
    expect(gym.some((row) => row.name === "Goblet squat")).toBe(true);
  });

  it("keeps an inserted exercise in place when the logger reloads", () => {
    const server = [
      row("Warm-up"),
      row("Goblet squat", 1),
      row("Goblet squat", 2),
      row("Squat"),
    ];
    const restored = restoreLoggerSets(
      server,
      null,
      [
        { name: "Warm-up", sets: 1 },
        { name: "Squat", sets: 1 },
      ],
      (exerciseName, setNumber) => row(exerciseName, setNumber),
      gymExerciseKey,
    );
    expect(exerciseNamesInOrder(restored)).toEqual(["Warm-up", "Goblet squat", "Squat"]);
    expect(restored.filter((set) => set.exerciseName === "Goblet squat")).toHaveLength(2);
  });
});

describe("an added exercise saves, shows in history, and counts toward volume", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("keeps Goblet squat between the exercises around it", async () => {
    const user = await makeUser("insert-mid@example.com");
    const program = await getDemoProgram();
    const day = program.days.find((row) => row.dayNumber === 1) ?? program.days[0];
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
    });
    const names = exerciseNamesInOrder(session.sets);
    expect(names.length).toBeGreaterThan(2);
    const first = names[0]!;
    const second = names[1]!;
    const goblet = libraryExercise("Goblet squat")!;
    const drafts = draftsForLibraryExercise(names, goblet);
    const base = session.sets.map((set) => ({
      exerciseName: set.exerciseName,
      setNumber: set.setNumber,
      reps: null as number | null,
      loadValue: null as number | null,
      loadUnit: "lb" as const,
      logMode: set.logMode,
      durationSeconds: set.durationSeconds,
      completed: false,
      prescriptionKey: set.prescriptionKey,
      rir: set.rir,
    }));
    const inserted = insertSetsAtExercise(
      base,
      1,
      drafts.map((draft) => ({
        exerciseName: draft.exerciseName,
        setNumber: draft.setNumber,
        reps: draft.reps,
        loadValue: 40,
        loadUnit: "lb" as const,
        logMode: draft.logMode,
        durationSeconds: draft.durationSeconds,
        completed: true,
        prescriptionKey: addedPrescriptionKey({
          exerciseName: draft.exerciseName,
          reps: draft.prescriptionReps,
          restSeconds: draft.restSeconds,
        }),
        rir: "0-2 RIR",
      })),
    );
    const saved = await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: session.title,
      performedAt: session.performedAt,
      notes: "",
      status: "complete",
      sets: inserted.map((set) => {
        const mode = resolveLogMode({ logMode: set.logMode, name: set.exerciseName });
        const timed = isDurationMode(mode);
        const marker =
          set.exerciseName === "Goblet squat"
            ? { reps: 6, loadValue: 40, durationSeconds: null as number | null }
            : set.exerciseName === first && set.setNumber === 1
              ? timed
                ? { reps: null, loadValue: null, durationSeconds: 30 }
                : { reps: 5, loadValue: 100, durationSeconds: null }
              : set.exerciseName === second && set.setNumber === 1
                ? timed
                  ? { reps: null, loadValue: null, durationSeconds: 20 }
                  : { reps: 5, loadValue: 50, durationSeconds: null }
                : { reps: null, loadValue: null, durationSeconds: null };
        const logged = marker.reps != null || marker.loadValue != null || (marker.durationSeconds ?? 0) > 0;
        return {
          exerciseName: set.exerciseName,
          setNumber: set.setNumber,
          reps: marker.reps,
          loadValue: marker.loadValue,
          loadUnit: "lb" as const,
          logMode: isLogMode(set.logMode) ? set.logMode : undefined,
          durationSeconds: marker.durationSeconds,
          completed: logged,
          prescriptionKey: set.prescriptionKey,
          rir: set.rir,
        };
      }),
    });

    expect(exerciseNamesInOrder(saved.sets)).toEqual([first, "Goblet squat", ...names.slice(1)]);
    const emptyRows = saved.sets.filter(
      (set) => !set.completed && set.reps == null && set.loadValue == null && (set.durationSeconds ?? 0) <= 0,
    );
    expect(emptyRows.length).toBeGreaterThan(0);
    expect(sessionVolume(emptyRows, "lb")).toBe(0);
    const gobletVolume = sessionVolume(
      saved.sets.filter((set) => set.exerciseName === "Goblet squat"),
      "lb",
    );
    expect(gobletVolume).toBe(4 * 6 * 40);
    const total = sessionVolume(saved.sets, "lb");
    expect(total).toBe(gobletVolume + sessionVolume(
      saved.sets.filter((set) => set.exerciseName !== "Goblet squat"),
      "lb",
    ));

    const history = await listWorkoutSessionsForUser(user.id);
    const shown = loggedExerciseNamesInOrder(history[0]!.sets);
    expect(shown).toEqual([first, "Goblet squat", second]);
    const storedOnlyEmpty = exerciseNamesInOrder(emptyRows).filter((name) => !shown.includes(name));
    expect(storedOnlyEmpty.length).toBeGreaterThan(0);
    expect(exerciseNamesInOrder(history[0]!.sets).length).toBeGreaterThan(3);
    const progress = buildProgressSummary(history, "lb");
    expect(progress.points[0]?.volume).toBe(total);
    expect(progress.points[0]?.setCount).toBeLessThan(history[0]!.sets.length);
    expect(progress.exerciseBests.some((best) => best.exerciseName === "Goblet squat")).toBe(true);

    const without = removeExerciseSets(saved.sets, "Goblet squat");
    const trimmed = await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: session.title,
      performedAt: session.performedAt,
      notes: "",
      status: "complete",
      sets: without.map((set) => ({
        exerciseName: set.exerciseName,
        setNumber: set.setNumber,
        reps: set.reps,
        loadValue: set.loadValue,
        loadUnit: "lb" as const,
        logMode: isLogMode(set.logMode) ? set.logMode : undefined,
        durationSeconds: set.durationSeconds,
        completed: set.completed,
        prescriptionKey: set.prescriptionKey,
        rir: set.rir,
      })),
    });
    expect(exerciseNamesInOrder(trimmed.sets)).toEqual(names);
    expect(sessionVolume(trimmed.sets, "lb")).toBe(total - gobletVolume);
  });
});
