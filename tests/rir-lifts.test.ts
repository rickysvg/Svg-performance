import { describe, expect, it } from "vitest";
import { demoStrengthDays } from "@/lib/demo-week-seed";
import { fallbackLogMode, plannedSetLine } from "@/lib/exercise-log-mode";
import { isGppStrengthDay, STRENGTH_DAY_BY_BLOCK } from "@/lib/mesocycle";
import { mergeLoadText, percentFromLoadText, rirFromLoadText } from "@/lib/rir";
import { scaleExercise } from "@/lib/training-scale";

describe("RIR prescription line", () => {
  it("shows sets × reps @ RIR, an optional percent, and rest between sets", () => {
    expect(
      plannedSetLine({
        sets: 4,
        reps: "5",
        restSeconds: 90,
        logMode: "load_reps",
        name: "Goblet squat",
        loadText: "0-2 RIR · ~80% of a 5-rep max · Own the bottom.",
      }),
    ).toBe("4 sets × 5 @ 0-2 RIR (~80% of a 5-rep max), 90s rest between sets");
  });

  it("keeps a lift line unchanged when no RIR cue is stored", () => {
    expect(plannedSetLine({ sets: 4, reps: "8", restSeconds: 90, logMode: "load_reps" })).toBe(
      "4 sets × 8, 90s rest",
    );
  });

  it("puts RIR on a loaded carry without hiding the clock", () => {
    expect(
      plannedSetLine({
        sets: 3,
        reps: "40 sec",
        restSeconds: 90,
        logMode: "load_timed",
        name: "Farmer carry",
        loadText: "2-3 RIR · Heavy enough that you could walk a little farther.",
      }),
    ).toBe("3 × 40s @ 2-3 RIR, 90s rest between sets");
  });

  it("keeps an RIR cue when an advanced scaler rewrites the note", () => {
    const scaled = scaleExercise(
      {
        name: "Goblet squat",
        sets: 4,
        reps: "6",
        loadText: "0-2 RIR · ~80% of a 5-rep max · Own the bottom.",
        restSeconds: 120,
        logMode: "load_reps",
      },
      { band: "advanced", programSlug: "demo-strength-base" },
    );
    expect(rirFromLoadText(scaled.loadText)).toBe("0-2 RIR");
    expect(percentFromLoadText(scaled.loadText)).toMatch(/5-rep max/);
    expect(mergeLoadText("0-2 RIR · note", "Heavy hinge")).toMatch(/^0-2 RIR/);
  });
});

describe("harder fighter lift days", () => {
  const days = demoStrengthDays();

  function exercisesFor(dayNumber: number) {
    const day = days.find((row) => row.dayNumber === dayNumber);
    expect(day, `day ${dayNumber}`).toBeTruthy();
    return day!.exercises.create;
  }

  it("runs 8 exercises Mon–Thu and at least 7 on Friday", () => {
    for (const day of days) {
      const count = day.exercises.create.length;
      if (isGppStrengthDay(day.dayNumber)) {
        expect(count, day.title).toBeGreaterThanOrEqual(7);
      } else {
        expect(count, day.title).toBe(8);
      }
    }
  });

  it("stores an RIR cue on every loaded or counted lift", () => {
    for (const day of days) {
      for (const exercise of day.exercises.create) {
        const mode = fallbackLogMode(exercise.name, exercise.reps);
        if (mode === "load_reps" || mode === "reps_only" || mode === "load_timed") {
          expect(rirFromLoadText(exercise.loadText), exercise.name).toBeTruthy();
        }
      }
    }
  });

  it("keeps Monday and Wednesday on different lifts in every block", () => {
    for (const block of Object.values(STRENGTH_DAY_BY_BLOCK)) {
      const monday = exercisesFor(block.monday).map((row) => row.name);
      const wednesday = exercisesFor(block.wednesday).map((row) => row.name);
      expect(monday.join("|")).not.toBe(wednesday.join("|"));
      expect(monday.some((name) => /squat|lunge|deadlift/i.test(name))).toBe(true);
      expect(wednesday.some((name) => /press|push-up/i.test(name))).toBe(true);
      expect(monday.some((name) => /bench|overhead press|push-up/i.test(name))).toBe(false);
      expect(wednesday.some((name) => /goblet|lunge|trap-bar|chin-up/i.test(name))).toBe(false);
    }
  });

  it("does not repeat the same primary pattern on back-to-back lift days", () => {
    for (const block of Object.values(STRENGTH_DAY_BY_BLOCK)) {
      const order = [block.monday, block.tuesday, block.wednesday, block.thursday, block.friday];
      const names = order.map((dayNumber) => exercisesFor(dayNumber).map((row) => row.name).join(" | "));
      expect(names[1]).not.toMatch(/goblet|trap-bar|walking lunge|reverse lunge/i);
      expect(names[2]).not.toMatch(/chin-up|one-arm row|high pull|goblet|trap-bar/i);
      expect(names[3]).not.toMatch(/bench|overhead press|floor press|chin-up/i);
      expect(names[4]).not.toMatch(/goblet|bench press|overhead press|one-arm row/i);
    }
  });
});
