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
});
