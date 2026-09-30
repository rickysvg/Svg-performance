import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
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
    expect(scaleCopy("advanced", 1)).toMatch(/60 min bag/i);
    expect(scaleCopy("advanced", 2)).not.toMatch(/60 min bag/i);
    expect(scaleCopy("beginner")).toMatch(/beginner pacing/i);
  });

  it("gives beginners ~2:30 bag rounds and 60s rest", () => {
    expect(SKILL_ROUND_SECONDS.beginner[1]).toBe(150);
    expect(SKILL_ROUND_SECONDS.beginner[6]).toBe(150);
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
    expect(round.reps).toBe("2:30");
    expect(round.restSeconds).toBe(60);
    expect(round.sets).toBe(7);
  });

  it("gives advanced / pro 3 min bag rounds, 60-min Mon/Wed/Fri, and longer optional day-6 clocks", () => {
    expect(SKILL_ROUND_SECONDS.advanced[1]).toBe(180);
    expect(SKILL_ROUND_SECONDS.advanced[2]).toBe(180);
    expect(SKILL_ROUND_SECONDS.advanced[6]).toBe(300);
    expect(SKILL_REST_SECONDS.advanced[1]).toBe(45);
    expect(SKILL_REST_SECONDS.advanced[6]).toBe(45);
    expect(SKILL_ROUND_COUNTS.advanced[1]).toBe(14);
    expect(SKILL_ROUND_COUNTS.advanced[2]).toBe(10);
    expect(SKILL_ROUND_COUNTS.advanced[3]).toBe(14);
    expect(SKILL_ROUND_COUNTS.advanced[5]).toBe(14);
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
    expect(power.restSeconds).toBe(45);
    expect(power.sets).toBe(14);
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
    expect(tue.sets).toBe(10);
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
    expect(optional.reps).toBe("5:00");
    expect(optional.restSeconds).toBe(45);
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
    expect(intermediate.restSeconds).toBeLessThan(beginner.restSeconds);
    expect(advanced.sets).toBe(5);
    expect(advanced.reps).toBe("5–6");
    expect(advanced.loadText).toMatch(/heavy/i);
    expect(advanced.restSeconds).toBe(45);

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
    expect(plank.sets).toBe(4);
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
    expect(advancedCarry.sets).toBe(4);
    expect(advancedCarry.reps).toBe("40–50 sec");
    expect(advancedCarry.loadText).toMatch(/heavy/i);
  });
});

describe("scaled DEMO days in the database", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("tags plank as timed and bag work as timed rounds", async () => {
    const strength = await getDemoProgram();
    const skill = await findSkillProgram();
    const plank = strength.days[0]?.exercises.find((row) => row.name === "Front plank");
    expect(plank?.logMode).toBe("timed");
    expect(plank?.loadText).toMatch(/hold/i);
    const bag = skill?.days[0]?.exercises.find((row) => /jab/i.test(row.name));
    expect(bag?.logMode).toBe("timed_round");
    expect(bag?.reps).toMatch(/2:00/);
    expect(bag?.restSeconds).toBe(90);
  });

  it("reserves load_reps for weighted DEMO strength lifts only", async () => {
    const strength = await getDemoProgram();
    const skill = await findSkillProgram();
    const modes = Object.fromEntries(
      strength.days.flatMap((day) => day.exercises.map((row) => [row.name, row.logMode])),
    );
    expect(modes["Goblet squat"]).toBe("load_reps");
    expect(modes["Romanian deadlift"]).toBe("load_reps");
    expect(modes["Reverse lunge"]).toBe("load_reps");
    expect(modes["Push-up or dumbbell bench press"]).toBe("load_reps");
    expect(modes["One-arm row"]).toBe("load_reps");
    expect(modes["Overhead press"]).toBe("load_reps");
    expect(modes["Farmer carry"]).toBe("load_timed");
    expect(modes["Kettlebell swing or hip hinge"]).toBe("load_reps");
    expect(modes["Band pull-apart or face pull"]).toBe("reps_only");
    expect(modes["Chin-up, band-assist, or lat pulldown"]).toBe("reps_only");
    expect(modes["Front plank"]).toBe("timed");
    expect(modes["Side plank"]).toBe("timed");
    expect(modes["Assault bike intervals"]).toBe("timed_round");
    expect(modes["Daru alactic power bike"]).toBe("timed_round");
    expect(modes["Trap-bar deadlift"]).toBe("load_reps");
    expect(modes["Floor press"]).toBe("load_reps");
    expect(modes["Landmine press"]).toBe("load_reps");
    expect(modes["Rotational med-ball throw"]).toBe("load_reps");
    expect(modes["Med-ball chest pass"]).toBe("load_reps");
    expect(modes["Farmer's carry"]).toBe("load_timed");
    expect(modes["Sled push"]).toBe("timed");
    expect(modes["Sled hamstring drag"]).toBe("timed");
    expect(modes["Banded kettlebell swing"]).toBe("timed");
    expect(modes["Neck isometric matrix"]).toBe("timed");
    const counts = Object.values(modes).reduce(
      (acc, mode) => {
        acc[mode] = (acc[mode] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    expect(counts.load_reps).toBeGreaterThan(8);
    expect(counts.timed_round).toBeGreaterThanOrEqual(6);
    expect(counts.timed).toBeGreaterThan(3);
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

  it("starts more plank sets and shorter rest for an advanced member", async () => {
    const user = await makeUser("adv-scale@example.com");
    const strength = await getDemoProgram();
    const day = strength.days[0];
    const beginner = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      scale: { experienceLevel: "beginner" },
    });
    const advanced = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      scale: { experienceLevel: "advanced", competitionStatus: "pro" },
    });
    const beginnerPlank = beginner.sets.filter((set) => set.exerciseName === "Front plank");
    const advancedPlank = advanced.sets.filter((set) => set.exerciseName === "Front plank");
    expect(beginnerPlank).toHaveLength(3);
    expect(advancedPlank).toHaveLength(4);
    expect(beginnerPlank[0]?.logMode).toBe("timed");
    expect(advancedPlank[0]?.logMode).toBe("timed");
    expect(advancedPlank[0]?.durationSeconds).toBeNull();
    expect(advancedPlank[0]?.reps).toBeNull();
    expect(advancedPlank[0]?.loadValue).toBeNull();

    const scaled = scaleProgramDay(
      { ...day, exercises: day.exercises },
      { band: "advanced", programSlug: "demo-strength-base" },
    );
    expect(scaled.focus).toMatch(/advanced \/ competition/i);
    expect(scaled.exercises.find((row) => row.name === "Goblet squat")?.sets).toBe(5);
  });
});
