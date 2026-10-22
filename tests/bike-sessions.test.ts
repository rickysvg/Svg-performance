import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { WEEKDAYS } from "@/lib/constants";
import {
  BIKE_PROGRAM_DAY_NUMBER,
  BIKE_SESSIONS,
  DEFAULT_BIKE_SESSION,
  alignBikeRestPhrase,
  bikeIntervalReps,
  bikeSessionForLogger,
  bikeSetsForBand,
  bikeWeekIndex,
  bikeWorkSecondsPerSet,
  isBikeIntervalName,
  parseBikeIntervalReps,
  pickBikeSession,
  pickBikeSessionForPlan,
  planBikeDose,
  scaleBikeSession,
} from "@/lib/bike-sessions";
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
const monday = new Date(2026, 8, 21, 10, 0, 0);

const MMA_MON_WED_FRI = {
  primaryFocus: "mma",
  weeklyAvailability: ["Monday", "Wednesday", "Friday"],
  sessionsPerWeek: 3,
};

describe("assault bike catalog", () => {
  it("keeps 15/15 × 8 and adds the coach sessions plus fight-pace", () => {
    expect(BIKE_SESSIONS).toHaveLength(7);
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
    expect(isBikeIntervalName("Fight-pace bike rounds")).toBe(true);
    expect(isBikeIntervalName("Jump rope or easy bike intervals")).toBe(false);
    expect(fallbackLogMode("Assault bike intervals")).toBe("timed_round");
    expect(fallbackLogMode("Daru alactic power bike")).toBe("timed_round");
    expect(creditForExercise("Assault bike intervals")).toBeNull();
    expect(creditForExercise("Daru alactic power bike")?.line).toMatch(/Phil Daru/);
    expect(creditForExercise("Jamieson tempo bike")?.url).toMatch(/LhvPU8vhyq0/);
    expect(creditForExercise("Leon Edwards 10/20 bike finisher")?.url).toMatch(/7Jf_JutBJlo/);
  });

  it("keeps rest copy on the dose that is actually running", () => {
    const alactic = BIKE_SESSIONS.find((row) => row.id === "daru-alactic")!;
    const week1 = planBikeDose(alactic, "intermediate", 0);
    const week2 = planBikeDose(alactic, "intermediate", 1);
    expect(week1.focus).toMatch(/50s easy/);
    expect(week1.restSeconds).toBe(50);
    expect(week2.restSeconds).toBe(40);
    expect(week2.focus).toMatch(/40s easy/);
    expect(week2.focus).not.toMatch(/50s/);
    expect(week2.notes).toMatch(/40s easy/);
    expect(week2.notes).not.toMatch(/50s/);

    const logged = bikeSessionForLogger(alactic.name, { reps: "10s work / 40s rest × 8", restSeconds: 0 });
    expect(logged?.restSeconds).toBe(40);
    expect(logged?.focus).toMatch(/40s easy/);
    expect(logged?.focus).not.toMatch(/50s/);
    expect(logged?.notes).not.toMatch(/50s/);
    expect(alignBikeRestPhrase("10s all-out / 50s easy", 10, 40)).toBe("10s all-out / 40s easy");
    expect(alignBikeRestPhrase("10s work / 40s rest", 10, 40)).toBe("10s work / 40s rest");

    const scaled = scaleProgramDay(
      {
        dayNumber: 5,
        title: alactic.title,
        focus: alactic.focus,
        exercises: [
          {
            name: alactic.name,
            sets: 1,
            reps: bikeIntervalReps(alactic),
            loadText: alactic.loadText,
            restSeconds: 0,
            logMode: "timed_round",
            notes: alactic.notes,
          },
        ],
      },
      { band: "intermediate", programSlug: "demo-strength-base", weekIndex: 1 },
    );
    expect(scaled.exercises[0]?.reps).toBe("10s work / 40s rest × 8");
    expect(scaled.focus).toMatch(/40s easy/);
    expect(scaled.focus).not.toMatch(/50s/);
  });

  it("keeps Wednesday alactic and rotates the Sunday aerobic bike", () => {
    expect(pickBikeSessionForPlan("Wednesday", 0).id).toBe("daru-alactic");
    expect(pickBikeSessionForPlan("Sunday", 0).id).toBe("jamieson-cardiac");
    expect(pickBikeSessionForPlan("Wednesday", 1).id).toBe("daru-alactic");
    expect(pickBikeSessionForPlan("Sunday", 1).id).toBe("jamieson-tempo");
    expect(pickBikeSessionForPlan("Wednesday", 2).id).toBe("daru-alactic");
    expect(pickBikeSessionForPlan("Sunday", 2).id).toBe("jamieson-cardiac");
    expect(pickBikeSessionForPlan("Sunday", 0, "peak").id).toBe("fight-pace");
    for (const week of [0, 1, 2, 3, 9]) {
      expect(pickBikeSessionForPlan("Wednesday", week).id).not.toBe(
        pickBikeSessionForPlan("Sunday", week).id,
      );
    }
    expect(bikeWeekIndex(monday) % 3).toBe(1);
    expect(
      coreSkeletonSessions("Tuesday", "mma", 1).find((s) => s.kind === "conditioning"),
    ).toBeUndefined();
    expect(
      coreSkeletonSessions("Wednesday", "mma", 1).find((s) => s.kind === "conditioning")?.dayNumber,
    ).toBe(5);
    expect(
      coreSkeletonSessions("Sunday", "mma", 1).find((s) => s.kind === "conditioning")?.dayNumber,
    ).toBe(6);
    expect(
      coreSkeletonSessions("Sunday", "mma", 1).find((s) => s.kind === "conditioning")?.label,
    ).toMatch(/bike/i);
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
    const camp = scaleExercise(seed, {
      band: "intermediate",
      programSlug: "demo-strength-base",
      campPhase: "build",
    });
    expect(camp.sets).toBe(5);
    expect(camp.loadText).toMatch(/Camp build: same bike, advanced dose\./);
    expect(
      plannedSetLine({
        sets: camp.sets,
        reps: camp.reps,
        restSeconds: camp.restSeconds,
        logMode: camp.logMode,
        name: seed.name,
        loadText: camp.loadText,
      }),
    ).toBe(
      "5 rounds · 15s work / 15s rest × 8, 60s between rounds. Camp build: same bike, advanced dose.",
    );
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

  it("keeps cardio on the open days and mobility twice, without a lift every day", () => {
    const week = buildCoreWeekPlan(MMA_MON_WED_FRI);
    expect(week.Monday.summary).toBe("Lift");
    expect(week.Tuesday.summary).toBe("Lift");
    expect(week.Tuesday.active).toBe(true);
    expect(week.Wednesday.summary).toBe("Cardio+Mobility");
    expect(week.Thursday.summary).toBe("Lift");
    expect(week.Friday.summary).toBe("Conditioning+Mobility");
    expect(week.Saturday.summary).toBe("Sparring");
    expect(week.Sunday.summary).toBe("Cardio+Mobility");

    const open = buildCoreWeekPlan({ primaryFocus: "mma", weeklyAvailability: [...WEEKDAYS] });
    expect(open.Thursday.summary).toBe("Lift");
    expect(open.Wednesday.summary).toBe("Cardio+Mobility");
    expect(open.Sunday.summary).toBe("Cardio+Mobility");
    expect(open.Wednesday.sessions.some((session) => session.kind === "conditioning")).toBe(true);
    expect(open.Sunday.sessions.find((session) => session.kind === "conditioning")?.dayNumber).toBe(8);
    expect(open.Saturday.summary).toBe("Sparring");
    expect(
      coreSkeletonSessions("Wednesday", "mma").find((session) => session.kind === "conditioning"),
    ).toMatchObject({
      programSlug: "demo-strength-base",
    });

    const tue = planForDate(MMA_MON_WED_FRI, tuesday);
    expect(tue.active).toBe(true);
    expect(tue.summary).toBe("Lift");
    const mon = planForDate(MMA_MON_WED_FRI, monday);
    expect(mon.summary).toBe("Lift");

    const strip = weekStrip(MMA_MON_WED_FRI, monday);
    expect(strip.map((day) => day.summary)).toEqual([
      "Lift",
      "Lift",
      "Cardio+Mobility",
      "Lift",
      "Conditioning+Mobility",
      "Sparring",
      "Cardio+Mobility",
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
    expect(exercise?.formVideoUrl).toMatch(/youtube\.com\/watch\?v=KC-ZSfOmXgE/);
    expect(exercise?.notes).toMatch(/3–5 min easy spin/i);

    const user = await makeUser("bike-scale@example.com");
    const beginner = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day!.id,
      preferredUnits: "lb",
      scale: { experienceLevel: "beginner" },
    });
    await prisma.workoutSession.update({
      where: { id: beginner.id },
      data: { performedAt: new Date("2026-09-01T18:00:00.000Z") },
    });
    const intermediate = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day!.id,
      preferredUnits: "lb",
      scale: { experienceLevel: "intermediate" },
    });
    await prisma.workoutSession.update({
      where: { id: intermediate.id },
      data: { performedAt: new Date("2026-09-08T18:00:00.000Z") },
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

    const sunday = new Date(2026, 8, 27, 10, 0, 0);
    const resolved = resolvePlanSessions(
      planForDate({ primaryFocus: "mma", weeklyAvailability: [...WEEKDAYS] }, sunday),
      { strength: program },
    );
    const bike = resolved.find((row) => row.dayNumber === 6);
    expect(bike?.dayNumber).toBe(6);
    const dayId = program.days.find((row) => row.dayNumber === 6)!.id;
    expect(bike?.href).toBe(`/training/${dayId}`);
    expect(bike?.logHref).toBe(`/training/${dayId}/start`);
    expect(bike?.href).not.toMatch(/\/timer/);
    expect(bike?.title).toMatch(/Cardio/i);
    expect(bike?.day?.title).toMatch(/tempo/i);
  });

  it("seeds the rotation days and the three full-body lifts", async () => {
    const program = await getDemoProgram();
    const numbers = program.days.map((row) => row.dayNumber);
    expect(numbers).toEqual(
      expect.arrayContaining([1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 20, 21, 22]),
    );
    expect(numbers).not.toContain(3);

    const alactic = program.days.find((row) => row.dayNumber === 5);
    expect(alactic?.exercises[0]?.name).toBe("Daru alactic power bike");
    expect(alactic?.exercises[0]?.logMode).toBe("timed_round");
    expect(alactic?.exercises[0]?.formVideoUrl).toMatch(/KC-ZSfOmXgE/);
    expect(alactic?.exercises[0]?.reps).toBe("10s work / 50s rest × 3");

    const mondayLift = program.days.find((row) => row.dayNumber === 1);
    expect(mondayLift?.exercises.some((row) => row.name === "Trap-bar deadlift")).toBe(true);
    expect(mondayLift?.exercises.find((row) => row.name === "Trap-bar deadlift")?.logMode).toBe(
      "load_reps",
    );
    expect(mondayLift?.title).toMatch(/Full body/i);
    expect(program.days.find((row) => row.dayNumber === 3)).toBeUndefined();

    const tuesday = program.days.find((row) => row.dayNumber === 2);
    expect(tuesday?.exercises.some((row) => row.name === "Rotational med-ball throw")).toBe(true);
    const thursdayLift = program.days.find((row) => row.dayNumber === 11);
    expect(thursdayLift?.exercises.some((row) => row.name === "Single-leg RDL")).toBe(true);
    expect(tuesday?.exercises.some((row) => row.name === "Landmine press")).toBe(true);
    for (const name of ["Landmine press", "Rotational med-ball throw", "Trap-bar deadlift"]) {
      expect(creditForExercise(name)?.line).toMatch(/Phil Daru/);
    }
  });
});
