import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { demoStrengthDays } from "@/lib/demo-week-seed";
import { getDemoProgram, findSkillProgram } from "@/lib/programs";
import { startWorkoutFromDay } from "@/lib/workouts";
import {
  SKILL_REST_SECONDS,
  SKILL_ROUND_COUNTS,
  SKILL_ROUND_SECONDS,
  scaleBandFromPrefs,
  scaleCopy,
  scaleExercise,
  scaleProgramDay,
} from "@/lib/training-scale";

describe("training scale bands", () => {
  it("treats advanced or pro (and non-beginner amateur) as the hard band", () => {
    expect(scaleBandFromPrefs({ experienceLevel: "beginner" })).toBe("beginner");
    expect(scaleBandFromPrefs({ experienceLevel: "intermediate" })).toBe("intermediate");
    expect(scaleBandFromPrefs({ experienceLevel: "advanced" })).toBe("advanced");
    expect(scaleBandFromPrefs({})).toBe("intermediate");
    expect(scaleBandFromPrefs({ experienceLevel: "beginner", competitionStatus: "pro" })).toBe(
      "advanced",
    );
    expect(scaleBandFromPrefs({ experienceLevel: "intermediate", competitionStatus: "amateur" })).toBe(
      "advanced",
    );
    expect(scaleCopy("advanced")).toMatch(/advanced \/ competition/i);
    expect(scaleCopy("advanced", 1)).not.toMatch(/60 min bag/i);
    expect(scaleCopy("advanced", 2)).not.toMatch(/60 min bag/i);
    expect(scaleCopy("beginner")).toMatch(/beginner pacing/i);
  });

  it("gives beginners 3:00 bag rounds and 60s rest", () => {
    expect(SKILL_ROUND_SECONDS.beginner[1]).toBe(180);
    expect(SKILL_ROUND_SECONDS.beginner[6]).toBe(180);
    expect(SKILL_REST_SECONDS.beginner[1]).toBe(60);
    const round = scaleExercise(
      {
        name: "Bag rounds — boxing combos",
        sets: 8,
        reps: "3:00",
        loadText: "Technical",
        restSeconds: 60,
        logMode: "timed_round",
      },
      { band: "beginner", programSlug: "demo-combat-skills", dayNumber: 1 },
    );
    expect(round.reps).toBe("3:00");
    expect(round.restSeconds).toBe(60);
    expect(round.sets).toBe(7);
  });

  it("gives advanced / pro 3 min bag rounds inside a 30–45 minute session", () => {
    expect(SKILL_ROUND_SECONDS.advanced[1]).toBe(180);
    expect(SKILL_ROUND_SECONDS.advanced[2]).toBe(180);
    expect(SKILL_ROUND_SECONDS.advanced[6]).toBe(180);
    expect(SKILL_REST_SECONDS.advanced[1]).toBe(30);
    expect(SKILL_REST_SECONDS.advanced[6]).toBe(30);
    expect(SKILL_ROUND_COUNTS.advanced[1]).toBe(8);
    expect(SKILL_ROUND_COUNTS.advanced[2]).toBe(8);
    expect(SKILL_ROUND_COUNTS.advanced[3]).toBe(8);
    expect(SKILL_ROUND_COUNTS.advanced[5]).toBe(8);
    const power = scaleExercise(
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
    expect(power.reps).toBe("3:00");
    expect(power.restSeconds).toBe(30);
    expect(power.sets).toBe(8);
    const tue = scaleExercise(
      {
        name: "Bag rounds — kicks & teeps",
        sets: 8,
        reps: "3:00",
        loadText: "Technical",
        restSeconds: 60,
        logMode: "timed_round",
      },
      { band: "advanced", programSlug: "demo-combat-skills", dayNumber: 2 },
    );
    expect(tue.sets).toBe(4);
    const optional = scaleExercise(
      {
        name: "Bag rounds — power & speed",
        sets: 3,
        reps: "2:00",
        loadText: "Angle",
        restSeconds: 90,
        logMode: "timed_round",
      },
      { band: "advanced", programSlug: "demo-combat-skills", dayNumber: 6 },
    );
    expect(optional.reps).toBe("3:00");
    expect(optional.restSeconds).toBe(30);
    expect(optional.sets).toBe(8);
  });

  it("hardens DEMO strength for advanced and keeps beginner easier", () => {
    const base = {
      name: "Goblet squat",
      sets: 3,
      reps: "8",
      loadText: "Moderate — last 2 reps should feel honest",
      restSeconds: 90,
      logMode: "load_reps" as const,
    };
    const beginner = scaleExercise(base, { band: "beginner", programSlug: "demo-strength-base" });
    const advanced = scaleExercise(base, { band: "advanced", programSlug: "demo-strength-base" });
    expect(beginner.sets).toBe(3);
    expect(beginner.reps).toBe("8");
    expect(beginner.restSeconds).toBeGreaterThanOrEqual(75);
    const intermediate = scaleExercise(base, {
      band: "intermediate",
      programSlug: "demo-strength-base",
    });
    expect(intermediate.sets).toBe(4);
    expect(intermediate.loadText).toMatch(/last reps should slow/i);
    expect(intermediate.restSeconds).toBeGreaterThanOrEqual(120);
    expect(beginner.restSeconds).toBeGreaterThanOrEqual(120);
    expect(advanced.sets).toBe(4);
    expect(advanced.reps).toBe("5–6");
    expect(advanced.loadText).toMatch(/heavy/i);
    expect(advanced.restSeconds).toBe(120);

    const plank = scaleExercise(
      {
        name: "Front plank",
        sets: 3,
        reps: "30–45 sec",
        loadText: "Hold — no weight",
        restSeconds: 60,
        logMode: "timed",
      },
      { band: "advanced", programSlug: "demo-strength-base" },
    );
    expect(plank.sets).toBe(3);
    expect(plank.reps).toMatch(/45–60/);
    expect(plank.restSeconds).toBe(30);

    const carry = {
      name: "Farmer carry",
      sets: 3,
      reps: "30–40 sec",
      loadText: "Heavy for you, walk tall",
      restSeconds: 90,
      logMode: "load_timed" as const,
    };
    const beginnerCarry = scaleExercise(carry, { band: "beginner", programSlug: "demo-strength-base" });
    const advancedCarry = scaleExercise(carry, { band: "advanced", programSlug: "demo-strength-base" });
    expect(beginnerCarry.logMode).toBe("load_timed");
    expect(beginnerCarry.reps).toBe("30–40 sec");
    expect(advancedCarry.sets).toBe(3);
    expect(advancedCarry.reps).toBe("40–50 sec");
    expect(advancedCarry.loadText).toMatch(/heavy/i);
  });

  it("collapses OR menus into one gym exercise", () => {
    const legacyFace = {
      name: "Band pull-apart or face pull",
      sets: 3,
      reps: "15",
      loadText: "2-4 RIR · Strong band, full squeeze",
      restSeconds: 45,
      logMode: "reps_only" as const,
      notes: "Rear shoulder health for class. Pause at the squeeze.",
    };
    const face = scaleExercise(legacyFace, { band: "advanced", programSlug: "demo-strength-base" });
    expect(face.name).toBe("Face pull");
    expect(face.logMode).toBe("load_reps");
    expect(face.sets).toBe(3);
    expect(face.reps).toBe("15");
    expect(`${face.notes} ${face.loadText}`).not.toMatch(/\bor\b|strong band/i);

    const legacyPull = {
      name: "Chin-up, band-assist, or lat pulldown",
      sets: 4,
      reps: "5–8",
      loadText: "1-3 RIR · Full hang, control the lower.",
      restSeconds: 90,
      logMode: "reps_only" as const,
      notes: "No bar? Slow inverted row or a heavy pulldown. Stop when the chin stops clearing.",
    };
    const pulldown = scaleExercise(legacyPull, {
      band: "intermediate",
      programSlug: "demo-strength-base",
    });
    expect(pulldown.name).toBe("Lat pulldown");
    expect(pulldown.logMode).toBe("load_reps");
    expect(pulldown.notes).toMatch(/chest/i);
    expect(pulldown.notes).not.toMatch(/\bor\b/i);
    const chin = scaleExercise(legacyPull, { band: "beginner", programSlug: "demo-strength-base" });
    expect(chin.name).toBe("Chin-up");
    expect(chin.logMode).toBe("reps_only");
    expect(chin.notes).toMatch(/full hang/i);
    expect(chin.notes).not.toMatch(/\bor\b/i);

    const bench = scaleExercise(
      {
        name: "Push-up or dumbbell bench press",
        sets: 4,
        reps: "6",
        loadText: "0-2 RIR · Last rep is slow and clean.",
        restSeconds: 120,
        logMode: "load_reps",
        notes: "Main press. Chest or floor. Do not bounce the weight off the chest.",
      },
      { band: "beginner", programSlug: "demo-strength-base" },
    );
    expect(bench.name).toBe("Push-up");
    expect(bench.logMode).toBe("reps_only");
    expect(bench.notes).not.toMatch(/\bor\b/i);

    const plyo = scaleExercise(
      {
        name: "Plyo push-up",
        sets: 4,
        reps: "5",
        loadText: "3-5 RIR · Hands leave the floor. Land soft.",
        restSeconds: 45,
        logMode: "reps_only",
        notes: "Explosive push. Elevate the hands if a full plyo is too much. Speed over slop.",
      },
      { band: "advanced", programSlug: "demo-strength-base" },
    );
    expect(plyo.name).toBe("Explosive dumbbell press");
    expect(plyo.logMode).toBe("load_reps");
    expect(plyo.notes).not.toMatch(/elevate the hands/i);

    for (const band of ["beginner", "intermediate", "advanced"] as const) {
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
            { band, programSlug: "demo-strength-base" },
          );
          expect(scaled.name, `${band} ${exercise.name}`).not.toMatch(/\bor\b/i);
        }
      }
    }
  });
});

