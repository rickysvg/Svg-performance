import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  BIKE_PROGRAM_DAY_NUMBER,
  BIKE_SESSIONS,
  DEFAULT_BIKE_SESSION,
  bikeIntervalReps,
  bikeSetsForBand,
  bikeWorkSecondsPerSet,
  isBikeIntervalName,
  pickBikeSession,
} from "@/lib/bike-sessions";
import { fallbackLogMode, plannedSetLine } from "@/lib/exercise-log-mode";
import { getDemoProgram } from "@/lib/programs";
import { scaleBandFromPrefs, scaleExercise, scaleProgramDay } from "@/lib/training-scale";
import {
  buildCoreWeekPlan,
  coreSkeletonSessions,
  planForDate,
  resolvePlanSessions,
  weekStrip,
} from "@/lib/week-plan";
import { startWorkoutFromDay } from "@/lib/workouts";
import { makeUser, resetDatabase } from "./helpers";

const tuesday = new Date(2026, 8, 22, 10, 0, 0);
const thursday = new Date(2026, 8, 24, 10, 0, 0);
const monday = new Date(2026, 8, 21, 10, 0, 0);

const MMA_MON_WED_FRI = {
  primaryFocus: "mma",
  weeklyAvailability: ["Monday", "Wednesday", "Friday"],
  sessionsPerWeek: 3,
};

describe("assault bike catalog", () => {
  it("starts the rotation with 15/15 × 8 intervals", () => {
    expect(BIKE_SESSIONS).toHaveLength(1);
    expect(pickBikeSession(0)).toMatchObject({
      id: "intervals-15-15",
      name: "Assault bike intervals",
      workSeconds: 15,
      restSeconds: 15,
      roundsPerSet: 8,
      restBetweenSetsSeconds: 60,
    });
    expect(bikeIntervalReps()).toBe("15s work / 15s rest × 8");
    expect(bikeWorkSecondsPerSet()).toBe(240);
    expect(isBikeIntervalName("Assault bike intervals")).toBe(true);
    expect(isBikeIntervalName("Jump rope or easy bike intervals")).toBe(false);
    expect(fallbackLogMode("Assault bike intervals")).toBe("timed_round");
  });

  it("scales sets by experience: 3 / 4 / 5", () => {
    expect(bikeSetsForBand("beginner")).toBe(3);
    expect(bikeSetsForBand("intermediate")).toBe(4);
    expect(bikeSetsForBand("advanced")).toBe(5);
    expect(scaleBandFromPrefs({ experienceLevel: "advanced", competitionStatus: "pro" })).toBe(
      "advanced",
    );

    const seed = {
      name: DEFAULT_BIKE_SESSION.name,
      sets: 3,
      reps: bikeIntervalReps(),
      loadText: "All-out sprint / easy — no lbs",
      restSeconds: 60,
      logMode: "timed_round" as const,
    };
    const beginner = scaleExercise(seed, { band: "beginner", programSlug: "demo-strength-base" });
    const intermediate = scaleExercise(seed, {
      band: "intermediate",
      programSlug: "demo-strength-base",
    });
    const advanced = scaleExercise(seed, { band: "advanced", programSlug: "demo-strength-base" });
    const pro = scaleExercise(seed, { band: "advanced", programSlug: "demo-strength-base" });

    expect(beginner.sets).toBe(3);
    expect(intermediate.sets).toBe(4);
    expect(advanced.sets).toBe(5);
    expect(pro.sets).toBe(5);
    for (const scaled of [beginner, intermediate, advanced]) {
      expect(scaled.reps).toBe("15s work / 15s rest × 8");
      expect(scaled.restSeconds).toBe(60);
      expect(scaled.logMode).toBe("timed_round");
    }
    expect(
      plannedSetLine({
        sets: 5,
        reps: bikeIntervalReps(),
        restSeconds: 60,
        logMode: "timed_round",
        name: DEFAULT_BIKE_SESSION.name,
      }),
    ).toBe("5 sets · 15s work / 15s rest × 8, 60s between sets");
  });

  it("puts Bike on Tuesday and Thursday even when availability is Mon/Wed/Fri", () => {
    const week = buildCoreWeekPlan(MMA_MON_WED_FRI);
    expect(week.Monday.summary).toBe("Bag+Lift");
    expect(week.Tuesday.summary).toBe("Bike");
    expect(week.Tuesday.active).toBe(true);
    expect(week.Wednesday.summary).toBe("Bag+Lift");
    expect(week.Thursday.summary).toBe("Bike");
    expect(week.Thursday.active).toBe(true);
    expect(week.Friday.summary).toBe("Cond+Lift");
    expect(week.Saturday.summary).toBe("Off");
    expect(week.Sunday.summary).toBe("Off");

    expect(coreSkeletonSessions("Tuesday", "mma")[0]).toMatchObject({
      kind: "conditioning",
      programSlug: "demo-strength-base",
      dayNumber: BIKE_PROGRAM_DAY_NUMBER,
    });
    expect(coreSkeletonSessions("Thursday", "wrestling")[0]).toMatchObject({
      kind: "conditioning",
      dayNumber: BIKE_PROGRAM_DAY_NUMBER,
    });
    expect(coreSkeletonSessions("Thursday", "general-fitness")[0]?.kind).toBe("conditioning");

    const tue = planForDate(MMA_MON_WED_FRI, tuesday);
    expect(tue.active).toBe(true);
    expect(tue.summary).toBe("Bike");
    const thu = planForDate(MMA_MON_WED_FRI, thursday);
    expect(thu.active).toBe(true);
    expect(thu.summary).toBe("Bike");
    const mon = planForDate(MMA_MON_WED_FRI, monday);
    expect(mon.summary).toBe("Bag+Lift");

    const strip = weekStrip(MMA_MON_WED_FRI, monday);
    expect(strip.map((day) => day.summary)).toEqual([
      "Bag+Lift",
      "Bike",
      "Bag+Lift",
      "Bike",
      "Cond+Lift",
      "Off",
      "Off",
    ]);
  });
});

