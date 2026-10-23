import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeUser, resetDatabase } from "./helpers";
import { createBackfillWorkout } from "@/lib/backfill-workout";
import { attachBikeChoice, choiceToken, customBikeChoice } from "@/lib/bike-chooser";
import { performedAtForDayKey } from "@/lib/backfill-rules";
import { logBikeRoundsForUser } from "@/lib/workouts";
import { readWorkoutTimerFields } from "@/lib/workout-timer-columns";

const NOW = new Date("2026-10-22T18:00:00.000Z");
const TZ = "America/Denver";
const DAY = "2026-10-21";

async function onboard(userId: string) {
  await prisma.profile.update({
    where: { userId },
    data: {
      timeZone: TZ,
      primaryFocus: "mma",
      experienceLevel: "intermediate",
      sessionsPerWeek: 3,
      weeklyAvailabilityJson: JSON.stringify(["Monday", "Wednesday", "Friday"]),
      onboardingCompletedAt: new Date("2026-01-05T12:00:00.000Z"),
    },
  });
}

describe("backfill bike parity", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("stores the same sets, token, and total as the live timer", async () => {
    const choice = customBikeChoice({
      workSeconds: 15,
      restSeconds: 15,
      rounds: 8,
      repeatRounds: 2,
      restBetweenRoundsSeconds: 60,
    });
    expect(choice).toBeTruthy();
    expect(choiceToken(choice!)).toBe("c.15.15.8.0.0.2.60");
    expect(choice!.name).toBe("2 × 8 rounds · 15/15 · 60s between sets");
    const when = performedAtForDayKey(DAY, TZ);
    const liveUser = await makeUser("parity-live@example.com");
    const backUser = await makeUser("parity-backfill@example.com");
    await onboard(liveUser.id);
    await onboard(backUser.id);
    const live = await logBikeRoundsForUser({
      userId: liveUser.id,
      choice: choice!,
      roundsCompleted: 16,
      now: when,
    });
    const back = await createBackfillWorkout({
      userId: backUser.id,
      dayKey: DAY,
      kind: "bike",
      resolution: "",
      now: NOW,
      title: "",
      notes: "",
      rpe: null,
      workSeconds: 15,
      restSeconds: 15,
      roundsPerSet: 8,
      repeatRounds: 2,
      restBetweenRoundsSeconds: 60,
      doneRounds: 16,
    });
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    const [liveRow, backRow] = await Promise.all([
      prisma.workoutSession.findUnique({
        where: { id: live.id },
        include: { sets: { orderBy: { setNumber: "asc" } } },
      }),
      prisma.workoutSession.findUnique({
        where: { id: back.sessionId },
        include: { sets: { orderBy: { setNumber: "asc" } } },
      }),
    ]);
    const shape = (row: NonNullable<typeof liveRow>) => ({
      title: row.title,
      status: row.status,
      programDayId: row.programDayId,
      plannedSetCount: row.plannedSetCount,
      notes: row.notes,
      sets: row.sets.map((set) => ({
        exerciseName: set.exerciseName,
        setNumber: set.setNumber,
        reps: set.reps,
        loadValue: set.loadValue,
        logMode: set.logMode,
        durationSeconds: set.durationSeconds,
        completed: set.completed,
        notes: set.notes,
        prescriptionKey: set.prescriptionKey,
      })),
    });
    expect(backRow).toBeTruthy();
    expect(shape(backRow!)).toEqual(shape(liveRow!));
    expect(backRow?.source).toBe("backfill");
    expect(backRow?.backfilled).toBe(true);
    expect(liveRow?.backfilled).toBe(false);
    expect(liveRow?.source).not.toBe("backfill");
    expect(backRow?.sets).toHaveLength(16);
    expect(backRow?.sets[0]?.prescriptionKey).toBe(attachBikeChoice("timer", "c.15.15.8.0.0.2.60"));
    expect((await readWorkoutTimerFields(live.id, prisma)).elapsedSeconds).toBe(540);
    expect((await readWorkoutTimerFields(back.sessionId, prisma)).elapsedSeconds).toBe(540);
  });
});
