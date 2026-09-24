import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  BIKE_PROGRAM_DAY_NUMBER,
  BIKE_SESSIONS,
  DEFAULT_BIKE_SESSION,
  bikeIntervalReps,
  bikeSetsForBand,
  bikeWeekIndex,
  bikeWorkSecondsPerSet,
  isBikeIntervalName,
  parseBikeIntervalReps,
  pickBikeSession,
  pickBikeSessionForPlan,
  scaleBikeSession,
} from "@/lib/bike-sessions";
import { FRIDAY_GPP_DAY_NUMBER, FRIDAY_GPP_NAMES, MON_WED_DARU_NAMES } from "@/lib/daru-exercises";
import { creditForExercise } from "@/lib/coach-credits";
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
  it("keeps 15/15 × 8 and adds five coach sessions", () => {
    expect(BIKE_SESSIONS).toHaveLength(6);
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
    expect(isBikeIntervalName("Daru alactic power bike")).toBe(true);
    expect(isBikeIntervalName("Jamieson tempo bike")).toBe(true);
    expect(isBikeIntervalName("Daru 75% endurance bike")).toBe(true);
    expect(isBikeIntervalName("Jamieson cardiac output bike")).toBe(true);
    expect(isBikeIntervalName("Leon Edwards 10/20 bike finisher")).toBe(true);
    expect(isBikeIntervalName("Jump rope or easy bike intervals")).toBe(false);
    expect(fallbackLogMode("Assault bike intervals")).toBe("timed_round");
    expect(fallbackLogMode("Daru alactic power bike")).toBe("timed_round");
    expect(creditForExercise("Assault bike intervals")).toBeNull();
    expect(creditForExercise("Daru alactic power bike")?.line).toMatch(/Phil Daru/);
    expect(creditForExercise("Jamieson tempo bike")?.url).toMatch(/LhvPU8vhyq0/);
    expect(creditForExercise("Leon Edwards 10/20 bike finisher")?.url).toMatch(/7Jf_JutBJlo/);
  });

  it("rotates Tue/Thu so the two bike days differ each week", () => {
    expect(pickBikeSessionForPlan("Tuesday", 0).id).toBe("intervals-15-15");
    expect(pickBikeSessionForPlan("Thursday", 0).id).toBe("daru-75-endurance");
    expect(pickBikeSessionForPlan("Tuesday", 1).id).toBe("daru-alactic");
    expect(pickBikeSessionForPlan("Thursday", 1).id).toBe("jamieson-tempo");
    expect(pickBikeSessionForPlan("Tuesday", 2).id).toBe("jamieson-cardiac");
    expect(pickBikeSessionForPlan("Thursday", 2).id).toBe("edwards-10-20");
    for (const week of [0, 1, 2, 3, 9]) {
      expect(pickBikeSessionForPlan("Tuesday", week).id).not.toBe(
        pickBikeSessionForPlan("Thursday", week).id,
      );
    }
    expect(bikeWeekIndex(monday) % 3).toBe(1);
    expect(coreSkeletonSessions("Tuesday", "mma", 1)[0]?.dayNumber).toBe(5);
    expect(coreSkeletonSessions("Thursday", "mma", 1)[0]?.dayNumber).toBe(6);
  });

  it("scales 15/15 sets by experience: 3 / 4 / 5", () => {
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

    expect(beginner.sets).toBe(3);
    expect(intermediate.sets).toBe(4);
    expect(advanced.sets).toBe(5);
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
    ).toBe("5 rounds · 15s work / 15s rest × 8, 60s between rounds");
  });

  it("scales coach bike sessions by level with SVG scaling", () => {
    const alactic = BIKE_SESSIONS.find((row) => row.id === "daru-alactic")!;
    expect(scaleBikeSession(alactic, "beginner").roundsPerSet).toBe(3);
    expect(scaleBikeSession(alactic, "intermediate").roundsPerSet).toBe(4);
    expect(scaleBikeSession(alactic, "advanced").roundsPerSet).toBe(5);
    expect(bikeIntervalReps(scaleBikeSession(alactic, "advanced"))).toBe("10s work / 50s rest × 5");

    const tempo = BIKE_SESSIONS.find((row) => row.id === "jamieson-tempo")!;
    expect(scaleBikeSession(tempo, "beginner")).toMatchObject({
      workSeconds: 12,
      restSeconds: 60,
      roundsPerSet: 8,
      sets: 1,
    });
    expect(scaleBikeSession(tempo, "advanced")).toMatchObject({
      workSeconds: 15,
      restSeconds: 60,
      roundsPerSet: 15,
      sets: 1,
    });

    const endurance = BIKE_SESSIONS.find((row) => row.id === "daru-75-endurance")!;
    expect(scaleBikeSession(endurance, "beginner").workSeconds).toBe(13 * 60);
    expect(scaleBikeSession(endurance, "intermediate").workSeconds).toBe(20 * 60);
    expect(scaleBikeSession(endurance, "advanced").workSeconds).toBe(25 * 60);
    expect(bikeIntervalReps(scaleBikeSession(endurance, "beginner"))).toBe("13:00");
    expect(parseBikeIntervalReps("13:00")).toEqual({
      workSeconds: 780,
      restSeconds: 0,
      roundsPerSet: 1,
    });

    const cardiac = BIKE_SESSIONS.find((row) => row.id === "jamieson-cardiac")!;
    expect(scaleBikeSession(cardiac, "beginner").workSeconds).toBe(22 * 60);
    expect(scaleBikeSession(cardiac, "advanced").workSeconds).toBe(35 * 60);

    const edwards = BIKE_SESSIONS.find((row) => row.id === "edwards-10-20")!;
    expect(scaleBikeSession(edwards, "beginner").roundsPerSet).toBe(3);
    expect(scaleBikeSession(edwards, "advanced").roundsPerSet).toBe(5);

    const scaledAlactic = scaleExercise(
      {
        name: alactic.name,
        sets: 1,
        reps: bikeIntervalReps(alactic),
        loadText: alactic.loadText,
        restSeconds: 0,
        logMode: "timed_round",
      },
      { band: "advanced", programSlug: "demo-strength-base" },
    );
    expect(scaledAlactic.sets).toBe(1);
    expect(scaledAlactic.reps).toBe("10s work / 50s rest × 5");
    expect(scaledAlactic.restSeconds).toBe(0);
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
      dayNumber: 7,
    });
    expect(coreSkeletonSessions("Friday", "mma")[0]).toMatchObject({
      kind: "conditioning",
      dayNumber: FRIDAY_GPP_DAY_NUMBER,
    });

    const tue = planForDate(MMA_MON_WED_FRI, tuesday);
    expect(tue.active).toBe(true);
    expect(tue.summary).toBe("Bike");
    expect(tue.sessions[0]?.dayNumber).toBe(5);
    const thu = planForDate(MMA_MON_WED_FRI, thursday);
    expect(thu.active).toBe(true);
    expect(thu.summary).toBe("Bike");
    expect(thu.sessions[0]?.dayNumber).toBe(6);
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

