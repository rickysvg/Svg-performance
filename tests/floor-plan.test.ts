import { describe, expect, it } from "vitest";
import { demoStrengthDays } from "@/lib/demo-week-seed";
import { lookupFormVideo } from "@/lib/form-videos";
import { STRENGTH_DAY_BY_BLOCK } from "@/lib/mesocycle";
import { DEMO_PROGRAM_SLUG, DEMO_SKILL_PROGRAM_SLUG } from "@/lib/programs";
import { rirFromLoadText } from "@/lib/rir";
import { scaleProgramDay, type ScaleableExercise, type ScaleBand } from "@/lib/training-scale";

const GYM_GEAR = /dumbbell|kettlebell|barbell|cable|sled|bench|med-?ball|medicine|landmine|trap-bar|pulldown|machine|\bband\b/i;
const PUSH_UP = /push-?up/i;

function strengthDay(dayNumber: number) {
  const day = demoStrengthDays().find((row) => row.dayNumber === dayNumber);
  if (!day) throw new Error(`missing day ${dayNumber}`);
  return {
    dayNumber: day.dayNumber,
    title: day.title,
    focus: day.focus,
    exercises: day.exercises.create as ScaleableExercise[],
  };
}

function scaled(
  dayNumber: number,
  band: ScaleBand,
  weightAccess: "gym" | "none" = "gym",
  programSlug = DEMO_PROGRAM_SLUG,
) {
  return scaleProgramDay(strengthDay(dayNumber), { band, programSlug, weightAccess });
}

describe("gym press names", () => {
  it("prescribes the dumbbell bench for intermediate and advanced, with no push-up", () => {
    for (const block of Object.values(STRENGTH_DAY_BY_BLOCK)) {
      for (const band of ["intermediate", "advanced"] as const) {
        const day = scaled(block.wednesday, band);
        const blob = day.exercises
          .map((exercise) => `${exercise.name} ${exercise.notes ?? ""} ${exercise.loadText}`)
          .join("\n");
        expect(blob, `${band} day ${block.wednesday}`).not.toMatch(PUSH_UP);
        const bench = day.exercises.find((exercise) => exercise.name === "Dumbbell bench press");
        expect(bench, `${band} bench`).toBeTruthy();
        expect(bench?.logMode).toBe("load_reps");
        expect(rirFromLoadText(bench?.loadText)).toBeTruthy();
        expect(bench?.loadText).not.toMatch(/kg/i);
        expect(day.exercises.some((exercise) => exercise.name === "Explosive dumbbell press")).toBe(
          true,
        );
      }
    }
  });

  it("keeps a push-up on the beginner press day", () => {
    const day = scaled(STRENGTH_DAY_BY_BLOCK.A.wednesday, "beginner");
    const push = day.exercises.find((exercise) => exercise.name === "Push-up");
    expect(push?.logMode).toBe("reps_only");
    expect(rirFromLoadText(push?.loadText)).toBe("2-4 RIR");
    expect(day.exercises.some((exercise) => exercise.name === "Plyo push-up")).toBe(true);
    expect(day.exercises.some((exercise) => /dumbbell bench/i.test(exercise.name))).toBe(false);
  });

  it("still rewrites a hosted row stored under the old or-push-up name", () => {
    const day = scaleProgramDay(
      {
        dayNumber: 3,
        focus: "Press",
        exercises: [
          {
            name: "Push-up or dumbbell bench press",
            sets: 4,
            reps: "6",
            loadText: "0-2 RIR · ~80% of a 5-rep max · Last rep is slow and clean.",
            restSeconds: 120,
            logMode: "load_reps",
            notes: "Main press. Chest or floor. Do not bounce the weight off the chest.",
            formVideoUrl: "",
            formVideoPending: true,
          },
        ],
      },
      { band: "intermediate", programSlug: DEMO_PROGRAM_SLUG, weightAccess: "gym" },
    );
    const bench = day.exercises[0];
    expect(bench?.name).toBe("Dumbbell bench press");
    expect(bench?.notes).not.toMatch(PUSH_UP);
    expect(bench?.loadText).toMatch(/0-2 RIR/);
    expect(lookupFormVideo(bench!.name, day.exercises).url).toMatch(/youtube\.com/);
  });
});

