import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { isLogMode } from "@/lib/exercise-log-mode";
import { makeUser, resetDatabase } from "./helpers";
import { getDemoProgram } from "@/lib/programs";
import { APP_TIMEZONE, dayKey } from "@/lib/timezone";
import { readWorkoutTimerFields } from "@/lib/workout-timer-columns";
import {
  applySavedWorkoutToDay,
  createSavedWorkout,
  listDayPlansForUser,
  startDayPlanForUser,
  startSavedWorkoutForUser,
} from "@/lib/my-workouts";
import { getShareCardView } from "@/lib/share-card-data";
import { resolveSessionElapsed } from "@/lib/session-elapsed";
import {
  continuePartialWorkoutForUser,
  recordWorkoutActivityForUser,
  reopenCompletedWorkoutForUser,
  resumeHeldSessionClockForUser,
  startWorkoutFromDay,
  updateWorkoutSessionForUser,
} from "@/lib/workouts";

const LAST_MONDAY = new Date("2026-11-09T22:12:00.000Z");
const THIS_MONDAY = new Date("2026-11-16T22:12:00.000Z");
const STORED_ELAPSED = 4702;
const HEARTBEAT_ELAPSED = 4905;

describe("a completed session stays finished when a later week starts", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function finishTemplateSession(userId: string) {
    const saved = await createSavedWorkout({
      userId,
      name: "leg n upper- tier b",
      exercises: [
        {
          name: "Goblet squat",
          sets: 2,
          reps: "8",
          loadText: "",
          restSeconds: 90,
          rir: "",
          logMode: "load_reps",
          notes: "",
        },
      ],
    });
    const session = await startSavedWorkoutForUser({
      userId,
      savedWorkoutId: saved.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
      now: LAST_MONDAY,
    });
    await updateWorkoutSessionForUser({
      userId,
      workoutId: session.id,
      title: "Lift 1",
      performedAt: LAST_MONDAY,
      notes: "",
      status: "complete",
      timeZone: APP_TIMEZONE,
      sets: session.sets.map((set) => ({
        exerciseName: set.exerciseName,
        setNumber: set.setNumber,
        reps: 8,
        loadValue: 40,
        loadUnit: "lb" as const,
        logMode: "load_reps" as const,
        durationSeconds: null,
        completed: true,
      })),
    });
    await prisma.workoutSession.update({
      where: { id: session.id },
      data: {
        title: "Lift 1",
        status: "complete",
        performedAt: LAST_MONDAY,
        elapsedSeconds: STORED_ELAPSED,
        finishedAt: LAST_MONDAY,
        timerStartedAt: null,
      },
    });
    return { saved, sessionId: session.id };
  }

  async function expectFrozen(sessionId: string) {
    const row = await prisma.workoutSession.findUniqueOrThrow({ where: { id: sessionId } });
    const timer = await readWorkoutTimerFields(sessionId, prisma);
    expect(row.status).toBe("complete");
    expect(row.performedAt.toISOString()).toBe(LAST_MONDAY.toISOString());
    expect(timer.elapsedSeconds).toBe(STORED_ELAPSED);
    expect(timer.finishedAt?.toISOString()).toBe(LAST_MONDAY.toISOString());
    expect(timer.timerStartedAt).toBeNull();
  }

  it("does not reopen last week's finished template when this week starts", async () => {
    const user = await makeUser("template-week@example.com");
    const { saved, sessionId } = await finishTemplateSession(user.id);

    const resumed = await continuePartialWorkoutForUser({
      userId: user.id,
      workoutId: sessionId,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    expect(resumed.status).toBe("complete");
    expect(resumed.id).toBe(sessionId);

    const undone = await reopenCompletedWorkoutForUser(user.id, sessionId);
    expect(undone.status).toBe("complete");
    expect(undone.elapsedSeconds).toBe(STORED_ELAPSED);

    const stored = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { sets: true },
    });
    const autosave = await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: sessionId,
      title: "Lift 1",
      performedAt: THIS_MONDAY,
      notes: "draft overwrite",
      status: "draft",
      elapsedSeconds: HEARTBEAT_ELAPSED,
      timeZone: APP_TIMEZONE,
      sets: stored.sets.map((set) => ({
        exerciseName: set.exerciseName,
        setNumber: set.setNumber,
        reps: set.reps,
        loadValue: set.loadValue,
        loadUnit: "lb" as const,
        completed: set.completed,
      })),
    });
    expect(autosave.id).toBe(sessionId);
    expect(autosave.status).toBe("complete");
    expect(autosave.title).toBe("Lift 1");

    await expect(recordWorkoutActivityForUser({ userId: user.id, workoutId: sessionId })).rejects.toBeInstanceOf(
      AppError,
    );
    await expect(resumeHeldSessionClockForUser({ userId: user.id, workoutId: sessionId })).rejects.toBeInstanceOf(
      AppError,
    );

    const started = await startSavedWorkoutForUser({
      userId: user.id,
      savedWorkoutId: saved.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
      now: THIS_MONDAY,
    });
    expect(started.id).not.toBe(sessionId);
    expect(started.status).toBe("draft");
    expect(started.savedWorkoutId).toBe(saved.id);
    expect(dayKey(started.performedAt, APP_TIMEZONE)).toBe("2026-11-16");
    expect(await prisma.workoutSession.count({ where: { userId: user.id } })).toBe(2);
    await expectFrozen(sessionId);
  });

  it("starts a new program-day session for this week and leaves last week's clock", async () => {
    const user = await makeUser("lift-week@example.com");
    const program = await getDemoProgram();
    const day = program.days.find((row) => row.title.startsWith("Lift 1"));
    expect(day).toBeTruthy();
    const first = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day!.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
      now: LAST_MONDAY,
    });
    await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: first.id,
      title: first.title,
      performedAt: LAST_MONDAY,
      notes: "",
      status: "complete",
      timeZone: APP_TIMEZONE,
      sets: first.sets.map((set) => {
        const mode = isLogMode(set.logMode) ? set.logMode : "load_reps";
        const timed = mode === "timed" || mode === "timed_round" || mode === "load_timed";
        return {
          exerciseName: set.exerciseName,
          setNumber: set.setNumber,
          reps: timed && mode !== "load_timed" ? null : 8,
          loadValue: mode === "reps_only" || mode === "timed" || mode === "timed_round" ? null : 40,
          loadUnit: "lb" as const,
          logMode: mode,
          durationSeconds: timed ? 60 : null,
          completed: true,
        };
      }),
    });
    await prisma.workoutSession.update({
      where: { id: first.id },
      data: {
        status: "complete",
        performedAt: LAST_MONDAY,
        elapsedSeconds: STORED_ELAPSED,
        finishedAt: LAST_MONDAY,
        timerStartedAt: null,
      },
    });

    const next = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day!.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
      now: THIS_MONDAY,
    });
    expect(next.id).not.toBe(first.id);
    expect(next.status).toBe("draft");
    expect(dayKey(next.performedAt, APP_TIMEZONE)).toBe("2026-11-16");

    await continuePartialWorkoutForUser({
      userId: user.id,
      workoutId: first.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    await expectFrozen(first.id);
  });

  it("resume of an applied template targets only the in-progress draft", async () => {
    const user = await makeUser("plan-resume@example.com");
    const saved = await createSavedWorkout({
      userId: user.id,
      name: "leg n upper- tier b",
      exercises: [
        {
          name: "Goblet squat",
          sets: 2,
          reps: "8",
          loadText: "",
          restSeconds: 90,
          rir: "",
          logMode: "load_reps",
          notes: "",
        },
      ],
    });
    const lastPlan = await applySavedWorkoutToDay({
      userId: user.id,
      savedWorkoutId: saved.id,
      dayKey: "2026-11-09",
      mode: "replace",
    });
    const finished = await startDayPlanForUser({
      userId: user.id,
      planId: lastPlan.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
      now: LAST_MONDAY,
    });
    await prisma.workoutSession.update({
      where: { id: finished.id },
      data: {
        status: "complete",
        performedAt: LAST_MONDAY,
        elapsedSeconds: STORED_ELAPSED,
        finishedAt: LAST_MONDAY,
        timerStartedAt: null,
        title: "Lift 1",
      },
    });
    await prisma.workoutSet.updateMany({
      where: { workoutSessionId: finished.id },
      data: { reps: 8, loadValue: 40, completed: true },
    });

    const lastViews = await listDayPlansForUser(user.id, ["2026-11-09"]);
    expect(lastViews[0]?.draftId).toBeNull();
    expect(lastViews[0]?.draftId).not.toBe(finished.id);

    const thisPlan = await applySavedWorkoutToDay({
      userId: user.id,
      savedWorkoutId: saved.id,
      dayKey: "2026-11-16",
      mode: "replace",
    });
    const started = await startDayPlanForUser({
      userId: user.id,
      planId: thisPlan.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
      now: THIS_MONDAY,
    });
    expect(started.id).not.toBe(finished.id);
    expect(started.status).toBe("draft");
    expect(dayKey(started.performedAt, APP_TIMEZONE)).toBe("2026-11-16");
    const views = await listDayPlansForUser(user.id, ["2026-11-16"]);
    expect(views[0]?.draftId).toBe(started.id);
    await expectFrozen(finished.id);
  });

  async function finishProgramDay(
    userId: string,
    mode: "partial" | "full",
  ) {
    const program = await getDemoProgram();
    const day = program.days.find((row) => row.title.startsWith("Lift 1")) ?? program.days[0]!;
    const session = await startWorkoutFromDay({
      userId,
      programDayId: day.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    const logged = mode === "full" ? session.sets : session.sets.slice(0, 2);
    expect(logged.length).toBeGreaterThan(0);
    const saved = await updateWorkoutSessionForUser({
      userId,
      workoutId: session.id,
      title: "Lift 1",
      performedAt: session.performedAt,
      notes: "",
      status: "complete",
      elapsedSeconds: 58,
      timeZone: APP_TIMEZONE,
      sets: logged.map((set) => {
        const logMode = isLogMode(set.logMode) ? set.logMode : "load_reps";
        const timed = logMode === "timed" || logMode === "timed_round" || logMode === "load_timed";
        return {
          exerciseName: set.exerciseName,
          setNumber: set.setNumber,
          reps: timed && logMode !== "load_timed" ? null : 8,
          loadValue: logMode === "reps_only" || logMode === "timed" || logMode === "timed_round" ? null : 40,
          loadUnit: "lb" as const,
          logMode,
          durationSeconds: timed ? 30 : null,
          completed: true,
        };
      }),
    });
    return { dayId: day.id, sessionId: session.id, saved };
  }

  it("keeps a partial finish sealed when Resume or Start runs", async () => {
    const user = await makeUser("partial-finish@example.com");
    const { dayId, sessionId, saved } = await finishProgramDay(user.id, "partial");
    expect(saved.status).toBe("complete");
    expect(saved.finishedAt).not.toBeNull();
    const elapsed = saved.elapsedSeconds;
    expect(elapsed).not.toBeNull();

    const resumed = await continuePartialWorkoutForUser({
      userId: user.id,
      workoutId: sessionId,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    expect(resumed.id).toBe(sessionId);
    expect(resumed.status).toBe("complete");
    const clock = await readWorkoutTimerFields(sessionId, prisma);
    expect(clock.elapsedSeconds).toBe(elapsed);
    expect(clock.finishedAt).not.toBeNull();
    expect(clock.timerStartedAt).toBeNull();

    await expect(recordWorkoutActivityForUser({ userId: user.id, workoutId: sessionId })).rejects.toBeInstanceOf(
      AppError,
    );

    const started = await startWorkoutFromDay({
      userId: user.id,
      programDayId: dayId,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    expect(started.id).not.toBe(sessionId);
    expect(started.status).toBe("draft");
    expect((await readWorkoutTimerFields(started.id, prisma)).finishedAt).toBeNull();

    const done = await getShareCardView(user.id, sessionId);
    expect(done?.session.status).toBe("complete");
    const frozen = await prisma.workoutSession.findUniqueOrThrow({ where: { id: sessionId } });
    const frozenClock = await readWorkoutTimerFields(sessionId, prisma);
    expect(frozen.status).toBe("complete");
    expect(frozenClock.elapsedSeconds).toBe(elapsed);
    expect(frozenClock.timerStartedAt).toBeNull();
  });

  it("keeps a full finish sealed when Resume runs the same day", async () => {
    const user = await makeUser("full-finish@example.com");
    const { dayId, sessionId, saved } = await finishProgramDay(user.id, "full");
    expect(saved.status).toBe("complete");
    const elapsed = saved.elapsedSeconds;

    const resumed = await continuePartialWorkoutForUser({
      userId: user.id,
      workoutId: sessionId,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    expect(resumed.status).toBe("complete");
    const clock = await readWorkoutTimerFields(sessionId, prisma);
    expect(clock.elapsedSeconds).toBe(elapsed);
    expect(clock.timerStartedAt).toBeNull();

    const undone = await reopenCompletedWorkoutForUser(user.id, sessionId);
    expect(undone.status).toBe("draft");
    expect((await readWorkoutTimerFields(sessionId, prisma)).elapsedSeconds).toBe(elapsed);

    await prisma.workoutSession.update({
      where: { id: sessionId },
      data: { status: "complete", finishedAt: saved.finishedAt, timerStartedAt: null, elapsedSeconds: elapsed },
    });
    const started = await startWorkoutFromDay({
      userId: user.id,
      programDayId: dayId,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    expect(started.id).not.toBe(sessionId);
    expect(started.status).toBe("draft");
    expect((await prisma.workoutSession.findUniqueOrThrow({ where: { id: sessionId } })).status).toBe(
      "complete",
    );
  });

  it("still resumes a save-draft that has logged sets", async () => {
    const user = await makeUser("save-draft@example.com");
    const program = await getDemoProgram();
    const day = program.days.find((row) => row.title.startsWith("Lift 1")) ?? program.days[0]!;
    const session = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    const one = session.sets[0]!;
    const drafted = await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: session.id,
      title: session.title,
      performedAt: session.performedAt,
      notes: "",
      status: "draft",
      timeZone: APP_TIMEZONE,
      sets: session.sets.map((set) => ({
        exerciseName: set.exerciseName,
        setNumber: set.setNumber,
        reps: set.id === one.id ? 8 : null,
        loadValue: set.id === one.id ? 40 : null,
        loadUnit: "lb" as const,
        logMode: isLogMode(set.logMode) ? set.logMode : "load_reps",
        durationSeconds: null,
        completed: set.id === one.id,
      })),
    });
    expect(drafted.status).toBe("draft");
    expect(drafted.finishedAt).toBeNull();

    const again = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    expect(again.id).toBe(session.id);
    expect(again.status).toBe("draft");
    expect(await prisma.workoutSession.count({ where: { userId: user.id, programDayId: day.id } })).toBe(1);
  });

  it("keeps two same-day finishes as two sessions, and undo restores the first", async () => {
    const user = await makeUser("two-finishes@example.com");
    const { dayId, sessionId, saved } = await finishProgramDay(user.id, "partial");
    const firstElapsed = saved.elapsedSeconds;
    const firstSets = saved.sets.length;
    expect(firstSets).toBeGreaterThan(0);

    const second = await startWorkoutFromDay({
      userId: user.id,
      programDayId: dayId,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    expect(second.id).not.toBe(sessionId);
    const finishedSecond = await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: second.id,
      title: "Lift 1",
      performedAt: second.performedAt,
      notes: "",
      status: "complete",
      elapsedSeconds: 120,
      timeZone: APP_TIMEZONE,
      sets: second.sets.map((set) => {
        const logMode = isLogMode(set.logMode) ? set.logMode : "load_reps";
        const timed = logMode === "timed" || logMode === "timed_round" || logMode === "load_timed";
        return {
          exerciseName: set.exerciseName,
          setNumber: set.setNumber,
          reps: timed && logMode !== "load_timed" ? null : 8,
          loadValue: logMode === "reps_only" || logMode === "timed" || logMode === "timed_round" ? null : 40,
          loadUnit: "lb" as const,
          logMode,
          durationSeconds: timed ? 30 : null,
          completed: true,
        };
      }),
    });
    expect(finishedSecond.id).toBe(second.id);
    expect(finishedSecond.status).toBe("complete");
    expect((await readWorkoutTimerFields(finishedSecond.id, prisma)).elapsedSeconds).toBe(120);

    const first = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { sets: true },
    });
    expect(first.status).toBe("complete");
    expect(first.sets).toHaveLength(firstSets);
    expect((await readWorkoutTimerFields(sessionId, prisma)).elapsedSeconds).toBe(firstElapsed);
    expect(await prisma.workoutSession.findUnique({ where: { id: second.id } })).not.toBeNull();
    expect(await getShareCardView(user.id, sessionId)).not.toBeNull();
    expect(await getShareCardView(user.id, second.id)).not.toBeNull();

    const created = new Date(Date.now() - 3 * 60 * 60 * 1000);
    await prisma.workoutSession.update({
      where: { id: sessionId },
      data: { createdAt: created },
    });
    const before = Date.now();
    const undone = await reopenCompletedWorkoutForUser(user.id, sessionId);
    expect(undone.id).toBe(sessionId);
    expect(undone.status).toBe("draft");
    expect(undone.sets).toHaveLength(firstSets);
    expect(undone.elapsedSeconds).toBe(firstElapsed);
    expect(undone.timerStartedAt).toBeInstanceOf(Date);
    expect(undone.timerStartedAt!.getTime()).toBeGreaterThanOrEqual(before - 2000);
    const ticking = resolveSessionElapsed(
      {
        status: undone.status,
        createdAt: created,
        elapsedSeconds: undone.elapsedSeconds,
        timerStartedAt: undone.timerStartedAt,
      },
      new Date(undone.timerStartedAt!.getTime() + 5 * 60 * 1000),
    );
    expect(ticking.seconds).toBe((firstElapsed ?? 0) + 5 * 60);
    expect((await prisma.workoutSession.findUniqueOrThrow({ where: { id: second.id } })).status).toBe(
      "complete",
    );
  });

  it("resumes today's template draft from stored time, not from when it was created", async () => {
    const user = await makeUser("template-idle@example.com");
    const saved = await createSavedWorkout({
      userId: user.id,
      name: "leg n upper- tier b",
      exercises: [
        {
          name: "Goblet squat",
          sets: 2,
          reps: "8",
          loadText: "",
          restSeconds: 90,
          rir: "",
          logMode: "load_reps",
          notes: "",
        },
      ],
    });
    const started = await startSavedWorkoutForUser({
      userId: user.id,
      savedWorkoutId: saved.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    const created = new Date(Date.now() - (11 * 60 + 50) * 1000);
    await prisma.workoutSession.update({
      where: { id: started.id },
      data: { createdAt: created, elapsedSeconds: 90, timerStartedAt: null, finishedAt: null },
    });
    const before = Date.now();
    const again = await startSavedWorkoutForUser({
      userId: user.id,
      savedWorkoutId: saved.id,
      preferredUnits: "lb",
      timeZone: APP_TIMEZONE,
    });
    expect(again.id).toBe(started.id);
    const clock = await readWorkoutTimerFields(again.id, prisma);
    expect(clock.elapsedSeconds).toBe(90);
    expect(clock.timerStartedAt).toBeInstanceOf(Date);
    expect(clock.timerStartedAt!.getTime()).toBeGreaterThanOrEqual(before - 2000);
    const view = resolveSessionElapsed(
      {
        status: "draft",
        createdAt: created,
        elapsedSeconds: clock.elapsedSeconds,
        timerStartedAt: clock.timerStartedAt,
      },
      new Date(clock.timerStartedAt!.getTime() + 10_000),
    );
    expect(view.seconds).toBe(100);
  });
});