describe("assault bike seeded days", () => {
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
    expect(resolved[0]?.dayNumber).toBe(6);
    expect(resolved[0]?.href).toBe(
      `/training/${program.days.find((row) => row.dayNumber === 6)!.id}`,
    );
    expect(resolved[0]?.title).toMatch(/tempo/i);
  });

  it("seeds the rotation days plus Friday GPP and Mon/Wed Daru work", async () => {
    const program = await getDemoProgram();
    const numbers = program.days.map((row) => row.dayNumber);
    expect(numbers).toEqual(expect.arrayContaining([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));

    const alactic = program.days.find((row) => row.dayNumber === 5);
    expect(alactic?.exercises[0]?.name).toBe("Daru alactic power bike");
    expect(alactic?.exercises[0]?.logMode).toBe("timed_round");
    expect(alactic?.exercises[0]?.formVideoUrl).toMatch(/LhvPU8vhyq0/);
    expect(alactic?.exercises[0]?.reps).toBe("10s work / 50s rest × 3");

    const friday = program.days.find((row) => row.dayNumber === FRIDAY_GPP_DAY_NUMBER);
    expect(friday?.title).toMatch(/GPP/i);
    expect(friday?.exercises.map((row) => row.name)).toEqual([...FRIDAY_GPP_NAMES]);
    expect(friday?.exercises.find((row) => row.name === "Farmer's carry")?.logMode).toBe("load_timed");
    expect(friday?.exercises.find((row) => row.name === "Sled push")?.logMode).toBe("timed");
    expect(friday?.exercises.find((row) => row.name === "Banded kettlebell swing")?.logMode).toBe(
      "timed",
    );

    const mondayLift = program.days.find((row) => row.dayNumber === 2);
    for (const name of MON_WED_DARU_NAMES) {
      expect(mondayLift?.exercises.some((row) => row.name === name), name).toBe(true);
      expect(creditForExercise(name)?.line).toMatch(/Phil Daru/);
      expect(mondayLift?.exercises.find((row) => row.name === name)?.formVideoUrl).not.toMatch(
        /\/shorts\//,
      );
    }
    expect(mondayLift?.exercises.find((row) => row.name === "Trap-bar deadlift")?.logMode).toBe(
      "load_reps",
    );
    expect(mondayLift?.exercises.find((row) => row.name === "Neck extension hold")?.logMode).toBe(
      "timed",
    );
  });
});