describe("scaled DEMO days in the database", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("tags the neck hold as timed and bag work as 3:00 rounds", async () => {
    const strength = await getDemoProgram();
    const skill = await findSkillProgram();
    const hold = strength.days
      .find((day) => day.dayNumber === 1)
      ?.exercises.find((row) => row.name === "Neck extension hold");
    expect(hold?.logMode).toBe("timed");
    expect(hold?.loadText).toMatch(/RIR/i);
    const bag = skill?.days[0]?.exercises.find((row) => /bag rounds/i.test(row.name));
    expect(bag?.logMode).toBe("timed_round");
    expect(bag?.reps).toMatch(/3:00/);
    expect(bag?.restSeconds).toBe(60);
  });

  it("reserves load_reps for weighted DEMO strength lifts only", async () => {
    const strength = await getDemoProgram();
    const skill = await findSkillProgram();
    const modes = Object.fromEntries(
      strength.days.flatMap((day) => day.exercises.map((row) => [row.name, row.logMode])),
    );
    expect(modes["Goblet squat"]).toBe("load_reps");
    expect(modes["Dumbbell Romanian deadlift"]).toBe("load_reps");
    expect(modes["Walking lunge"]).toBe("load_reps");
    expect(modes["Dumbbell bench press"]).toBe("load_reps");
    expect(modes["One-arm row"]).toBe("load_reps");
    expect(modes["Overhead press"]).toBe("load_reps");
    expect(modes["Farmer carry"]).toBe("load_timed");
    expect(modes["Lat pulldown"]).toBe("load_reps");
    expect(modes["Neck extension hold"]).toBe("timed");
    expect(modes["Neck isometric matrix"]).toBe("timed");
    expect(modes["Squat jump"]).toBe("reps_only");
    expect(modes["Suitcase carry"]).toBe("load_timed");
    expect(modes["Assault bike intervals"]).toBe("timed_round");
    expect(modes["Daru alactic power bike"]).toBe("timed_round");
    expect(modes["Trap-bar deadlift"]).toBe("load_reps");
    expect(modes["Landmine press"]).toBe("load_reps");
    expect(modes["Rotational med-ball throw"]).toBe("load_reps");
    expect(modes["Cable woodchop"]).toBe("load_reps");
    const counts = Object.values(modes).reduce(
      (acc, mode) => {
        acc[mode] = (acc[mode] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    expect(counts.load_reps).toBeGreaterThan(8);
    expect(counts.timed_round).toBeGreaterThanOrEqual(6);
    expect(counts.timed).toBeGreaterThanOrEqual(2);
    const skillRows = skill?.days.flatMap((day) => day.exercises) ?? [];
    expect(
      skillRows.every(
        (row) =>
          row.logMode === "timed_round" ||
          row.logMode === "timed" ||
          (row.logMode === "load_timed" && /hand weights/i.test(row.name)),
      ),
    ).toBe(true);
    expect(skillRows.some((row) => row.logMode === "load_timed" && /hand weights/i.test(row.name))).toBe(
      true,
    );
    expect(skill?.days.flatMap((day) => day.exercises).some((row) => row.logMode === "load_reps")).toBe(
      false,
    );
  });

  it("opens Monday with the written week dose and does not shorten the bench rest", async () => {
    const user = await makeUser("adv-scale@example.com");
    const strength = await getDemoProgram();
    const day = strength.days.find((row) => row.dayNumber === 1)!;
    const advanced = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      scale: { experienceLevel: "advanced", competitionStatus: "pro" },
    });
    const hold = advanced.sets.filter((set) => set.exerciseName === "Neck extension hold");
    expect(hold).toHaveLength(3);
    expect(hold[0]?.logMode).toBe("timed");
    expect(hold[0]?.durationSeconds).toBeNull();
    expect(hold[0]?.reps).toBeNull();
    expect(hold[0]?.loadValue).toBeNull();

    const scaled = scaleProgramDay(
      { ...day, exercises: day.exercises },
      { band: "advanced", programSlug: "demo-strength-base" },
    );
    expect(scaled.focus).toMatch(/advanced \/ competition/i);
    const bench = scaled.exercises.find((row) => row.name === "Dumbbell bench press");
    expect(bench?.sets).toBe(4);
    expect(bench?.restSeconds).toBe(120);
    expect(bench?.loadText).toMatch(/2-3 RIR/);
    for (const exercise of scaled.exercises) {
      const rows = advanced.sets.filter((set) => set.exerciseName === exercise.name);
      expect(rows, exercise.name).toHaveLength(exercise.sets);
    }
  });
});
