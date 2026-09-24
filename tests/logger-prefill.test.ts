import { describe, expect, it } from "vitest";
import {
  applyPreviousToEmptySet,
  copyPreviousOntoExercise,
  restTimerAfterSetDone,
  seedSetsFromPrevious,
} from "@/lib/logger-prefill";
import type { PreviousSetLookup } from "@/lib/workouts";

const previous: PreviousSetLookup = {
  "Goblet squat": {
    1: { reps: 8, loadValue: 40, loadUnit: "lb", durationSeconds: null },
    2: { reps: 8, loadValue: 45, loadUnit: "lb", durationSeconds: null },
  },
  "Mount hold": {
    1: { reps: null, loadValue: null, loadUnit: "lb", durationSeconds: 30 },
  },
};

describe("logger prefill and Done → rest", () => {
  it("seeds empty set inputs from Previous values", () => {
    const seeded = seedSetsFromPrevious(
      [
        {
          exerciseName: "Goblet squat",
          setNumber: 1,
          reps: null,
          loadValue: null,
          durationSeconds: null,
        },
        {
          exerciseName: "Goblet squat",
          setNumber: 2,
          reps: null,
          loadValue: null,
          durationSeconds: null,
        },
        {
          exerciseName: "Mount hold",
          setNumber: 1,
          reps: null,
          loadValue: null,
          durationSeconds: null,
        },
      ],
      previous,
    );
    expect(seeded[0]).toMatchObject({ reps: 8, loadValue: 40 });
    expect(seeded[1]).toMatchObject({ reps: 8, loadValue: 45 });
    expect(seeded[2]).toMatchObject({ durationSeconds: 30 });
  });

  it("does not overwrite values the athlete already typed", () => {
    const kept = applyPreviousToEmptySet(
      {
        exerciseName: "Goblet squat",
        setNumber: 1,
        reps: 10,
        loadValue: 50,
        durationSeconds: null,
      },
      previous,
    );
    expect(kept.reps).toBe(10);
    expect(kept.loadValue).toBe(50);
  });

  it("copies previous onto an exercise for Same as last", () => {
    const copied = copyPreviousOntoExercise(
      [
        {
          exerciseName: "Goblet squat",
          setNumber: 1,
          reps: 1,
          loadValue: 1,
          durationSeconds: null,
        },
        {
          exerciseName: "Mount hold",
          setNumber: 1,
          reps: null,
          loadValue: null,
          durationSeconds: 12,
        },
      ],
      "Goblet squat",
      previous,
    );
    expect(copied[0]).toMatchObject({ reps: 8, loadValue: 40 });
    expect(copied[1].durationSeconds).toBe(12);
  });

  it("starts that exercise rest timer when a set is marked Done", () => {
    const now = 5_000;
    const timer = restTimerAfterSetDone({
      completed: true,
      exerciseName: "Goblet squat",
      restSeconds: 45,
      nowMs: now,
    });
    expect(timer).toMatchObject({
      exerciseName: "Goblet squat",
      durationSeconds: 45,
      endsAtMs: now + 45_000,
    });
    expect(
      restTimerAfterSetDone({
        completed: false,
        exerciseName: "Goblet squat",
        restSeconds: 45,
        nowMs: now,
      }),
    ).toBeNull();
    expect(
      restTimerAfterSetDone({
        completed: true,
        exerciseName: "Jump rope",
        restSeconds: 0,
        nowMs: now,
      }),
    ).toBeNull();
  });
});