describe("assault bike seeded day", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("seeds Day 4 as timed_round completion sets that scale by level", async () => {
    const program = await getDemoProgram();
    const day = program.days.find((row) => row.dayNumber === BIKE_PROGRAM_DAY_NUMBER);
    expect(day?.title).toMatch(/assault bike/i);
    const exercise = day?.exercises[0];
    expect(exercise?.name).toBe("Assault bike intervals");
    expect(exercise?.logMode).toBe("timed_round");
    expect(exercise?.reps).toBe("15s work / 15s rest × 8");
    expect(exercise?.restSeconds).toBe(60);
    expect(exercise?.formVideoUrl).toMatch(/youtube\.com\/watch\?v=G8a1IAVLdjA/);
    expect(exercise?.notes).toMatch(/3–5 min easy spin/i);

    const user = await makeUser("bike-scale@example.com");
    const beginner = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day!.id,
      preferredUnits: "lb",
      scale: { experienceLevel: "beginner" },
    });
    const intermediate = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day!.id,
      preferredUnits: "lb",
      scale: { experienceLevel: "intermediate" },
    });
    const advanced = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day!.id,
      preferredUnits: "lb",
      scale: { experienceLevel: "advanced", competitionStatus: "pro" },
    });
    expect(beginner.sets.filter((set) => set.exerciseName === exercise!.name)).toHaveLength(3);
    expect(intermediate.sets.filter((set) => set.exerciseName === exercise!.name)).toHaveLength(4);
    expect(advanced.sets.filter((set) => set.exerciseName === exercise!.name)).toHaveLength(5);
    expect(beginner.sets[0]?.logMode).toBe("timed_round");
    expect(beginner.sets[0]?.durationSeconds).toBeNull();
    expect(beginner.sets[0]?.reps).toBeNull();
    expect(beginner.sets[0]?.loadValue).toBeNull();

    const scaled = scaleProgramDay(
      { ...day!, exercises: day!.exercises },
      { band: "advanced", programSlug: "demo-strength-base" },
    );
    expect(scaled.exercises[0]?.sets).toBe(5);
    expect(scaled.exercises[0]?.restSeconds).toBe(60);

    const resolved = resolvePlanSessions(planForDate(MMA_MON_WED_FRI, thursday), {
      strength: program,
    });
    expect(resolved[0]?.dayNumber).toBe(BIKE_PROGRAM_DAY_NUMBER);
    expect(resolved[0]?.href).toBe(`/training/${day!.id}`);
    expect(resolved[0]?.title).toMatch(/assault bike/i);
  });
});
