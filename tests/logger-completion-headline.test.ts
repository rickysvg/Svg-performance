import { describe, expect, it } from "vitest";
import { libraryExercise } from "@/lib/exercise-library";
import { omitRemovedSlots, type RemovalRecord } from "@/lib/exercise-removal";
import { applySwapsToExercises, sensiblePrescription, type SwapRecord } from "@/lib/exercise-swap";
import { visibleFinishDose } from "@/lib/finish-plan";
import { draftsForLibraryExercise } from "@/lib/logger-insert";
import { sessionProgress } from "@/lib/session-progress";

const BIKE = "Daru alactic power bike";
const SESSION = "sess-bike";
const BLOCK = "2026-w";

describe("logger completion headline after edits", () => {
  it("counts added sets after a swap and a remove, not the original template", () => {
    const programmed = [
      {
        name: BIKE,
        sets: 1,
        reps: "10s work / 40s rest × 8",
        restSeconds: 0,
        loadText: "All-out sprint / easy — no lbs",
        logMode: "timed_round" as const,
        notes: "",
      },
    ];
    const bench = libraryExercise("Barbell bench press");
    const plank = libraryExercise("Front plank");
    expect(bench?.sets).toBe(4);
    expect(plank?.sets).toBe(3);
    const benchRows = draftsForLibraryExercise([BIKE], bench!);
    const plankRows = draftsForLibraryExercise([BIKE, bench!.name], plank!);
    expect(benchRows).toHaveLength(4);
    expect(plankRows).toHaveLength(3);

    const replacement = sensiblePrescription(programmed[0], "Push-up");
    expect(replacement?.name).toBe("Push-up");
    const swap: SwapRecord = {
      originalName: BIKE,
      replacementName: replacement!.name,
      scope: "session",
      workoutSessionId: SESSION,
      blockKey: BLOCK,
      sets: replacement!.sets,
      reps: replacement!.reps,
      loadText: replacement!.loadText,
      restSeconds: replacement!.restSeconds,
      logMode: replacement!.logMode,
      notes: replacement!.notes,
      retiredNames: [BIKE],
    };
    const swapped = applySwapsToExercises(programmed, [swap], {
      sessionId: SESSION,
      blockKey: BLOCK,
    });
    expect(swapped.map((row) => row.name)).toEqual(["Push-up"]);

    const removal: RemovalRecord = {
      originalName: BIKE,
      exerciseName: "Push-up",
      workoutSessionId: SESSION,
    };
    const shown = omitRemovedSlots(programmed, swapped, [removal], { sessionId: SESSION }).shown;
    expect(shown).toHaveLength(0);

    const sets = [
      ...benchRows.map((row, index) => ({
        exerciseName: row.exerciseName,
        completed: index === 0,
        reps: index === 0 ? 6 : null,
        loadValue: index === 0 ? 135 : null,
        durationSeconds: null,
        logMode: row.logMode,
      })),
      ...plankRows.map((row, index) => ({
        exerciseName: row.exerciseName,
        completed: index === 0,
        reps: null,
        loadValue: null,
        durationSeconds: index === 0 ? 30 : null,
        logMode: row.logMode,
      })),
    ];
    const visible = visibleFinishDose({
      exercises: programmed.map((row) => ({ name: row.name, sets: row.sets })),
      swaps: [swap],
      removals: [removal],
      sessionId: SESSION,
      blockKey: BLOCK,
      catalogDose: 1,
      loggedSets: sets,
    });
    expect(visible.dose).toBe(1);
    expect(visible.names).not.toContain(BIKE);
    expect(visible.names).not.toContain("Push-up");

    const progress = sessionProgress(
      {
        status: "complete",
        programDayId: "bike-day",
        plannedSetCount: 1,
        sets,
      },
      { dose: visible.dose, names: visible.names, exercises: visible.exercises },
    );
    expect(progress.rows.map((row) => `${row.name} ${row.ticked}/${row.planned}`)).toEqual([
      "Barbell bench press 1/4",
      "Front plank 1/3",
    ]);
    expect(progress.text).toBe("2/7 sets · Partial");
    expect(progress.done).toBe(false);
    const count = progress.text.match(/(\d+)\/(\d+)/);
    expect(Number(count?.[1])).toBeLessThanOrEqual(Number(count?.[2]));

    const finished = sets.map((set) =>
      set.exerciseName === "Barbell bench press"
        ? { ...set, completed: true, reps: 6, loadValue: 135 }
        : { ...set, completed: true, durationSeconds: 30 },
    );
    const done = sessionProgress(
      {
        status: "complete",
        programDayId: "bike-day",
        plannedSetCount: 1,
        sets: finished,
      },
      { dose: visible.dose, names: visible.names, exercises: visible.exercises },
    );
    expect(done.text).toBe("7/7 sets · Done");
    expect(done.done).toBe(true);
  });
});
