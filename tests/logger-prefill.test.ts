import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  copyPreviousOntoExercise,
  restTimerAfterSetDone,
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
  it("does not auto-seed empty sets; Same as last is the only copy path", () => {
    const prefill = fs.readFileSync(
      path.join(process.cwd(), "src/lib/logger-prefill.ts"),
      "utf8",
    );
    const form = fs.readFileSync(
      path.join(process.cwd(), "src/components/training/WorkoutLogForm.tsx"),
      "utf8",
    );
    expect(prefill).not.toContain("seedSetsFromPrevious");
    expect(prefill).not.toContain("applyPreviousToEmptySet");
    expect(form).not.toContain("seedSetsFromPrevious");
    expect(form).toContain("copyPreviousOntoExercise");
    expect(form).toContain("Same as last");
    expect(form).toContain("previousSetLabel");
    expect(form).toContain(">Previous<");
    expect(form).toContain("targetInputPlaceholder");
    expect(form).toContain("placeholder:text-muted");
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
