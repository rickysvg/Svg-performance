import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { getDemoProgram, findSkillProgram } from "@/lib/programs";
import { startWorkoutFromDay } from "@/lib/workouts";
import {
  SKILL_REST_SECONDS,
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
    expect(scaleBandFromPrefs({ experienceLevel: "beginner", competitionStatus: "pro" })).toBe(
      "advanced",
    );
    expect(scaleBandFromPrefs({ experienceLevel: "intermediate", competitionStatus: "amateur" })).toBe(
      "advanced",
    );
    expect(scaleCopy("advanced")).toMatch(/advanced \/ competition/i);
    expect(scaleCopy("beginner")).toMatch(/beginner pacing/i);
  });

  it("gives beginners 2–2.5 min skill rounds and 90s rest", () => {
    expect(SKILL_ROUND_SECONDS.beginner[1]).toBe(120);
    expect(SKILL_ROUND_SECONDS.beginner[6]).toBe(150);
    expect(SKILL_REST_SECONDS.beginner[1]).toBe(90);
    const round = scaleExercise(
      {
        name: "Jab–cross (1–2)",
        sets: 3,
        reps: "2:00",
        loadText: "Technical",
        restSeconds: 90,
        logMode: "timed_round",
      },
      { band: "beginner", programSlug: "demo-combat-skills", dayNumber: 1 },
    );
    expect(round.reps).toBe("2:00");
    expect(round.restSeconds).toBe(90);
  });

  it("gives advanced / pro 3–5 min rounds and 30–45s rest", () => {
    expect(SKILL_ROUND_SECONDS.advanced[1]).toBe(180);
    expect(SKILL_ROUND_SECONDS.advanced[2]).toBe(240);
    expect(SKILL_ROUND_SECONDS.advanced[6]).toBe(300);
    expect(SKILL_REST_SECONDS.advanced[1]).toBe(30);
    expect(SKILL_REST_SECONDS.advanced[2]).toBe(45);
    const power = scaleExercise(
      {
        name: "Jab–cross (1–2)",
        sets: 3,
        reps: "2:00",
        loadText: "Technical",
        restSeconds: 90,
        logMode: "timed_round",
      },
      { band: "advanced", programSlug: "demo-combat-skills", dayNumber: 1 },
    );
    expect(power.reps).toBe("3:00");
    expect(power.restSeconds).toBe(30);
    const bjj = scaleExercise(
      {
        name: "Closed guard hip tilt",
        sets: 3,
        reps: "2:00",
        loadText: "Angle",
        restSeconds: 90,
        logMode: "timed_round",
      },
      { band: "advanced", programSlug: "demo-combat-skills", dayNumber: 6 },
    );
    expect(bjj.reps).toBe("5:00");
    expect(bjj.restSeconds).toBe(45);
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
    expect(advanced.sets).toBe(4);
    expect(advanced.reps).toBe("8–10");
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
    expect(modes["Farmer carry"]).toBe("load_reps");
    expect(modes["Kettlebell swing or hip hinge"]).toBe("load_reps");
    expect(modes["Band pull-apart or face pull"]).toBe("reps_only");
    expect(modes["Squat jump or box step-up"]).toBe("reps_only");
    expect(modes["Chin-up, band-assist, or lat pulldown"]).toBe("reps_only");
    expect(modes["Lateral bound or side step-over"]).toBe("reps_only");
    expect(modes["Front plank"]).toBe("timed");
    expect(modes["Side plank"]).toBe("timed");
    expect(modes["Jump rope or easy bike intervals"]).toBe("timed");
    expect(
      skill?.days.flatMap((day) => day.exercises).every((row) =>
        row.logMode === "timed_round" || row.logMode === "timed",
      ),
    ).toBe(true);
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
    expect(advancedPlank[0]?.durationSeconds).toBeGreaterThanOrEqual(45);

    const scaled = scaleProgramDay(
      { ...day, exercises: day.exercises },
      { band: "advanced", programSlug: "demo-strength-base" },
    );
    expect(scaled.focus).toMatch(/advanced \/ competition/i);
    expect(scaled.exercises.find((row) => row.name === "Goblet squat")?.sets).toBe(4);
  });
});
