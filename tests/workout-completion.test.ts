import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError } from "@/lib/errors";
import { getDemoProgram } from "@/lib/programs";
import { APP_TIMEZONE } from "@/lib/timezone";
import { makeUser, resetDatabase } from "./helpers";
import { resolveSessionElapsed } from "@/lib/session-elapsed";
import { readWorkoutTimerFields } from "@/lib/workout-timer-columns";
import {
  completedProgramDayIdsOnDay,
  discardEmptyWorkoutDraft,
  finalizePastLoggedDrafts,
  reopenCompletedWorkoutForUser,
  reopenEmptyCompletion,
  deleteWorkoutSessionForUser,
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
    expect(marked).toEqual([]);
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
    await prisma.workoutSession.update({
      where: { id: empty.id },
      data: { performedAt: new Date("2026-09-01T18:00:00.000Z") },
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
    expect(pastRow.status).toBe("partial");
    expect(openRow.status).toBe("draft");
  });

  it("reuses one row when the same session is started twice in a day", async () => {
    const user = await makeUser("once-a-day@example.com");
    const program = await getDemoProgram();
    const day = program.days[0];
    const first = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    const second = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    expect(second.id).toBe(first.id);
    expect(await prisma.workoutSession.count({ where: { userId: user.id } })).toBe(1);
  });

  it("does not open a second log after that session is already complete today", async () => {
    const user = await makeUser("already-logged@example.com");
    const program = await getDemoProgram();
    const day = program.days[0];
    const first = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: first.id,
      title: first.title,
      performedAt: first.performedAt,
      notes: "",
      status: "complete",
      timeZone: APP_TIMEZONE,
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
    const again = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    expect(again.id).toBe(first.id);
    expect(again.status).toBe("complete");
    expect(await prisma.workoutSession.count({ where: { userId: user.id } })).toBe(1);
  });

  it("starts a new row when that session is logged on a later day", async () => {
    const user = await makeUser("next-week@example.com");
    const program = await getDemoProgram();
    const day = program.days[0];
    const first = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    await prisma.workoutSession.update({
      where: { id: first.id },
      data: { performedAt: new Date("2026-09-01T18:00:00.000Z") },
    });
    const next = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    expect(next.id).not.toBe(first.id);
  });

  it("does not complete a second past draft when that session is already logged", async () => {
    const user = await makeUser("extra-draft@example.com");
    const program = await getDemoProgram();
    const day = program.days[0];
    const monday = new Date("2026-10-19T18:00:00.000Z");
    const wednesday = new Date("2026-10-21T18:00:00.000Z");
    const kept = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: kept.id,
      title: kept.title,
      performedAt: monday,
      notes: "",
      status: "complete",
      timeZone: APP_TIMEZONE,
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
    const extra = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        programDayId: day.id,
        title: kept.title,
        performedAt: monday,
        createdAt: monday,
        status: "draft",
        sets: {
          create: [
            {
              exerciseName: "Goblet squat",
              setNumber: 1,
              reps: 8,
              loadValue: 35,
              completed: true,
            },
          ],
        },
      },
    });
    expect(await finalizePastLoggedDrafts(user.id, wednesday, APP_TIMEZONE)).toBe(0);
    const extraRow = await prisma.workoutSession.findUniqueOrThrow({ where: { id: extra.id } });
    expect(extraRow.status).toBe("draft");
    expect(
      await prisma.workoutSession.count({ where: { userId: user.id, status: "complete" } }),
    ).toBe(1);
  });

  it("keeps a second save on the already completed row", async () => {
    const user = await makeUser("second-save@example.com");
    const program = await getDemoProgram();
    const day = program.days[0];
    const monday = new Date("2026-10-19T18:00:00.000Z");
    const kept = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    await prisma.workoutSession.update({
      where: { id: kept.id },
      data: { performedAt: monday, createdAt: monday },
    });
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: kept.id,
      title: kept.title,
      performedAt: monday,
      notes: "",
      status: "complete",
      timeZone: APP_TIMEZONE,
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
    const extra = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        programDayId: day.id,
        title: "Duplicate",
        performedAt: monday,
        createdAt: new Date(monday.getTime() + 60_000),
        status: "draft",
        sets: {
          create: [
            {
              exerciseName: "Goblet squat",
              setNumber: 1,
              reps: 5,
              loadValue: 25,
              completed: true,
            },
          ],
        },
      },
    });
    const saved = await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: extra.id,
      title: "Duplicate",
      performedAt: monday,
      notes: "",
      status: "complete",
      timeZone: APP_TIMEZONE,
      sets: [
        {
          exerciseName: "Goblet squat",
          setNumber: 1,
          reps: 5,
          loadValue: 25,
          loadUnit: "lb",
          completed: true,
        },
      ],
    });
    expect(saved.id).toBe(kept.id);
    const extraRow = await prisma.workoutSession.findUniqueOrThrow({ where: { id: extra.id } });
    expect(extraRow.status).toBe("draft");
    expect(await prisma.workoutSession.count({ where: { userId: user.id, status: "complete" } })).toBe(1);
  });

  it("deletes the owner's sets and refuses another member", async () => {
    const owner = await makeUser("delete-owner@example.com");
    const other = await makeUser("delete-other@example.com");
    const program = await getDemoProgram();
    const session = await startWorkoutFromDay({
      userId: owner.id,
      programDayId: program.days[0].id,
      preferredUnits: "lb",
    });
    await updateWorkoutSessionForUser({
      userId: owner.id,
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
    await expect(deleteWorkoutSessionForUser(session.id, other.id)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await prisma.workoutSet.count({ where: { workoutSessionId: session.id } })).toBeGreaterThan(0);
    await deleteWorkoutSessionForUser(session.id, owner.id);
    expect(await prisma.workoutSession.findUnique({ where: { id: session.id } })).toBeNull();
    expect(await prisma.workoutSet.count({ where: { workoutSessionId: session.id } })).toBe(0);
  });

  it("freezes header elapsed time on Save and ticks again from that base after resume", async () => {
    const user = await makeUser("freeze-timer@example.com");
    const program = await getDemoProgram();
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: program.days[0].id,
      preferredUnits: "lb",
    });
    const started = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await prisma.workoutSession.update({
      where: { id: session.id },
      data: { createdAt: started },
    });
    const finished = await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: "Lift 2 — Full body",
      performedAt: session.performedAt,
      notes: "",
      status: "complete",
      elapsedSeconds: 70 * 60 + 25,
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
    expect(finished.status).toBe("complete");
    expect(finished.elapsedSeconds).toBe(70 * 60 + 25);
    expect(finished.finishedAt).not.toBeNull();
    expect(finished.timerStartedAt).toBeNull();

    const later = new Date(Date.now() + 20 * 60 * 60 * 1000);
    const savedView = resolveSessionElapsed(finished, later);
    expect(savedView.ticking).toBe(false);
    expect(savedView.label).toBe("1:10:25");

    const rewritten = await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: "Lift 2 — Full body",
      performedAt: session.performedAt,
      notes: "rating later",
      status: "complete",
      elapsedSeconds: 15,
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
    expect(rewritten.elapsedSeconds).toBe(70 * 60 + 25);
    expect(rewritten.finishedAt?.toISOString()).toBe(finished.finishedAt?.toISOString());

    const resumed = await reopenCompletedWorkoutForUser(user.id, session.id);
    expect(resumed.status).toBe("draft");
    expect(resumed.finishedAt).toBeNull();
    expect(resumed.elapsedSeconds).toBe(70 * 60 + 25);
    expect(resumed.timerStartedAt).not.toBeNull();
    const ticking = resolveSessionElapsed(resumed, new Date(resumed.timerStartedAt!.getTime() + 30_000));
    expect(ticking.ticking).toBe(true);
    expect(ticking.seconds).toBe(70 * 60 + 25 + 30);
    expect(ticking.label).toBe("1:10:55");
  });

  it("stores a capped duration when a past draft is closed, not the gap until the job runs", async () => {
    const user = await makeUser("finalize-timer@example.com");
    const program = await getDemoProgram();
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: program.days[0].id,
      preferredUnits: "lb",
    });
    const start = new Date("2026-10-19T16:00:00.000Z");
    const lastEdit = new Date("2026-10-19T17:10:00.000Z");
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: session.title,
      performedAt: start,
      notes: "",
      status: "draft",
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
    await prisma.workoutSession.update({
      where: { id: session.id },
      data: { createdAt: start, updatedAt: lastEdit },
    });
    expect(await finalizePastLoggedDrafts(user.id, new Date("2026-10-21T18:00:00.000Z"), APP_TIMEZONE)).toBe(1);
    const row = await prisma.workoutSession.findUniqueOrThrow({ where: { id: session.id } });
    const timer = await readWorkoutTimerFields(session.id, prisma);
    expect(row.status).toBe("partial");
    expect(timer.elapsedSeconds).toBe(70 * 60);
    expect(timer.finishedAt).toBeNull();
    const view = resolveSessionElapsed({ ...row, ...timer }, new Date("2026-10-21T18:00:00.000Z"));
    expect(view.ticking).toBe(false);
    expect(view.label).toBe("Paused");
    expect(view.label).not.toBe("4:00:00");
  });

  it("leaves a workout resumed today ticking and keeps the saved duration", async () => {
    const user = await makeUser("resume-today@example.com");
    const program = await getDemoProgram();
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: program.days[0].id,
      preferredUnits: "lb",
    });
    const performed = new Date("2026-10-19T16:00:00.000Z");
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: "Lift 2 — Full body",
      performedAt: performed,
      notes: "",
      status: "complete",
      elapsedSeconds: 70 * 60 + 25,
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
    const resumed = await reopenCompletedWorkoutForUser(user.id, session.id);
    expect(resumed.status).toBe("draft");
    expect(await finalizePastLoggedDrafts(user.id, new Date(), APP_TIMEZONE)).toBe(0);
    const row = await prisma.workoutSession.findUniqueOrThrow({ where: { id: session.id } });
    const timer = await readWorkoutTimerFields(session.id, prisma);
    expect(row.status).toBe("draft");
    expect(timer.elapsedSeconds).toBe(70 * 60 + 25);
    expect(timer.finishedAt).toBeNull();
    const ticking = resolveSessionElapsed({ ...row, ...timer }, new Date(timer.timerStartedAt!.getTime() + 5_000));
    expect(ticking.ticking).toBe(true);
    expect(ticking.label).toBe("1:10:30");
  });

  it("does not store a multi-day gap when a finished workout is reopened", async () => {
    const user = await makeUser("reopen-gap@example.com");
    const program = await getDemoProgram();
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: program.days[0].id,
      preferredUnits: "lb",
    });
    const created = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await prisma.workoutSession.update({
      where: { id: session.id },
      data: { status: "complete", createdAt: created, updatedAt: new Date() },
    });
    const resumed = await reopenCompletedWorkoutForUser(user.id, session.id);
    expect(resumed.status).toBe("draft");
    expect(resumed.elapsedSeconds == null || resumed.elapsedSeconds === 0).toBe(true);
    expect(resumed.elapsedSeconds).not.toBe(4 * 60 * 60);
  });
});
