import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  prescriptionLogsTimeAndDistance,
  targetInputPlaceholder,
} from "@/lib/exercise-log-mode";
import { libraryExercise } from "@/lib/exercise-library";
import { mergeReplacementSets } from "@/lib/exercise-swap-store";
import { gymExerciseKey } from "@/lib/gym-exercise";
import { addedPrescriptionKey, draftsForLibraryExercise } from "@/lib/logger-insert";
import { restoreLoggerSets } from "@/lib/logger-sets";
import { copyPreviousOntoExercise } from "@/lib/logger-prefill";
import { withTickedPlanWork } from "@/lib/logged-work";
import { prescriptionSlotKey } from "@/lib/prescription-slot";

describe("logged set inputs stay empty", () => {
  it("shows the plan as a grey placeholder number, not a logged value", () => {
    expect(targetInputPlaceholder("reps", "5")).toBe("5");
    expect(targetInputPlaceholder("reps", "8 / leg")).toBe("8");
    expect(targetInputPlaceholder("reps", "30 sec")).toBe("");
    expect(targetInputPlaceholder("seconds", "30 sec")).toBe("30");
    expect(targetInputPlaceholder("seconds", "20 sec / side")).toBe("20");
    expect(targetInputPlaceholder("seconds", "30 m")).toBe("");
    expect(targetInputPlaceholder("distance", "30 m")).toBe("30");
    expect(targetInputPlaceholder("seconds", "30 sec · 20 m")).toBe("30");
    expect(targetInputPlaceholder("distance", "30 sec · 20 m")).toBe("20");
    expect(prescriptionLogsTimeAndDistance("30 sec · 20 m")).toBe(true);
    expect(prescriptionLogsTimeAndDistance("30 m")).toBe(false);
    expect(prescriptionLogsTimeAndDistance("30 sec")).toBe(false);
  });

  it("does not prefill a library add, a new set, or a swap", () => {
    const goblet = libraryExercise("Goblet squat")!;
    const plank = libraryExercise("Front plank")!;
    const carry = libraryExercise("Overhead kettlebell carry")!;
    expect(draftsForLibraryExercise([], goblet).every((row) => row.reps == null && row.durationSeconds == null)).toBe(
      true,
    );
    expect(draftsForLibraryExercise([], goblet)[0]?.prescriptionReps).toBe("6");
    expect(
      draftsForLibraryExercise([], plank).every((row) => row.reps == null && row.durationSeconds == null),
    ).toBe(true);
    expect(draftsForLibraryExercise([], plank)[0]?.prescriptionReps).toBe("30 sec");
    expect(
      draftsForLibraryExercise([], carry).every((row) => row.reps == null && row.durationSeconds == null),
    ).toBe(true);

    const form = fs.readFileSync(path.join(process.cwd(), "src/components/training/WorkoutLogForm.tsx"), "utf8");
    const addSet = form.slice(form.indexOf("function addSet"), form.indexOf("function bikeRideElapsed"));
    expect(addSet).toContain("reps: null");
    expect(addSet).toContain("loadValue: null");
    expect(addSet).toContain("durationSeconds: null");
    expect(addSet).not.toContain("group[0]?.reps");
    expect(addSet).not.toContain("group[0]?.durationSeconds");
    expect(addSet).not.toContain("group[0]?.loadValue");

    const swapped = mergeReplacementSets(
      [1, 2].map((setNumber) => ({
        exerciseName: "Farmer carry",
        setNumber,
        reps: 8,
        loadValue: 50,
        loadUnit: "lb" as const,
        logMode: "load_timed" as const,
        durationSeconds: 40,
        completed: true,
      })),
      ["Farmer carry"],
      { name: "Zercher carry", sets: 3, reps: "30 sec", loadText: "", logMode: "load_timed" },
      { programSlug: "demo", dayNumber: 1, loadUnit: "lb" },
    ).filter((set) => set.exerciseName === "Zercher carry");
    expect(swapped.every((set) => set.reps == null && set.loadValue == null && set.durationSeconds == null)).toBe(
      true,
    );
  });

  it("keeps a typed draft and does not treat a tick as a typed plan", () => {
    const key = prescriptionSlotKey({
      exerciseName: "Goblet squat",
      reps: "6",
      programSlug: "demo",
      dayNumber: 1,
    });
    const server = [1, 2, 3].map((setNumber) => ({
      exerciseName: "Goblet squat",
      setNumber,
      reps: null as number | null,
      loadValue: null as number | null,
      durationSeconds: null as number | null,
      completed: false,
      prescriptionKey: key,
      logMode: "load_reps",
    }));
    const restored = restoreLoggerSets(
      server,
      {
        sets: [
          {
            exerciseName: "Goblet squat",
            setNumber: 1,
            reps: 8,
            loadValue: 40,
            durationSeconds: null,
            completed: true,
            prescriptionKey: key,
            logMode: "load_reps",
          },
        ],
      },
      [{ name: "Goblet squat", sets: 3 }],
      (exerciseName, setNumber) => ({
        exerciseName,
        setNumber,
        reps: null,
        loadValue: null,
        durationSeconds: null,
        completed: false,
        prescriptionKey: key,
        logMode: "load_reps",
      }),
      gymExerciseKey,
    );
    expect(restored.find((set) => set.setNumber === 1)).toMatchObject({ reps: 8, loadValue: 40 });
    expect(restored.filter((set) => set.setNumber !== 1).every((set) => set.reps == null && set.loadValue == null)).toBe(
      true,
    );
    expect(
      withTickedPlanWork({
        exerciseName: "Goblet squat",
        setNumber: 2,
        reps: null,
        loadValue: null,
        loadUnit: "lb",
        logMode: "load_reps",
        durationSeconds: null,
        completed: true,
        prescriptionKey: key,
      }),
    ).toMatchObject({ reps: null, loadValue: null, durationSeconds: null });
  });

  it("copies a previous session only when Same as last is used", () => {
    const copied = copyPreviousOntoExercise(
      [
        {
          exerciseName: "Goblet squat",
          setNumber: 1,
          reps: null,
          loadValue: null,
          durationSeconds: null,
        },
      ],
      "Goblet squat",
      { "Goblet squat": { 1: { reps: 8, loadValue: 40, loadUnit: "lb", durationSeconds: null } } },
    );
    expect(copied[0]).toMatchObject({ reps: 8, loadValue: 40 });
    const added = addedPrescriptionKey({ exerciseName: "Goblet squat", reps: "6", restSeconds: 90 });
    expect(added.startsWith("added|")).toBe(true);
  });
});
