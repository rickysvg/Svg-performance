import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { getDemoProgram } from "@/lib/programs";
import {
  getPreviousLoadsForUser,
  startWorkoutFromDay,
  updateWorkoutSessionForUser,
} from "@/lib/workouts";
import {
  DEMO_EXERCISE_NAMES,
  equipmentForExercise,
  equipmentForExercises,
  exerciseSlug,
  exerciseThumbSrc,
  plannedSetLine,
  previousSetLabel,
  estimateSessionMinutes,
  exerciseCountLabel,
  sessionKindLabel,
} from "@/lib/exercise-media";

describe("workout logger media and previous loads", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("maps every DEMO exercise to a slug, equipment, and square thumb file", () => {
    expect(DEMO_EXERCISE_NAMES).toHaveLength(33);
    for (const name of DEMO_EXERCISE_NAMES) {
      const slug = exerciseSlug(name);
      expect(slug.length).toBeGreaterThan(2);
      expect(exerciseThumbSrc(name)).toBe(`/exercise-thumbs/${slug}.svg`);
      expect(equipmentForExercise(name).length).toBeGreaterThan(0);
      const file = path.join(process.cwd(), "public", "exercise-thumbs", `${slug}.svg`);
      expect(fs.existsSync(file), `missing thumb for ${name}`).toBe(true);
    }
    expect(fs.existsSync(path.join(process.cwd(), "public/exercise-thumbs/fallback.svg"))).toBe(
      true,
    );
  });

  it("builds a coach-friendly planned line and previous label", () => {
    expect(plannedSetLine({ sets: 4, reps: "8", restSeconds: 90, logMode: "load_reps" })).toBe(
      "4 sets × 8, 90s rest",
    );
    expect(
      plannedSetLine({
        sets: 3,
        reps: "30–40 sec",
        restSeconds: 90,
        logMode: "load_timed",
        name: "Farmer carry",
      }),
    ).toBe("3 × 30–40s @ lbs, 90s rest");
    expect(
      plannedSetLine({
        sets: 8,
        reps: "20 sec on / 40 sec easy",
        restSeconds: 0,
        logMode: "timed",
        name: "Jump rope or easy bike intervals",
      }),
    ).toBe("8 sets × 20 sec on / 40 sec easy");
    expect(previousSetLabel(null)).toBe("—");
    expect(previousSetLabel({ reps: 16, loadValue: 80, loadUnit: "lb" })).toBe("16 × 80lb");
    expect(previousSetLabel({ reps: 12, loadValue: null, loadUnit: "lb" })).toBe("12 reps");
    expect(exerciseCountLabel(1)).toBe("1 Exercise");
    expect(exerciseCountLabel(5)).toBe("5 Exercises");
    expect(sessionKindLabel({ title: "Day 3 — Hinge, pull, and conditioning", focus: "work capacity" })).toBe(
      "Conditioning",
    );
    expect(sessionKindLabel({ title: "Day 1 — Lower body + power", focus: "Legs" })).toBe("Strength");
    expect(
      sessionKindLabel({
        title: "Heavy bag — hands to low kicks",
        focus: "Hands first, then low-kick combinations",
      }),
    ).toBe("Skill");
    // 2 × (3 × (40s work + 90s rest) + 30s transition) = 840s → 14 min
    expect(
      estimateSessionMinutes([
        { sets: 3, restSeconds: 90 },
        { sets: 3, restSeconds: 90 },
      ]),
    ).toBe(14);
    expect(estimateSessionMinutes([])).toBe(0);
  });

  it("derives unique equipment chips from a DEMO day", async () => {
    const program = await getDemoProgram();
    const day = program.days[0];
    const chips = equipmentForExercises(day.exercises.map((exercise) => exercise.name));
    expect(chips.map((chip) => chip.id)).toEqual(
      expect.arrayContaining(["dumbbell", "barbell", "bodyweight"]),
    );
    expect(new Set(chips.map((chip) => chip.id)).size).toBe(chips.length);
  });

  it("returns previous loads from the last completed session only for that member", async () => {
    const owner = await makeUser("logger@example.com");
    const other = await makeUser("other-logger@example.com");
    const program = await getDemoProgram();
    const day = program.days[0];

    const first = await startWorkoutFromDay({
      userId: owner.id,
      programDayId: day.id,
      preferredUnits: "lb",
    });
    await updateWorkoutSessionForUser({
      userId: owner.id,
      workoutId: first.id,
      title: first.title,
      performedAt: new Date("2026-09-20T12:00:00Z"),
      notes: "",
      status: "complete",
      sets: [
        {
          exerciseName: "Goblet squat",
          setNumber: 1,
          reps: 8,
          loadValue: 40,
          loadUnit: "lb",
          completed: true,
        },
        {
          exerciseName: "Goblet squat",
          setNumber: 2,
          reps: 8,
          loadValue: 45,
          loadUnit: "lb",
          completed: true,
        },
      ],
    });

    const otherSession = await startWorkoutFromDay({
      userId: other.id,
      programDayId: day.id,
      preferredUnits: "lb",
    });
    await updateWorkoutSessionForUser({
      userId: other.id,
      workoutId: otherSession.id,
      title: otherSession.title,
      performedAt: new Date("2026-09-21T12:00:00Z"),
      notes: "",
      status: "complete",
      sets: [
        {
          exerciseName: "Goblet squat",
          setNumber: 1,
          reps: 99,
          loadValue: 999,
          loadUnit: "lb",
          completed: true,
        },
      ],
    });

    const draft = await startWorkoutFromDay({
      userId: owner.id,
      programDayId: day.id,
      preferredUnits: "lb",
    });

    const previous = await getPreviousLoadsForUser(
      owner.id,
      ["Goblet squat", "Front plank"],
      draft.id,
    );
    expect(previous["Goblet squat"]?.[1]).toEqual({
      reps: 8,
      loadValue: 40,
      loadUnit: "lb",
      logMode: "load_reps",
      durationSeconds: null,
    });
    expect(previous["Goblet squat"]?.[2]).toEqual({
      reps: 8,
      loadValue: 45,
      loadUnit: "lb",
      logMode: "load_reps",
      durationSeconds: null,
    });
    expect(previous["Front plank"]).toBeUndefined();

    const stranger = await getPreviousLoadsForUser(other.id, ["Goblet squat"]);
    expect(stranger["Goblet squat"]?.[1]?.loadValue).toBe(999);
    expect(stranger["Goblet squat"]?.[1]?.loadValue).not.toBe(40);
  });

  it("starts a new session with empty set values (null reps, load, duration)", async () => {
    const user = await makeUser("empty-sets@example.com");
    const program = await getDemoProgram();
    const day = program.days[0];
    const draft = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
    });
    expect(draft.sets.length).toBeGreaterThan(0);
    expect(draft.sets.some((set) => set.exerciseName === "Goblet squat")).toBe(true);
    expect(draft.sets.some((set) => set.exerciseName === "Front plank")).toBe(true);
    for (const set of draft.sets) {
      expect(set.reps, set.exerciseName).toBeNull();
      expect(set.loadValue, set.exerciseName).toBeNull();
      expect(set.durationSeconds, set.exerciseName).toBeNull();
      expect(set.completed, set.exerciseName).toBe(false);
    }
  });

  it("does not save an empty lift as completed or as zero", async () => {
    const user = await makeUser("empty-complete@example.com");
    const program = await getDemoProgram();
    const day = program.days[0];
    const draft = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
    });
    const saved = await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: draft.id,
      title: draft.title,
      performedAt: new Date(),
      notes: "",
      status: "draft",
      sets: [
        {
          exerciseName: "Goblet squat",
          setNumber: 1,
          reps: null,
          loadValue: null,
          loadUnit: "lb",
          logMode: "load_reps",
          durationSeconds: null,
          completed: true,
        },
      ],
    });
    expect(saved.sets[0]?.reps).toBeNull();
    expect(saved.sets[0]?.loadValue).toBeNull();
    expect(saved.sets[0]?.durationSeconds).toBeNull();
    expect(saved.sets[0]?.completed).toBe(false);
  });

  it("starts farmer carry as load_timed with seconds + keeps lbs on save", async () => {
    const user = await makeUser("carry-logger@example.com");
    const program = await getDemoProgram();
    const day = program.days.find((row) => row.dayNumber === 2)!;
    const draft = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
    });
    const carry = draft.sets.filter((set) => set.exerciseName === "Farmer carry");
    const band = draft.sets.filter((set) => set.exerciseName === "Band pull-apart or face pull");
    expect(carry.length).toBeGreaterThan(0);
    expect(carry[0]?.logMode).toBe("load_timed");
    expect(carry[0]?.durationSeconds).toBeNull();
    expect(carry[0]?.loadValue).toBeNull();
    expect(carry[0]?.reps).toBeNull();
    expect(band[0]?.logMode).toBe("reps_only");

    const saved = await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: draft.id,
      title: draft.title,
      performedAt: new Date(),
      notes: "",
      status: "draft",
      sets: [
        {
          exerciseName: "Farmer carry",
          setNumber: 1,
          reps: null,
          loadValue: 70,
          loadUnit: "lb",
          logMode: "load_timed",
          durationSeconds: 40,
          completed: true,
        },
      ],
    });
    expect(saved.sets[0]?.logMode).toBe("load_timed");
    expect(saved.sets[0]?.durationSeconds).toBe(40);
    expect(saved.sets[0]?.loadValue).toBe(70);
    expect(saved.sets[0]?.reps).toBeNull();
  });
});
