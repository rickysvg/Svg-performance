import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { StaleDraftError } from "@/lib/errors";
import { assignWeek } from "@/lib/member-plan";
import { buildCoreWeekPlan } from "@/lib/week-plan";
import { syncDemoCatalog } from "@/lib/demo-catalog-sync";
import { DEMO_FORM_VIDEOS, lookupFormVideo } from "@/lib/form-videos";
import { DEMO_PROGRAM_SLUG } from "@/lib/programs";
import { STRENGTH_DAY_BY_BLOCK } from "@/lib/mesocycle";
import { demoStrengthDays } from "@/lib/demo-week-seed";
import { scaleProgramDay, type ScaleableExercise } from "@/lib/training-scale";
import { updateWorkoutSessionForUser } from "@/lib/workouts";

afterAll(async () => {
  await prisma.$disconnect();
});

describe("v2 week for every profile", () => {
  it("gives a no-gym beginner three lifts, bikes, and Saturday sparring", () => {
    const roles = assignWeek({
      experienceLevel: "beginner",
      liftDaysPerWeek: 2,
      outsideTraining: [{ weekday: "Wednesday", kind: "sparring" }],
    });
    expect(roles.Monday.lift).toBeTruthy();
    expect(roles.Tuesday.lift).toBeTruthy();
    expect(roles.Thursday.lift).toBeTruthy();
    expect(roles.Monday.bag).toBeNull();
    expect(roles.Tuesday.bag).toBeNull();
    expect(roles.Thursday.bag).toBeNull();
    expect(roles.Wednesday.outside).toBeNull();
    expect(roles.Wednesday.cardio).toBe("hard-bike");
    expect(roles.Sunday.cardio).toBe("hard-bike");
    expect(roles.Saturday.outside?.kind).toBe("sparring");
    expect(roles.Friday.outside).toBeNull();

    const week = buildCoreWeekPlan({
      primaryFocus: "mma",
      experienceLevel: "beginner",
      liftDaysPerWeek: 2,
      weeklyAvailability: ["Monday", "Wednesday", "Saturday"],
      sessionsPerWeek: 3,
      outsideTraining: [{ weekday: "Wednesday", kind: "sparring" }, { weekday: "Saturday", kind: "sparring" }],
    });
    expect(week.Monday.summary).toBe("Lift");
    expect(week.Tuesday.summary).toBe("Lift");
    expect(week.Thursday.summary).toBe("Lift");
    expect(week.Wednesday.summary).toBe("Cardio+Mobility");
    expect(week.Sunday.summary).toBe("Cardio+Mobility");
    expect(week.Saturday.summary).toBe("Sparring");
    expect(Object.values(week).some((day) => day.summary === "Off")).toBe(false);
  });

  it("keeps a timed Wednesday sparring day", () => {
    const roles = assignWeek({
      outsideTraining: [{ weekday: "Wednesday", kind: "sparring", time: "18:00" }],
    });
    expect(roles.Wednesday.outside?.kind).toBe("sparring");
    expect(roles.Wednesday.cardio).toBeNull();
    expect(roles.Saturday.outside?.kind).toBe("sparring");
  });

  it("scales a beginner no-gym lift from v2 and plays sit-to-stand, not the squat jump", () => {
    const dayNumber = STRENGTH_DAY_BY_BLOCK.A.monday;
    const seeded = demoStrengthDays().find((day) => day.dayNumber === dayNumber);
    if (!seeded) throw new Error("missing monday");
    const scaled = scaleProgramDay(
      {
        dayNumber,
        title: seeded.title,
        focus: seeded.focus,
        exercises: seeded.exercises.create as ScaleableExercise[],
      },
      { band: "beginner", programSlug: DEMO_PROGRAM_SLUG, weightAccess: "none", weekIndex: 0 },
    );
    expect(scaled.title).toMatch(/Lift 1/);
    expect(scaled.exercises.some((exercise) => exercise.name === "Sit-to-stand")).toBe(true);
    expect(scaled.exercises.some((exercise) => /squat jump/i.test(exercise.name))).toBe(false);
    const push = scaled.exercises.find((exercise) => exercise.name === "Push-up");
    expect(push?.sets).toBe(4);
    expect(push?.loadText).not.toMatch(/3-5 RIR/);
    expect(push?.loadText).toMatch(/RIR/);
    const sit = scaled.exercises.find((exercise) => exercise.name === "Sit-to-stand");
    const form = lookupFormVideo(
      "Sit-to-stand",
      scaled.exercises.map((exercise) => ({
        name: exercise.name,
        formVideoUrl: exercise.formVideoUrl ?? "",
        formVideoPending: Boolean(exercise.formVideoPending),
      })),
    );
    expect(form.url).toBe(DEMO_FORM_VIDEOS["Sit-to-stand"]?.url);
    expect(form.url).toMatch(/shorts\/pIAzucMjibQ/);
    expect(form.url).not.toMatch(/tZSYZdtbONc/);
    expect(sit?.formVideoUrl).toBe(form.url);
  });
});

