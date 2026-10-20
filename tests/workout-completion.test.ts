import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { getDemoProgram } from "@/lib/programs";
import { APP_TIMEZONE } from "@/lib/timezone";
import { makeUser, resetDatabase } from "./helpers";
import {
  completedProgramDayIdsOnDay,
  discardEmptyWorkoutDraft,
  finalizePastLoggedDrafts,
  reopenEmptyCompletion,
  startWorkoutFromDay,
  updateWorkoutSessionForUser,
} from "@/lib/workouts";

describe("a workout is complete only after a logged save", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("does not mark the training day done when the logger is opened", async () => {
    const user = await makeUser("open-day@example.com");
    const program = await getDemoProgram();
    const day = program.days[0];
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
    });
    expect(session.status).toBe("draft");
    expect(session.sets.every((set) => set.reps == null && set.loadValue == null)).toBe(true);
    const done = await completedProgramDayIdsOnDay(
      user.id,
      [day.id],
      session.performedAt,
      APP_TIMEZONE,
    );
    expect(done).toEqual([]);

    await prisma.workoutSession.update({
      where: { id: session.id },
      data: { status: "complete" },
    });
    const stillOpen = await completedProgramDayIdsOnDay(
      user.id,
      [day.id],
      session.performedAt,
      APP_TIMEZONE,
    );
    expect(stillOpen).toEqual([]);
  });

  it("keeps a failed empty finish as a draft and still accepts Monday's logged sets", async () => {
    const user = await makeUser("monday-legs@example.com");
    const program = await getDemoProgram();
    const day = program.days.find((row) => row.dayNumber === 1) ?? program.days[0];
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
    });
    await prisma.workoutSession.update({
      where: { id: session.id },
      data: { status: "complete", performedAt: new Date("2026-10-14T18:00:00.000Z") },
    });

    await expect(
      updateWorkoutSessionForUser({
        userId: user.id,
        workoutId: session.id,
        title: session.title,
        performedAt: new Date("2026-10-14T18:00:00.000Z"),
        notes: "",
        status: "complete",
        sets: session.sets.map((set) => ({
          exerciseName: set.exerciseName,
          setNumber: set.setNumber,
          reps: null,
          loadValue: null,
          loadUnit: "lb",
          completed: true,
        })),
      }),
    ).rejects.toBeInstanceOf(AppError);

    const reopened = await reopenEmptyCompletion(
      await prisma.workoutSession.findUniqueOrThrow({
        where: { id: session.id },
        include: { sets: true },
      }),
    );
    expect(reopened.id).toBe(session.id);
    expect(reopened.status).toBe("draft");
    expect(reopened.sets.length).toBeGreaterThan(0);

    const squat = reopened.sets.find((set) => set.exerciseName === "Trap-bar deadlift") ?? reopened.sets[0];
    const finished = await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: session.title,
      performedAt: new Date("2026-10-14T18:30:00.000Z"),
      notes: "Monday legs",
      status: "complete",
      sets: [
        ...reopened.sets.map((set) => ({
          exerciseName: set.exerciseName,
          setNumber: set.setNumber,
          reps: set.id === squat.id ? 6 : null,
          loadValue: set.id === squat.id ? 50 : null,
          loadUnit: "lb" as const,
          completed: set.id === squat.id,
          prescriptionKey: set.prescriptionKey,
          rir: set.rir,
        })),
        ...[5, 6, 7, 8].map((setNumber) => ({
          exerciseName: squat.exerciseName,
          setNumber,
          reps: null,
          loadValue: null,
          loadUnit: "lb" as const,
          completed: false,
        })),
      ],
    });
    expect(finished.status).toBe("complete");
    const logged = finished.sets.find((set) => set.exerciseName === squat.exerciseName && set.setNumber === squat.setNumber);
    expect(logged).toMatchObject({ reps: 6, loadValue: 50 });
    expect(finished.sets.some((set) => set.setNumber > 4 && set.exerciseName === squat.exerciseName)).toBe(false);

    const marked = await completedProgramDayIdsOnDay(
      user.id,
      [day.id],
      new Date("2026-10-14T18:30:00.000Z"),
      APP_TIMEZONE,
    );
    expect(marked).toEqual([day.id]);
  });

  it("discards an empty draft and leaves a typed draft alone", async () => {
    const user = await makeUser("discard-draft@example.com");
    const program = await getDemoProgram();
    const day = program.days[0];
    const empty = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
    });
    const typed = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
    });
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: typed.id,
      title: typed.title,
      performedAt: typed.performedAt,
      notes: "",
      status: "draft",
      sets: typed.sets.map((set) => ({
        exerciseName: set.exerciseName,
        setNumber: set.setNumber,
        reps: set.setNumber === 1 ? 5 : null,
        loadValue: set.setNumber === 1 ? 40 : null,
        loadUnit: "lb",
        completed: set.setNumber === 1,
      })),
    });

    expect(await discardEmptyWorkoutDraft(user.id, empty.id)).toEqual({ discarded: true });
    expect(await prisma.workoutSession.findUnique({ where: { id: empty.id } })).toBeNull();
    expect(await discardEmptyWorkoutDraft(user.id, typed.id)).toEqual({ discarded: false });
    const kept = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: typed.id },
      include: { sets: true },
    });
    expect(kept.sets.some((set) => set.reps === 5 && set.loadValue === 40)).toBe(true);
  });

  it("does not let a draft sync erase a finished workout", async () => {
    const user = await makeUser("draft-clobber@example.com");
    const program = await getDemoProgram();
    const day = program.days[0];
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
    });
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: session.title,
      performedAt: session.performedAt,
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
      ],
    });
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: "Draft overwrite",
      performedAt: session.performedAt,
      notes: "late autosave",
      status: "draft",
      sets: [
        {
          exerciseName: "Goblet squat",
          setNumber: 1,
          reps: 99,
          loadValue: 1,
          loadUnit: "lb",
          completed: true,
        },
      ],
    });
    const saved = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: session.id },
      include: { sets: true },
    });
    expect(saved.status).toBe("complete");
    expect(saved.title).not.toBe("Draft overwrite");
    expect(saved.sets.some((set) => set.reps === 8 && set.loadValue === 40)).toBe(true);
    expect(saved.sets.some((set) => set.reps === 99)).toBe(false);
  });

  it("finalizes a past logged draft and leaves today's open draft", async () => {
    const user = await makeUser("past-draft@example.com");
    const program = await getDemoProgram();
    const monday = new Date(2026, 8, 21, 16, 0, 0);
    const wednesday = new Date(2026, 8, 23, 16, 0, 0);
    const past = await startWorkoutFromDay({
      userId: user.id,
      programDayId: program.days[0].id,
      preferredUnits: "lb",
    });
    const open = await startWorkoutFromDay({
      userId: user.id,
      programDayId: program.days[1].id,
      preferredUnits: "lb",
    });
    const logged = [
      {
        exerciseName: "Goblet squat",
        setNumber: 1,
        reps: 8,
        loadValue: 40,
        loadUnit: "lb" as const,
        completed: true,
      },
    ];
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: past.id,
      title: past.title,
      performedAt: monday,
      notes: "",
      status: "draft",
      sets: logged,
    });
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: open.id,
      title: open.title,
      performedAt: wednesday,
      notes: "",
      status: "draft",
      sets: logged,
    });
    expect(await finalizePastLoggedDrafts(user.id, wednesday, APP_TIMEZONE)).toBe(1);
    expect(await finalizePastLoggedDrafts(user.id, wednesday, APP_TIMEZONE)).toBe(0);
    const pastRow = await prisma.workoutSession.findUniqueOrThrow({ where: { id: past.id } });
    const openRow = await prisma.workoutSession.findUniqueOrThrow({ where: { id: open.id } });
    expect(pastRow.status).toBe("complete");
    expect(openRow.status).toBe("draft");
  });
});