describe("no gym or weights", () => {
  const gearFree = (names: string[]) => {
    for (const name of names) {
      expect(name, name).not.toMatch(GYM_GEAR);
    }
  };

  it("builds a different floor session for each block and weekday job", () => {
    for (const [block, days] of Object.entries(STRENGTH_DAY_BY_BLOCK)) {
      const lower = scaled(days.monday, "intermediate", "none");
      const pull = scaled(days.tuesday, "intermediate", "none");
      const push = scaled(days.wednesday, "intermediate", "none");
      const posterior = scaled(days.thursday, "intermediate", "none");
      const gpp = scaled(days.friday, "intermediate", "none");
      for (const day of [lower, pull, push, posterior, gpp]) {
        expect(day.exercises.length, day.title).toBeGreaterThanOrEqual(6);
        expect(new Set(day.exercises.map((exercise) => exercise.name)).size).toBe(
          day.exercises.length,
        );
        gearFree(day.exercises.map((exercise) => exercise.name));
        expect(day.title).toMatch(/No gym/);
        expect(day.focus).toMatch(new RegExp(`Block ${block}`));
      }
      expect(lower.exercises.some((exercise) => PUSH_UP.test(exercise.name))).toBe(false);
      expect(pull.exercises.some((exercise) => PUSH_UP.test(exercise.name))).toBe(false);
      expect(posterior.exercises.some((exercise) => PUSH_UP.test(exercise.name))).toBe(false);
      expect(push.exercises.filter((exercise) => PUSH_UP.test(exercise.name)).length).toBeGreaterThan(
        1,
      );
      expect(push.exercises.some((exercise) => /pike/i.test(exercise.name))).toBe(true);
      expect(gpp.exercises.filter((exercise) => PUSH_UP.test(exercise.name))).toHaveLength(1);
      expect(gpp.exercises.some((exercise) => /squat|lunge|bridge|bound/i.test(exercise.name))).toBe(
        true,
      );
    }
    const lowerA = scaled(STRENGTH_DAY_BY_BLOCK.A.monday, "advanced", "none")
      .exercises.map((exercise) => exercise.name)
      .join("|");
    const lowerB = scaled(STRENGTH_DAY_BY_BLOCK.B.monday, "advanced", "none")
      .exercises.map((exercise) => exercise.name)
      .join("|");
    const lowerC = scaled(STRENGTH_DAY_BY_BLOCK.C.monday, "advanced", "none")
      .exercises.map((exercise) => exercise.name)
      .join("|");
    expect(lowerA).not.toBe(lowerB);
    expect(lowerB).not.toBe(lowerC);
  });

  it("replaces a bike day with floor sets and leaves bag themes alone", () => {
    const bike = scaleProgramDay(
      {
        dayNumber: 6,
        title: "Jamieson tempo bike",
        focus: "Tempo",
        exercises: [
          {
            name: "Jamieson tempo bike",
            sets: 4,
            reps: "12 sec",
            loadText: "Timed — no lbs",
            restSeconds: 60,
            logMode: "timed_round",
            formVideoUrl: "",
            formVideoPending: false,
          },
        ],
      },
      { band: "intermediate", programSlug: DEMO_PROGRAM_SLUG, weightAccess: "none" },
    );
    expect(bike.title).toMatch(/No gym/);
    expect(bike.exercises.some((exercise) => /bike/i.test(exercise.name))).toBe(false);
    expect(bike.exercises.every((exercise) => exercise.logMode === "reps_only" || exercise.logMode === "timed")).toBe(
      true,
    );

    const bag = scaleProgramDay(
      {
        dayNumber: 1,
        title: "Intelligent jab",
        focus: "Bag",
        exercises: [
          {
            name: "Shadowbox round 2 — hand weights",
            sets: 1,
            reps: "3:00",
            loadText: "1–2 lb hand weights",
            restSeconds: 45,
            logMode: "load_timed",
            formVideoUrl: "",
            formVideoPending: false,
          },
          {
            name: "Bag rounds — intelligent jab",
            sets: 8,
            reps: "3:00",
            loadText: "Round clock",
            restSeconds: 60,
            logMode: "timed_round",
            notes: "R1 Jab. R2 Jab.",
            formVideoUrl: "https://www.youtube.com/watch?v=1wCQLFhipbE",
            formVideoPending: false,
          },
        ],
      },
      { band: "intermediate", programSlug: DEMO_SKILL_PROGRAM_SLUG, weightAccess: "none" },
    );
    expect(bag.exercises.map((exercise) => exercise.name)).toContain("Bag rounds — intelligent jab");
    const shadow = bag.exercises.find((exercise) => /shadow/i.test(exercise.name));
    expect(shadow?.name).toMatch(/no weights/i);
    expect(shadow?.logMode).toBe("timed");
    expect(shadow?.loadText).not.toMatch(/\dlb|\d lb/i);
    const form = lookupFormVideo(shadow!.name, bag.exercises);
    expect(form.omit).toBe(true);
    expect(form.url).toBe("");
  });
});
