import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/errors";
import { makeUser, resetDatabase } from "./helpers";
import { bikeChoiceById } from "@/lib/bike-chooser";
import { isBikeIntervalName } from "@/lib/bike-sessions";
import { loggerChoiceFromSession } from "@/lib/bike-timer-log";
import { exerciseUsesBikeLogger } from "@/lib/timer-session";
import { completeBikeLoggerSession, updateWorkoutSessionForUser } from "@/lib/workouts";
import { readWorkoutTimerFields } from "@/lib/workout-timer-columns";
import { getShareCardView } from "@/lib/share-card-data";
import { workoutCompleteTiles } from "@/lib/workout-complete";
import { APP_LOAD_UNIT } from "@/lib/units";

describe("custom bike logger", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("treats a custom bike name as a logger exercise", () => {
    expect(isBikeIntervalName("Custom bike")).toBe(false);
    expect(exerciseUsesBikeLogger("Custom bike")).toBe(true);
    expect(exerciseUsesBikeLogger("Easy bike")).toBe(false);
  });

  it("writes the open custom session and opens the completed screen", async () => {
    const user = await makeUser("custom-bike@example.com");
    const session = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        title: "Custom bike",
        performedAt: new Date("2026-10-22T18:00:00.000Z"),
        status: "draft",
        plannedSetCount: 1,
        sets: {
          create: {
            exerciseName: "Custom bike",
            setNumber: 1,
            sortOrder: 0,
            logMode: "timed_round",
            loadUnit: "lb",
            completed: false,
          },
        },
      },
    });
    expect(session.programDayId).toBeNull();
    const choice = bikeChoiceById("tabata");
    expect(choice).not.toBeNull();
    const saved = await completeBikeLoggerSession({
      userId: user.id,
      workoutId: session.id,
      choice: choice!,
      roundsCompleted: 8,
    });
    expect(saved.status).toBe("complete");
    expect(saved.sets.every((set) => set.exerciseName === "Assault bike intervals")).toBe(true);
    expect(saved.sets.every((set) => (set.durationSeconds ?? 0) <= 3600)).toBe(true);
    const clock = await readWorkoutTimerFields(saved.id, prisma);
    expect(clock.finishedAt?.toISOString()).toBe(session.performedAt.toISOString());
    const view = await getShareCardView(user.id, saved.id);
    expect(view).not.toBeNull();
    const tiles = workoutCompleteTiles({
      session: view!.session,
      displayUnit: APP_LOAD_UNIT,
      newPrCount: 0,
    });
    expect(tiles.some((tile) => tile.label === "Intervals")).toBe(true);

    const other = await makeUser("custom-bike-other@example.com");
    await expect(
      completeBikeLoggerSession({
        userId: other.id,
        workoutId: session.id,
        choice: choice!,
        roundsCompleted: 8,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("caps a long ride instead of rejecting the completed screen", async () => {
    const user = await makeUser("long-bike@example.com");
    const session = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        title: "Custom bike",
        performedAt: new Date("2026-10-22T18:00:00.000Z"),
        status: "draft",
        plannedSetCount: 1,
        sets: {
          create: {
            exerciseName: "Custom bike",
            setNumber: 1,
            sortOrder: 0,
            logMode: "timed",
            loadUnit: "lb",
            completed: false,
          },
        },
      },
    });
    await expect(
      updateWorkoutSessionForUser({
        userId: user.id,
        workoutId: session.id,
        title: "Custom bike",
        performedAt: session.performedAt,
        notes: "",
        status: "complete",
        sets: [
          {
            exerciseName: "Custom bike",
            setNumber: 1,
            reps: null,
            loadValue: null,
            loadUnit: "lb",
            logMode: "timed",
            durationSeconds: 5400,
            completed: true,
          },
        ],
        rest: null,
        timeZone: "America/Denver",
      }),
    ).rejects.toThrow(/60 minutes/);

    const choice = loggerChoiceFromSession({
      name: "Custom bike",
      workSeconds: 7200,
      restSeconds: 0,
      roundsPerSet: 1,
    });
    const saved = await completeBikeLoggerSession({
      userId: user.id,
      workoutId: session.id,
      choice,
      roundsCompleted: 1,
    });
    expect(saved.status).toBe("complete");
    expect(saved.sets[0]?.durationSeconds).toBeLessThanOrEqual(3600);
    expect(await getShareCardView(user.id, saved.id)).not.toBeNull();
  });

  it("keeps a short custom ride partial so it does not count as the full plan", async () => {
    const user = await makeUser("partial-bike@example.com");
    const session = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        title: "Custom bike",
        performedAt: new Date(),
        status: "draft",
        sets: {
          create: {
            exerciseName: "Custom bike",
            setNumber: 1,
            sortOrder: 0,
            logMode: "timed_round",
            loadUnit: "lb",
            completed: false,
          },
        },
      },
    });
    const saved = await completeBikeLoggerSession({
      userId: user.id,
      workoutId: session.id,
      choice: bikeChoiceById("tabata")!,
      roundsCompleted: 2,
    });
    expect(saved.status).toBe("partial");
    expect(saved.plannedSetCount).toBe(8);
    expect(await getShareCardView(user.id, saved.id)).toBeNull();
  });

  it("leaves a finished session and its clock untouched", async () => {
    const user = await makeUser("finished-bike@example.com");
    const performedAt = new Date("2026-10-20T18:00:00.000Z");
    const session = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        title: "Custom bike",
        performedAt,
        status: "complete",
        plannedSetCount: 1,
        sets: {
          create: {
            exerciseName: "Squat",
            setNumber: 1,
            sortOrder: 0,
            logMode: "strength",
            loadUnit: "lb",
            reps: 5,
            completed: true,
          },
        },
      },
    });
    await prisma.workoutSession.update({
      where: { id: session.id },
      data: { finishedAt: performedAt, elapsedSeconds: 600, timerStartedAt: null },
    });
    const choice = bikeChoiceById("tabata")!;
    await expect(
      completeBikeLoggerSession({
        userId: user.id,
        workoutId: session.id,
        choice,
        roundsCompleted: 8,
      }),
    ).rejects.toThrow(/already saved/i);

    await prisma.workoutSession.update({ where: { id: session.id }, data: { status: "partial" } });
    await expect(
      completeBikeLoggerSession({
        userId: user.id,
        workoutId: session.id,
        choice,
        roundsCompleted: 8,
      }),
    ).rejects.toThrow(/already saved/i);

    const row = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: session.id },
      include: { sets: true },
    });
    expect(row.status).toBe("partial");
    expect(row.performedAt.toISOString()).toBe(performedAt.toISOString());
    expect(row.sets.map((set) => set.exerciseName)).toEqual(["Squat"]);
    const clock = await readWorkoutTimerFields(session.id, prisma);
    expect(clock.finishedAt?.toISOString()).toBe(performedAt.toISOString());
    expect(clock.elapsedSeconds).toBe(600);
  });
});
