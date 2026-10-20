import { describe, expect, it } from "vitest";
import { demoStrengthDays } from "@/lib/demo-week-seed";
import { fallbackLogMode, plannedSetLine } from "@/lib/exercise-log-mode";
import { DEMO_FORM_VIDEOS } from "@/lib/form-videos";
import { isGppStrengthDay, STRENGTH_DAY_BY_BLOCK, weekInBlock } from "@/lib/mesocycle";
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

  it("runs 6 exercises of 4 sets on Monday, Tuesday, and Thursday", () => {
    for (const block of Object.values(STRENGTH_DAY_BY_BLOCK)) {
      for (const dayNumber of [block.monday, block.tuesday, block.thursday]) {
        const rows = exercisesFor(dayNumber);
        expect(rows).toHaveLength(6);
        for (const row of rows) expect(row.sets, row.name).toBe(4);
      }
    }
    expect(days.find((day) => day.dayNumber === 2)?.title).toBe("Lift 2 — Full body");
    expect(isGppStrengthDay(10)).toBe(false);
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

  it("keeps Monday and Tuesday on different full-body menus", () => {
    for (const block of Object.values(STRENGTH_DAY_BY_BLOCK)) {
      const monday = exercisesFor(block.monday).map((row) => row.name);
      const tuesday = exercisesFor(block.tuesday).map((row) => row.name);
      expect(monday.join("|")).not.toBe(tuesday.join("|"));
      expect(monday).toContain("Dumbbell bench press");
      expect(monday.filter((name) => name === "Dumbbell bench press")).toHaveLength(1);
      expect(tuesday.some((name) => name === "Dumbbell bench press")).toBe(false);
      expect(monday.some((name) => /trap-bar|pause goblet|walking lunge/i.test(name))).toBe(true);
    }
  });

  it("does not repeat the Monday main lift on Tuesday", () => {
    for (const block of Object.values(STRENGTH_DAY_BY_BLOCK)) {
      const monday = exercisesFor(block.monday).map((row) => row.name).join(" | ");
      const tuesday = exercisesFor(block.tuesday).map((row) => row.name).join(" | ");
      const thursday = exercisesFor(block.thursday).map((row) => row.name).join(" | ");
      expect(tuesday).not.toMatch(/trap-bar deadlift|pause goblet squat|walking lunge/i);
      expect(thursday).not.toMatch(/dumbbell bench press/i);
      expect(monday).toMatch(/dumbbell bench press/i);
    }
  });

  it("uses the written week dose, one bilateral bench, and a long rest", () => {
    expect(weekInBlock(0)).toBe(1);
    expect(weekInBlock(2)).toBe(3);
    const monday = exercisesFor(1);
    const bench = monday.find((row) => row.name === "Dumbbell bench press");
    expect(monday.filter((row) => row.name === "Dumbbell bench press")).toHaveLength(1);
    expect(monday.some((row) => row.name === "Single-arm dumbbell bench press")).toBe(false);
    expect(bench?.restSeconds).toBe(120);
    expect(bench?.formVideoUrl).toMatch(/O7ECGhZj_Hc/);
    expect(DEMO_FORM_VIDEOS["Single-arm dumbbell bench press"]?.url).toMatch(/qFTnmyC-nf4/);
    expect(DEMO_FORM_VIDEOS["Dumbbell bench press"]?.url).toMatch(/O7ECGhZj_Hc/);

    const trap = monday.find((row) => row.name === "Trap-bar deadlift")!;
    const heavy = scaleExercise(trap, {
      band: "intermediate",
      programSlug: "demo-strength-base",
      dayNumber: 1,
      weekIndex: 2,
    });
    expect(heavy.sets).toBe(4);
    expect(heavy.reps).toBe("3");
    expect(rirFromLoadText(heavy.loadText)).toBe("0-1 RIR");
    expect(heavy.loadText).toMatch(/back off/i);
    expect(heavy.restSeconds).toBe(150);
    expect(heavy.notes).not.toMatch(/@@weeks/);

    const thursday = exercisesFor(11).find((row) => row.name === "Single-leg RDL")!;
    const light = scaleExercise(thursday, {
      band: "intermediate",
      programSlug: "demo-strength-base",
      dayNumber: 11,
      weekIndex: 2,
    });
    expect(rirFromLoadText(light.loadText)).toBe("2 RIR");
    expect(light.restSeconds).toBeGreaterThanOrEqual(75);

    const suitcase = exercisesFor(11).find((row) => row.name === "Suitcase carry");
    expect(suitcase?.reps).toBe("30 meters / side");
    expect(percentFromLoadText(suitcase?.loadText)).toMatch(/bodyweight/i);
  });
});
