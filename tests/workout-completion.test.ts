import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError } from "@/lib/errors";
import { getDemoProgram } from "@/lib/programs";
import { APP_TIMEZONE } from "@/lib/timezone";
import { makeUser, resetDatabase } from "./helpers";
import { sessionCountsAsPlannedCompletion } from "@/lib/logged-work";
import { addedPrescriptionKey } from "@/lib/logger-insert";
import { choiceToken, customBikeChoice } from "@/lib/bike-chooser";
import { dropEmptyPlanBikeRows, planRowsForLoggedSets, restoreLoggerSets } from "@/lib/logger-sets";
import { resolveSessionElapsed, SESSION_DURATION_CAP_SECONDS } from "@/lib/session-elapsed";
import { readWorkoutTimerFields } from "@/lib/workout-timer-columns";
import {
  completedProgramDayIdsOnDay,
  discardEmptyWorkoutDraft,
  finalizePastLoggedDrafts,
  reopenCompletedWorkoutForUser,
  reopenEmptyCompletion,
  deleteWorkoutSessionForUser,
  continuePartialWorkoutForUser,
  recordWorkoutActivityForUser,
  resumeHeldSessionClockForUser,
  listDraftSessionsForUser,
  listResumableSessionsForUser,
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

    expect(await discardEmptyWorkoutDraft(user.id, empty.id)).toEqual({ discarded: false });
    expect(await prisma.workoutSession.findUnique({ where: { id: empty.id } })).not.toBeNull();
    expect(await discardEmptyWorkoutDraft(user.id, empty.id, { explicit: true })).toEqual({
      discarded: true,
    });
    expect(await prisma.workoutSession.findUnique({ where: { id: empty.id } })).toBeNull();
    expect(await discardEmptyWorkoutDraft(user.id, typed.id, { explicit: true })).toEqual({
      discarded: false,
    });
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

  it("leaves a past empty draft in place and keeps it off Resume", async () => {
    const user = await makeUser("empty-past@example.com");
    const program = await getDemoProgram();
    const monday = new Date(2026, 8, 21, 16, 0, 0);
    const wednesday = new Date(2026, 8, 23, 16, 0, 0);
    const past = await startWorkoutFromDay({
      userId: user.id,
      programDayId: program.days[0].id,
      preferredUnits: "lb",
    });
    const today = await startWorkoutFromDay({
      userId: user.id,
      programDayId: program.days[1].id,
      preferredUnits: "lb",
    });
    await prisma.workoutSession.update({
      where: { id: past.id },
      data: { performedAt: monday, createdAt: monday, timerStartedAt: wednesday },
    });
    expect(await finalizePastLoggedDrafts(user.id, wednesday, APP_TIMEZONE)).toBe(0);
    expect(await prisma.workoutSession.findUnique({ where: { id: past.id } })).toMatchObject({
      status: "draft",
    });

    await prisma.workoutSession.update({
      where: { id: past.id },
      data: { timerStartedAt: null },
    });
    expect(await finalizePastLoggedDrafts(user.id, wednesday, APP_TIMEZONE)).toBe(0);
    const pastRow = await prisma.workoutSession.findUnique({ where: { id: past.id } });
    expect(pastRow).not.toBeNull();
    expect(pastRow?.status).toBe("draft");
    expect(await prisma.workoutSession.findUnique({ where: { id: today.id } })).toMatchObject({
      status: "draft",
    });
    const resumable = await listResumableSessionsForUser(user.id);
    expect(resumable.map((row) => row.id)).not.toContain(past.id);
    expect(resumable.map((row) => row.id)).not.toContain(today.id);
    const drafts = await listDraftSessionsForUser(user.id);
    expect(drafts.map((row) => row.id)).toEqual(expect.arrayContaining([past.id, today.id]));
  });

  it("does not Resume a draft whose only numbers are an unticked prefill", async () => {
    const user = await makeUser("prefill-resume@example.com");
    const program = await getDemoProgram();
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: program.days[0].id,
      preferredUnits: "lb",
    });
    await prisma.workoutSet.create({
      data: {
        workoutSessionId: session.id,
        exerciseName: "Curl",
        setNumber: 1,
        reps: 8,
        loadValue: null,
        loadUnit: "lb",
        logMode: "load_reps",
        durationSeconds: null,
        completed: false,
        prescriptionKey: addedPrescriptionKey({
          exerciseName: "Curl",
          reps: "8",
          restSeconds: 60,
        }),
      },
    });
    const ids = async () =>
      (await listResumableSessionsForUser(user.id)).map((row) => row.id);
    expect(await ids()).not.toContain(session.id);

    await prisma.workoutSet.updateMany({
      where: { workoutSessionId: session.id, exerciseName: "Curl" },
      data: { reps: 10 },
    });
    expect(await ids()).toContain(session.id);

    await prisma.workoutSet.updateMany({
      where: { workoutSessionId: session.id, exerciseName: "Curl" },
      data: { reps: 8, completed: true },
    });
    expect(await ids()).toContain(session.id);
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

  it("rejects a second row for the same set slot", async () => {
    const user = await makeUser("set-slot@example.com");
    const program = await getDemoProgram();
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: program.days[0].id,
      preferredUnits: "lb",
    });
    const set = session.sets[0];
    expect(set).toBeTruthy();
    await expect(
      prisma.workoutSet.create({
        data: {
          workoutSessionId: session.id,
          exerciseName: set!.exerciseName,
          setNumber: set!.setNumber,
          reps: null,
          loadValue: null,
          loadUnit: "lb",
          completed: false,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("fills a short save once when Resume is clicked twice together", async () => {
    const user = await makeUser("double-resume@example.com");
    const program = await getDemoProgram();
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: program.days[0].id,
      preferredUnits: "lb",
    });
    const started = session.sets.length;
    const one = session.sets[0];
    const mode =
      one?.logMode === "timed" ||
      one?.logMode === "timed_round" ||
      one?.logMode === "load_timed" ||
      one?.logMode === "reps_only" ||
      one?.logMode === "load_reps"
        ? one.logMode
        : "load_reps";
    const timed = mode === "timed" || mode === "timed_round" || mode === "load_timed";
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: session.title,
      performedAt: session.performedAt,
      notes: "",
      status: "complete",
      sets: [
        {
          exerciseName: one?.exerciseName || "Squat",
          setNumber: one?.setNumber || 1,
          reps: timed && mode !== "load_timed" ? null : 8,
          loadValue: mode === "reps_only" || mode === "timed" || mode === "timed_round" ? null : 30,
          loadUnit: "lb",
          logMode: mode,
          durationSeconds: timed ? 45 : null,
          completed: true,
        },
      ],
    });
    const results = await Promise.allSettled([
      continuePartialWorkoutForUser({
        userId: user.id,
        workoutId: session.id,
        preferredUnits: "lb",
      }),
      continuePartialWorkoutForUser({
        userId: user.id,
        workoutId: session.id,
        preferredUnits: "lb",
      }),
    ]);
    expect(results.some((result) => result.status === "fulfilled")).toBe(true);
    const filled = await prisma.workoutSet.count({ where: { workoutSessionId: session.id } });
    expect(filled).toBeGreaterThan(1);
    expect(filled).toBeLessThanOrEqual(started);
    await continuePartialWorkoutForUser({
      userId: user.id,
      workoutId: session.id,
      preferredUnits: "lb",
    });
    expect(
      await prisma.workoutSet.count({ where: { workoutSessionId: session.id } }),
    ).toBe(filled);
  });

  it("keeps active time across resume and save instead of the gap since create", async () => {
    const user = await makeUser("resume-clock@example.com");
    const createdAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const sets = [1, 2, 3].map((setNumber) => ({
      exerciseName: "Heavy bag rounds",
      setNumber,
      reps: null,
      loadValue: null,
      loadUnit: "lb" as const,
      logMode: "timed_round" as const,
      durationSeconds: 180,
      completed: true,
      prescriptionKey: "round:bag:180",
    }));
    const session = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        title: "Heavy bag rounds",
        performedAt: createdAt,
        status: "complete",
        createdAt,
        plannedSetCount: 3,
        elapsedSeconds: 100,
        finishedAt: createdAt,
        timerStartedAt: null,
        sets: {
          create: sets.map((set) => ({
            exerciseName: set.exerciseName,
            setNumber: set.setNumber,
            logMode: set.logMode,
            durationSeconds: set.durationSeconds,
            completed: true,
            prescriptionKey: set.prescriptionKey,
            sortOrder: set.setNumber,
          })),
        },
      },
    });
    let expected = 100;
    for (let cycle = 0; cycle < 3; cycle += 1) {
      const before = Date.now();
      await continuePartialWorkoutForUser({
        userId: user.id,
        workoutId: session.id,
        preferredUnits: "lb",
        timeZone: APP_TIMEZONE,
      });
      const resumed = await readWorkoutTimerFields(session.id, prisma);
      const row = await prisma.workoutSession.findUniqueOrThrow({ where: { id: session.id } });
      expect(row.status).toBe("draft");
      expect(resumed.elapsedSeconds).toBe(expected);
      expect(resumed.finishedAt).toBeNull();
      expect(resumed.timerStartedAt).not.toBeNull();
      expect(resumed.timerStartedAt!.getTime()).toBeGreaterThanOrEqual(before - 2000);
      const view = resolveSessionElapsed(
        {
          status: row.status,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          finishedAt: resumed.finishedAt,
          elapsedSeconds: resumed.elapsedSeconds,
          timerStartedAt: resumed.timerStartedAt,
        },
        new Date(resumed.timerStartedAt!.getTime() + 10_000),
      );
      expect(view.seconds).toBe(expected + 10);
      await updateWorkoutSessionForUser({
        userId: user.id,
        workoutId: session.id,
        title: session.title,
        performedAt: session.performedAt,
        notes: "",
        status: "complete",
        elapsedSeconds: view.seconds,
        timeZone: APP_TIMEZONE,
        sets,
      });
      expect((await readWorkoutTimerFields(session.id, prisma)).elapsedSeconds).toBe(expected + 10);
      expected += 10;
    }
    expect(expected).toBe(130);
  });

  it("resumes a short program log from the stored clock", async () => {
    const user = await makeUser("resume-program-clock@example.com");
    const program = await getDemoProgram();
    const day = program.days[0];
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    const one = session.sets[0];
    expect(one).toBeTruthy();
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: session.title,
      performedAt: session.performedAt,
      notes: "",
      status: "partial",
      elapsedSeconds: 90,
      timeZone: APP_TIMEZONE,
      sets: [
        {
          exerciseName: one!.exerciseName,
          setNumber: one!.setNumber,
          reps: 8,
          loadValue: 40,
          loadUnit: "lb",
          completed: true,
        },
      ],
    });
    const createdAt = new Date(Date.now() - 3 * 60 * 60 * 1000);
    await prisma.workoutSession.update({
      where: { id: session.id },
      data: { createdAt, timerStartedAt: null, elapsedSeconds: 90, finishedAt: createdAt },
    });
    const before = Date.now();
    await continuePartialWorkoutForUser({
      userId: user.id,
      workoutId: session.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    const resumed = await readWorkoutTimerFields(session.id, prisma);
    const row = await prisma.workoutSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(row.status).toBe("draft");
    expect(resumed.elapsedSeconds).toBe(90);
    expect(resumed.timerStartedAt).not.toBeNull();
    expect(resumed.timerStartedAt!.getTime()).toBeGreaterThanOrEqual(before - 2000);
    expect(
      resolveSessionElapsed(
        {
          status: row.status,
          createdAt: row.createdAt,
          finishedAt: resumed.finishedAt,
          elapsedSeconds: resumed.elapsedSeconds,
          timerStartedAt: resumed.timerStartedAt,
        },
        new Date(resumed.timerStartedAt!.getTime() + 10_000),
      ).seconds,
    ).toBe(100);
  });

  it("reopens a short save in place instead of starting a second session", async () => {
    const user = await makeUser("already-logged@example.com");
    const program = await getDemoProgram();
    const day = program.days[0];
    const first = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    const removed = first.sets.find((set) => set.exerciseName !== "Goblet squat");
    expect(removed).toBeTruthy();
    await prisma.exerciseRemoval.create({
      data: {
        userId: user.id,
        programSlug: program.slug,
        dayNumber: day.dayNumber,
        originalName: removed!.exerciseName,
        exerciseName: removed!.exerciseName,
        workoutSessionId: first.id,
      },
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
    const again = await continuePartialWorkoutForUser({
      userId: user.id,
      workoutId: first.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    expect(again.id).toBe(first.id);
    expect(again.status).toBe("draft");
    expect(again.sets.length).toBeGreaterThan(1);
    expect(again.sets.some((set) => set.exerciseName === removed!.exerciseName)).toBe(false);
    const twice = await continuePartialWorkoutForUser({
      userId: user.id,
      workoutId: first.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    expect(twice.sets.length).toBe(again.sets.length);
    expect(await prisma.workoutSession.count({ where: { userId: user.id } })).toBe(1);
  });

  it("starts the same session when a one-set save is still short of the dose", async () => {
    const user = await makeUser("short-lift@example.com");
    const program = await getDemoProgram();
    const day = program.days[0];
    const first = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    const kept = first.sets[0];
    expect(kept).toBeTruthy();
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: first.id,
      title: first.title,
      performedAt: first.performedAt,
      notes: "",
      status: "complete",
      plannedSetCount: 1,
      timeZone: APP_TIMEZONE,
      sets: [
        {
          exerciseName: kept!.exerciseName,
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
    expect(await prisma.workoutSession.count({ where: { userId: user.id, programDayId: day.id } })).toBe(1);
  });

  it("opens a new draft after that session is already complete today", async () => {
    const user = await makeUser("fully-logged@example.com");
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
      sets: first.sets.map((set) => ({
        exerciseName: set.exerciseName,
        setNumber: set.setNumber,
        reps: set.logMode === "timed" || set.logMode === "timed_round" ? null : 8,
        loadValue:
          set.logMode === "reps_only" || set.logMode === "timed" || set.logMode === "timed_round"
            ? null
            : 40,
        loadUnit: "lb" as const,
        durationSeconds:
          set.logMode === "timed" || set.logMode === "timed_round" || set.logMode === "load_timed"
            ? 60
            : null,
        completed: true,
      })),
    });
    const again = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    expect(again.id).not.toBe(first.id);
    expect(again.status).toBe("draft");
    const saved = await prisma.workoutSession.findUniqueOrThrow({ where: { id: first.id } });
    expect(saved.status).toBe("complete");
    expect(await prisma.workoutSession.count({ where: { userId: user.id } })).toBe(2);
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
    await prisma.exerciseSwap.create({
      data: {
        userId: user.id,
        originalName: "Goblet squat",
        replacementName: "Box squat",
        scope: "session",
        workoutSessionId: extra.id,
        sets: 3,
        reps: "8",
        loadText: "25 lb",
        restSeconds: 60,
        logMode: "load_reps",
      },
    });
    await prisma.exerciseRemoval.create({
      data: {
        userId: user.id,
        originalName: "Front plank",
        exerciseName: "Front plank",
        workoutSessionId: extra.id,
      },
    });
    const keptSwap = await prisma.exerciseSwap.create({
      data: {
        userId: user.id,
        originalName: "Push-up",
        replacementName: "Knee push-up",
        scope: "block",
        workoutSessionId: kept.id,
        sets: 3,
        reps: "8",
        loadText: "",
        restSeconds: 60,
        logMode: "load_reps",
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
    const keptRow = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: kept.id },
      include: { sets: true },
    });
    expect(keptRow.status).toBe("complete");
    const goblet = keptRow.sets.find((set) => set.exerciseName === "Goblet squat" && set.setNumber === 1);
    expect(goblet?.reps).toBe(5);
    expect(goblet?.loadValue).toBe(25);
    expect(keptRow.sets.length).toBeGreaterThan(1);
    const extraRow = await prisma.workoutSession.findUnique({ where: { id: extra.id } });
    expect(extraRow?.status).toBe("draft");
    expect(await prisma.exerciseSwap.count({ where: { workoutSessionId: extra.id } })).toBe(1);
    expect(await prisma.exerciseRemoval.count({ where: { workoutSessionId: extra.id } })).toBe(1);
    expect(await prisma.exerciseSwap.findUnique({ where: { id: keptSwap.id } })).not.toBeNull();
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
    expect(resumed.timerStartedAt).toBeInstanceOf(Date);
    const held = resolveSessionElapsed(
      resumed,
      new Date(resumed.timerStartedAt!.getTime() + 5 * 60 * 1000),
    );
    expect(held.ticking).toBe(true);
    expect(held.seconds).toBe(70 * 60 + 25 + 5 * 60);
    expect(held.label).toBe("1:15:25");
  });

  it("keeps a capped clock on resume and credits activity gaps from that clock", async () => {
    const user = await makeUser("resume-cap@example.com");
    const now = new Date();
    const session = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        title: "Heavy bag rounds",
        performedAt: now,
        status: "complete",
        sets: {
          create: [
            {
              exerciseName: "Heavy bag rounds",
              setNumber: 1,
              durationSeconds: 180,
              completed: true,
              logMode: "timed_round",
              prescriptionKey: "round:bag:60",
              loadUnit: "lb",
            },
          ],
        },
      },
    });
    await prisma.workoutSession.update({
      where: { id: session.id },
      data: {
        elapsedSeconds: SESSION_DURATION_CAP_SECONDS,
        finishedAt: now,
        timerStartedAt: null,
      },
    });
    await continuePartialWorkoutForUser({
      userId: user.id,
      workoutId: session.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    expect((await readWorkoutTimerFields(session.id, prisma)).elapsedSeconds).toBe(
      SESSION_DURATION_CAP_SECONDS,
    );

    const anchor = new Date(Date.now() - 13 * 60 * 60 * 1000);
    await prisma.$executeRaw`
      UPDATE "WorkoutSession"
      SET "timerStartedAt" = ${anchor}, "elapsedSeconds" = ${SESSION_DURATION_CAP_SECONDS}
      WHERE "id" = ${session.id}
    `;
    const row = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: session.id },
      include: { sets: true },
    });
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: row.title,
      performedAt: row.performedAt,
      notes: "",
      status: "complete",
      elapsedSeconds: 0,
      timeZone: APP_TIMEZONE,
      sets: row.sets.map((set) => ({
        exerciseName: set.exerciseName,
        setNumber: set.setNumber,
        reps: set.reps,
        loadValue: set.loadValue,
        loadUnit: "lb" as const,
        logMode: "timed_round" as const,
        durationSeconds: set.durationSeconds,
        completed: set.completed,
        prescriptionKey: set.prescriptionKey,
      })),
    });
    expect((await readWorkoutTimerFields(session.id, prisma)).elapsedSeconds).toBe(
      SESSION_DURATION_CAP_SECONDS,
    );

    const fresh = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        title: "Lift",
        performedAt: now,
        status: "draft",
      },
    });
    const workedAt = new Date();
    await prisma.workoutSession.update({
      where: { id: fresh.id },
      data: { elapsedSeconds: 600, timerStartedAt: new Date(workedAt.getTime() - 25_000) },
    });
    const worked = await recordWorkoutActivityForUser({
      userId: user.id,
      workoutId: fresh.id,
      now: workedAt,
    });
    expect(worked.elapsedSeconds).toBe(625);

    const restAt = new Date();
    await prisma.workoutSession.update({
      where: { id: fresh.id },
      data: { elapsedSeconds: 600, timerStartedAt: new Date(restAt.getTime() - 3 * 60 * 1000) },
    });
    const rest = await recordWorkoutActivityForUser({
      userId: user.id,
      workoutId: fresh.id,
      now: restAt,
    });
    expect(rest.elapsedSeconds).toBe(600 + 180);

    const awayAt = new Date();
    await prisma.workoutSession.update({
      where: { id: fresh.id },
      data: { elapsedSeconds: 600, timerStartedAt: new Date(awayAt.getTime() - 2 * 60 * 60 * 1000) },
    });
    const away = await recordWorkoutActivityForUser({
      userId: user.id,
      workoutId: fresh.id,
      now: awayAt,
    });
    expect(away.elapsedSeconds).toBe(600 + 10 * 60);
    expect((await readWorkoutTimerFields(fresh.id, prisma)).elapsedSeconds).toBe(600 + 10 * 60);
  });

  it("leaves a reopened finished draft on its stored clock until Resume", async () => {
    const user = await makeUser("held-clock@example.com");
    const createdAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const session = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        title: "Bike",
        performedAt: createdAt,
        status: "draft",
        createdAt,
      },
    });
    await prisma.workoutSession.update({
      where: { id: session.id },
      data: { elapsedSeconds: 90 * 60, timerStartedAt: null, finishedAt: null },
    });
    const lookedAt = new Date();
    const viewed = await recordWorkoutActivityForUser({
      userId: user.id,
      workoutId: session.id,
      now: lookedAt,
    });
    expect(viewed.elapsedSeconds).toBe(90 * 60);
    expect(viewed.timerStartedAt).toBeNull();
    const held = await readWorkoutTimerFields(session.id, prisma);
    expect(held.elapsedSeconds).toBe(90 * 60);
    expect(held.timerStartedAt).toBeNull();

    const before = Date.now();
    const resumed = await resumeHeldSessionClockForUser({
      userId: user.id,
      workoutId: session.id,
    });
    expect(resumed.elapsedSeconds).toBe(90 * 60);
    expect(resumed.timerStartedAt).not.toBeNull();
    expect(resumed.timerStartedAt!.getTime()).toBeGreaterThanOrEqual(before - 2000);
    const after = await recordWorkoutActivityForUser({
      userId: user.id,
      workoutId: session.id,
      now: new Date(resumed.timerStartedAt!.getTime() + 20_000),
    });
    expect(after.elapsedSeconds).toBe(90 * 60 + 20);
    expect(after.timerStartedAt).not.toBeNull();
  });

  it("keeps a partial or complete log's time when it is only viewed", async () => {
    const user = await makeUser("view-activity@example.com");
    const now = new Date("2026-10-22T18:00:00.000Z");
    const anchor = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const lookedAt = new Date(now.getTime() + 60_000);
    for (const [status, stored] of [
      ["partial", 180],
      ["complete", 600],
    ] as const) {
      const session = await prisma.workoutSession.create({
        data: {
          userId: user.id,
          title: status,
          performedAt: now,
          status,
        },
      });
      await prisma.workoutSession.update({
        where: { id: session.id },
        data: { elapsedSeconds: stored, timerStartedAt: anchor },
      });
      await expect(
        recordWorkoutActivityForUser({
          userId: user.id,
          workoutId: session.id,
          now: lookedAt,
        }),
      ).rejects.toBeInstanceOf(AppError);
      const timer = await readWorkoutTimerFields(session.id, prisma);
      expect(timer.elapsedSeconds).toBe(stored);
      expect(timer.timerStartedAt?.getTime()).toBe(anchor.getTime());
      const row = await prisma.workoutSession.findUniqueOrThrow({ where: { id: session.id } });
      expect(row.status).toBe(status);
    }
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
    const row = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: session.id },
      include: { sets: true },
    });
    const timer = await readWorkoutTimerFields(session.id, prisma);
    expect(row.status).toBe("partial");
    expect(sessionCountsAsPlannedCompletion(row, [])).toBe(false);
    expect(timer.elapsedSeconds).toBe(70 * 60);
    expect(timer.finishedAt).toBeNull();
    const view = resolveSessionElapsed({ ...row, ...timer }, new Date("2026-10-21T18:00:00.000Z"));
    expect(view.ticking).toBe(false);
    expect(view.label).toBe("Paused");
    expect(view.label).not.toBe("4:00:00");
  });

  it("finalizes a filled past draft as complete and leaves a short one partial", async () => {
    const user = await makeUser("finalize-filled@example.com");
    const program = await getDemoProgram();
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: program.days[0].id,
      preferredUnits: "lb",
    });
    expect(session.plannedSetCount).toBeGreaterThan(1);
    const start = new Date("2026-10-19T16:00:00.000Z");
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: session.title,
      performedAt: start,
      notes: "",
      status: "draft",
      sets: session.sets.map((set) => ({
        exerciseName: set.exerciseName,
        setNumber: set.setNumber,
        reps: set.logMode === "timed" || set.logMode === "timed_round" ? null : 8,
        loadValue:
          set.logMode === "reps_only" || set.logMode === "timed" || set.logMode === "timed_round"
            ? null
            : 40,
        loadUnit: "lb" as const,
        durationSeconds:
          set.logMode === "timed" || set.logMode === "timed_round" || set.logMode === "load_timed"
            ? 60
            : null,
        completed: true,
      })),
    });
    await prisma.workoutSession.update({
      where: { id: session.id },
      data: { createdAt: start, updatedAt: new Date("2026-10-19T17:10:00.000Z") },
    });
    expect(await finalizePastLoggedDrafts(user.id, new Date("2026-10-21T18:00:00.000Z"), APP_TIMEZONE)).toBe(1);
    const filled = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: session.id },
      include: { sets: true },
    });
    expect(filled.status).toBe("complete");
    expect(sessionCountsAsPlannedCompletion(filled, [])).toBe(true);
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
    expect(resumed.timerStartedAt).toBeInstanceOf(Date);
    expect(await finalizePastLoggedDrafts(user.id, new Date(), APP_TIMEZONE)).toBe(0);
    const row = await prisma.workoutSession.findUniqueOrThrow({ where: { id: session.id } });
    const timer = await readWorkoutTimerFields(session.id, prisma);
    expect(row.status).toBe("draft");
    expect(timer.elapsedSeconds).toBe(70 * 60 + 25);
    expect(timer.finishedAt).toBeNull();
    expect(timer.timerStartedAt).toBeInstanceOf(Date);
    const held = resolveSessionElapsed(
      { ...row, ...timer },
      new Date(timer.timerStartedAt!.getTime() + 5_000),
    );
    expect(held.ticking).toBe(true);
    expect(held.seconds).toBe(70 * 60 + 25 + 5);
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

  it("does not add an empty Daru row onto a plan ride that is already logged", async () => {
    const user = await makeUser("daru-empty-row@example.com");
    const program = await getDemoProgram();
    const day = program.days.find((row) => row.dayNumber === 5);
    expect(day?.exercises[0]?.name).toBe("Daru alactic power bike");
    const choice = customBikeChoice({ workSeconds: 10, restSeconds: 50, rounds: 3 });
    expect(choice).not.toBeNull();
    const session = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        programDayId: day!.id,
        title: "Assault bike intervals",
        performedAt: new Date("2026-10-22T18:00:00.000Z"),
        status: "partial",
        plannedSetCount: 8,
        sets: {
          create: [
            {
              exerciseName: "Assault bike intervals",
              setNumber: 1,
              sortOrder: 0,
              logMode: "timed_round",
              durationSeconds: 10,
              completed: true,
              prescriptionKey: `timer#bw:${choiceToken(choice!)}`,
            },
          ],
        },
      },
      include: { sets: true },
    });
    const resumed = await continuePartialWorkoutForUser({
      userId: user.id,
      workoutId: session.id,
      preferredUnits: "lb",
    });
    expect(resumed.sets.some((set) => set.exerciseName === "Daru alactic power bike")).toBe(false);
    expect(resumed.sets.some((set) => set.exerciseName === "Assault bike intervals" && set.completed)).toBe(true);
    expect(resumed.sets.every((set) => set.exerciseName !== "Daru alactic power bike")).toBe(true);
  });

  it("keeps undo finish of a plan ride free of an empty Daru row and saves it complete", async () => {
    const user = await makeUser("daru-undo-save@example.com");
    const program = await getDemoProgram();
    const day = program.days.find((row) => row.dayNumber === 5);
    expect(day?.exercises[0]?.name).toBe("Daru alactic power bike");
    const choice = customBikeChoice({ workSeconds: 10, restSeconds: 50, rounds: 3 });
    expect(choice).not.toBeNull();
    const session = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        programDayId: day!.id,
        title: "Cardio",
        performedAt: new Date("2026-10-21T18:00:00.000Z"),
        status: "complete",
        plannedSetCount: 1,
        sets: {
          create: [
            {
              exerciseName: "Assault bike intervals",
              setNumber: 1,
              sortOrder: 0,
              logMode: "timed_round",
              durationSeconds: 10,
              completed: true,
              prescriptionKey: `timer#bw:${choiceToken(choice!)}`,
            },
          ],
        },
      },
    });
    const reopened = await reopenCompletedWorkoutForUser(user.id, session.id);
    expect(reopened.status).toBe("draft");
    const logged = reopened.sets.map((set) => ({
      exerciseName: set.exerciseName,
      setNumber: set.setNumber,
      completed: set.completed,
      durationSeconds: set.durationSeconds,
      reps: set.reps,
      loadValue: set.loadValue,
      prescriptionKey: set.prescriptionKey,
      logMode: set.logMode,
      notes: set.notes,
      loadUnit: "lb" as const,
      rir: "",
    }));
    const prescriptions = (day?.exercises ?? []).map((row) => ({ name: row.name, sets: row.sets }));
    expect(planRowsForLoggedSets(prescriptions, logged).some((row) => row.name === "Daru alactic power bike")).toBe(
      false,
    );
    const withEmptyPlanRow = restoreLoggerSets(
      logged,
      {
        sets: [
          ...logged,
          {
            exerciseName: "Daru alactic power bike",
            setNumber: 1,
            completed: false,
            durationSeconds: null,
          },
        ],
      },
      prescriptions,
      (name, setNumber) => ({
        exerciseName: name,
        setNumber,
        completed: false,
        durationSeconds: null,
        reps: null,
        loadValue: null,
        prescriptionKey: "",
        logMode: "timed_round",
        notes: "",
        loadUnit: "lb" as const,
        rir: "",
      }),
    );
    const restored = dropEmptyPlanBikeRows(withEmptyPlanRow, logged);
    expect(restored.some((set) => set.exerciseName === "Daru alactic power bike")).toBe(false);
    expect(restored.some((set) => set.exerciseName === "Assault bike intervals" && set.completed)).toBe(true);
    const sets = restored
      .filter((set) => set.completed || (set.durationSeconds ?? 0) > 0)
      .map((set) => ({
        exerciseName: set.exerciseName,
        setNumber: set.setNumber,
        reps: null,
        loadValue: null,
        loadUnit: "lb" as const,
        logMode: "timed_round" as const,
        durationSeconds: set.durationSeconds,
        completed: true,
        notes: "",
        prescriptionKey: set.prescriptionKey ?? "",
        rir: "",
      }));
    const drafted = await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: "Cardio",
      performedAt: reopened.performedAt,
      notes: "",
      status: "draft",
      sets,
    });
    expect(drafted.sets.some((set) => set.exerciseName === "Daru alactic power bike")).toBe(false);
    const saved = await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: "Cardio",
      performedAt: reopened.performedAt,
      notes: "",
      status: "complete",
      sets,
    });
    expect(saved.status).toBe("complete");
    expect(saved.sets.some((set) => set.exerciseName === "Daru alactic power bike")).toBe(false);
    expect(saved.sets.some((set) => set.exerciseName === "Assault bike intervals" && set.completed)).toBe(true);
  });
});