describe("catalog reseed keeps logs", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("rewrites a stale day in place and leaves the open draft", async () => {
    const user = await makeUser("reseed@example.com");
    const program = await prisma.program.findUnique({
      where: { slug: DEMO_PROGRAM_SLUG },
      include: { days: true },
    });
    const day = program?.days.find((row) => row.dayNumber === 1);
    if (!program || !day) throw new Error("missing catalog");
    await prisma.programDay.update({
      where: { id: day.id },
      data: { title: "Day 1 — Lower body strength" },
    });
    const session = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        programDayId: day.id,
        title: "Open draft",
        performedAt: new Date("2026-10-19T16:00:00.000Z"),
        status: "draft",
        sets: {
          create: [{ exerciseName: "Old squat", setNumber: 1, sortOrder: 0, reps: 8, loadValue: 0 }],
        },
      },
    });

    const first = await syncDemoCatalog();
    const strength = first.programs.find((row) => row.slug === DEMO_PROGRAM_SLUG);
    expect(strength?.daysUpdated).toBeGreaterThan(0);
    const refreshed = await prisma.programDay.findUnique({
      where: { id: day.id },
      include: { exercises: true },
    });
    expect(refreshed?.title).toMatch(/Lift 1/);
    expect(refreshed?.exercises.length).toBeGreaterThan(0);
    const draft = await prisma.workoutSession.findUnique({
      where: { id: session.id },
      include: { sets: true },
    });
    expect(draft?.programDayId).toBe(day.id);
    expect(draft?.status).toBe("draft");
    expect(draft?.sets.map((set) => set.exerciseName)).toEqual(["Old squat"]);

    const second = await syncDemoCatalog();
    expect(second.programs.find((row) => row.slug === DEMO_PROGRAM_SLUG)?.daysUpdated).toBe(0);
  });
});

describe("stale workout autosave", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("does not let an older draft overwrite a swap that already saved", async () => {
    const user = await makeUser("stale-draft@example.com");
    const session = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        title: "Lift",
        performedAt: new Date("2026-10-19T16:00:00.000Z"),
        status: "draft",
        sets: {
          create: [{ exerciseName: "Dumbbell bench press", setNumber: 1, sortOrder: 0, reps: 6 }],
        },
      },
    });
    const base = session.updatedAt.toISOString();
    const swapped = await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: "Lift",
      performedAt: session.performedAt,
      notes: "",
      status: "draft",
      sets: [
        {
          exerciseName: "Barbell bench press",
          setNumber: 1,
          reps: 6,
          loadValue: null,
          loadUnit: "lb",
          completed: false,
        },
      ],
    });
    await expect(
      updateWorkoutSessionForUser({
        userId: user.id,
        workoutId: session.id,
        title: "Lift",
        performedAt: session.performedAt,
        notes: "",
        status: "draft",
        baseUpdatedAt: base,
        sets: [
          {
            exerciseName: "Dumbbell bench press",
            setNumber: 1,
            reps: 6,
            loadValue: null,
            loadUnit: "lb",
            completed: false,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(StaleDraftError);
    const fresh = await prisma.workoutSession.findUnique({
      where: { id: session.id },
      include: { sets: true },
    });
    expect(fresh?.sets.map((set) => set.exerciseName)).toEqual(["Barbell bench press"]);
    expect(fresh?.updatedAt.getTime()).toBe(swapped.updatedAt.getTime());
  });
});
