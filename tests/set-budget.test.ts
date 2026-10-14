import { describe, expect, it } from "vitest";
import { BAG_ROUND_COUNTS_ADVANCED_LONG } from "@/lib/bag-sessions";
import { floorSessionForDay } from "@/lib/bodyweight-plan";
import { demoStrengthDays } from "@/lib/demo-week-seed";
import { scaleDaruExercise } from "@/lib/daru-exercises";
import { STRENGTH_DAY_BY_BLOCK } from "@/lib/mesocycle";
import { DEMO_PROGRAM_SLUG } from "@/lib/programs";
import {
  ACCESSORY_MAX_SETS,
  exerciseSetRole,
  MAIN_LIFT_MAX_SETS,
} from "@/lib/set-budget";
import { scaleExercise, type ScaleBand } from "@/lib/training-scale";

const bands: ScaleBand[] = ["beginner", "intermediate", "advanced"];

describe("lift set caps", () => {
  it("caps main lifts at 4 and accessories at 3", () => {
    for (const band of bands) {
      for (const day of demoStrengthDays()) {
        for (const exercise of day.exercises.create) {
          const scaled = scaleExercise(
            {
              name: exercise.name,
              sets: exercise.sets,
              reps: exercise.reps,
              loadText: exercise.loadText,
              restSeconds: exercise.restSeconds,
              notes: exercise.notes,
            },
            { band, programSlug: "demo-strength-base", dayNumber: day.dayNumber },
          );
          const role = exerciseSetRole(scaled);
          if (role === "conditioning") continue;
          const cap = role === "main" ? MAIN_LIFT_MAX_SETS : ACCESSORY_MAX_SETS;
          expect(scaled.sets, `${band} day ${day.dayNumber} ${scaled.name}`).toBeLessThanOrEqual(cap);
        }
      }
    }
  });

  it("keeps a 2-set neck matrix at 2 and leaves interval counts alone", () => {
    expect(scaleDaruExercise("Neck isometric matrix", "beginner")?.sets).toBe(2);
    expect(scaleDaruExercise("Neck isometric matrix", "intermediate")?.sets).toBe(2);
    expect(scaleDaruExercise("Sled push", "beginner")?.sets).toBe(4);
    expect(scaleDaruExercise("Sled push", "intermediate")?.sets).toBe(5);
    expect(scaleDaruExercise("Sled push", "advanced")?.sets).toBe(6);
    expect(scaleDaruExercise("Banded kettlebell swing", "intermediate")?.sets).toBe(5);
    expect(scaleDaruExercise("Banded kettlebell swing", "advanced")?.sets).toBe(6);
    expect(scaleDaruExercise("Sled hamstring drag", "advanced")?.sets).toBe(1);

    const rope = scaleExercise(
      {
        name: "Jump rope intervals",
        sets: 6,
        reps: "30 sec on / 30 sec easy",
        loadText: "Smooth — no lbs",
        restSeconds: 0,
      },
      { band: "advanced", programSlug: "demo-strength-base", dayNumber: 21 },
    );
    expect(rope.sets).toBe(10);
    expect(rope.reps).toBe("25 sec on / 35 sec easy");

    const bike = scaleExercise(
      {
        name: "Assault bike intervals",
        sets: 4,
        reps: "15s work / 15s rest × 8",
        loadText: "All-out sprint / easy — no lbs",
        restSeconds: 60,
        logMode: "timed_round",
      },
      { band: "advanced", programSlug: "demo-strength-base", dayNumber: 4 },
    );
    expect(bike.sets).toBe(5);

    const bag = scaleExercise(
      {
        name: "Bag rounds — boxing combos",
        sets: 8,
        reps: "3:00",
        loadText: "Technical",
        restSeconds: 60,
        logMode: "timed_round",
      },
      { band: "advanced", programSlug: "demo-combat-skills", dayNumber: 1 },
    );
    expect(bag.sets).toBe(BAG_ROUND_COUNTS_ADVANCED_LONG);

    const shadow = scaleExercise(
      {
        name: "Shadowbox round 2 — hand weights",
        sets: 1,
        reps: "3:00",
        loadText: "1–3 lb hand weights",
        restSeconds: 45,
        logMode: "load_timed",
      },
      { band: "advanced", programSlug: "demo-combat-skills", dayNumber: 1 },
    );
    expect(shadow.sets).toBe(1);
  });

  it("caps no-gym lifts and leaves the bike substitute volumes", () => {
    const tempo = floorSessionForDay(6, DEMO_PROGRAM_SLUG, "intermediate");
    expect(tempo?.exercises.find((exercise) => exercise.name === "Air squat")?.sets).toBe(8);
    const power = floorSessionForDay(5, DEMO_PROGRAM_SLUG, "advanced");
    expect(power?.exercises.find((exercise) => exercise.name === "Broad jump")?.sets).toBe(6);

    for (const band of bands) {
      for (const days of Object.values(STRENGTH_DAY_BY_BLOCK)) {
        for (const dayNumber of [days.monday, days.tuesday, days.wednesday, days.thursday, days.friday]) {
          const session = floorSessionForDay(dayNumber, DEMO_PROGRAM_SLUG, band);
          for (const exercise of session?.exercises ?? []) {
            const role = exerciseSetRole({
              name: exercise.name,
              loadText: exercise.loadText,
              notes: exercise.notes,
            });
            if (role === "conditioning") continue;
            const cap = role === "main" ? MAIN_LIFT_MAX_SETS : ACCESSORY_MAX_SETS;
            expect(exercise.sets, `${band} floor ${dayNumber} ${exercise.name}`).toBeLessThanOrEqual(cap);
          }
        }
      }
    }
  });

  it("keeps RIR, percent, and rest on a capped advanced squat", () => {
    const day = demoStrengthDays().find((row) => row.dayNumber === 1);
    const goblet = day?.exercises.create.find((exercise) => exercise.name === "Goblet squat");
    const advanced = scaleExercise(
      {
        name: goblet!.name,
        sets: goblet!.sets,
        reps: goblet!.reps,
        loadText: goblet!.loadText,
        restSeconds: goblet!.restSeconds,
        notes: goblet!.notes,
      },
      { band: "advanced", programSlug: "demo-strength-base", dayNumber: 1 },
    );
    expect(goblet?.sets).toBe(4);
    expect(advanced.sets).toBe(4);
    expect(advanced.loadText).toMatch(/0-2 RIR/);
    expect(advanced.loadText).toMatch(/~80% of a 5-rep max/);
    expect(advanced.restSeconds).toBe(45);
    expect(advanced.reps).toBe("5–6");
  });
});
