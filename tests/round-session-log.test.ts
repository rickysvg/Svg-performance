import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { bikeChoiceById } from "@/lib/bike-chooser";
import { completedSessionIdsByLocalDay, partialLocalDayKeys } from "@/lib/chip-completion";
import { getHomeToday } from "@/lib/home";
import { buildProgressSummary } from "@/lib/progress";
import { prisma } from "@/lib/prisma";
import { findDemoTrainingCatalog } from "@/lib/programs";
import {
  restSecondsFromRoundKey,
  roundHistoryLine,
  roundSessionDuration,
  roundTargetForProgramDay,
} from "@/lib/round-session";
import { formatTimerClock } from "@/lib/round-timer";
import { getShareCardView } from "@/lib/share-card-data";
import { APP_TIMEZONE, addZonedDays, dayKey } from "@/lib/timezone";
import { completedLocalDayKeys, logBikeRoundsForUser, logRoundSessionForUser } from "@/lib/workouts";
import { makeUser, resetDatabase } from "./helpers";

function source(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

async function bagDayFor(userId: string, now: Date) {
  const catalog = await findDemoTrainingCatalog();
  const day = catalog.skill?.days.find((row) =>
    row.exercises.some((exercise) => /bag rounds/i.test(exercise.name)),
  );
  expect(day?.id).toBeTruthy();
  const target = await roundTargetForProgramDay({
    userId,
    programDayId: day!.id,
    type: "bag",
    now,
  });
  expect(target?.plannedRounds).toBeGreaterThan(1);
  return { dayId: day!.id, target: target! };
}

describe("round session logs", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("saves a full bag day once, shows it on history and progress, and marks the day done", async () => {
    const user = await makeUser("bag-rounds-done@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: { timeZone: APP_TIMEZONE, experienceLevel: "intermediate" },
    });
    const now = new Date();
    const { dayId, target } = await bagDayFor(user.id, now);
    const saved = await logRoundSessionForUser({
      userId: user.id,
      type: "bag",
      programDayId: dayId,
      roundsCompleted: target.plannedRounds,
      workSeconds: target.workSeconds,
      restSeconds: target.restSeconds,
      notes: "Jab stayed long.",
      rpe: 8,
      now,
    });
    const again = await logRoundSessionForUser({
      userId: user.id,
      type: "bag",
      programDayId: dayId,
      roundsCompleted: target.plannedRounds,
      workSeconds: target.workSeconds,
      restSeconds: target.restSeconds,
      notes: "Jab stayed long.",
      rpe: 8,
      now,
    });

    expect(again.id).toBe(saved.id);
    expect(await prisma.workoutSession.count({ where: { userId: user.id, programDayId: dayId } })).toBe(1);
    expect(saved.status).toBe("complete");
    expect(saved.programDayId).toBe(dayId);
    expect(saved.title).toBe(target.exerciseName);
    expect(saved.notes).toBe("Jab stayed long.");
    expect(saved.sessionRpe).toBe(8);
    expect(saved.plannedSetCount).toBe(target.plannedRounds);
    expect(saved.sets).toHaveLength(target.plannedRounds);
    expect(saved.sets.every((set) => set.completed && set.durationSeconds === target.workSeconds)).toBe(true);
    expect(restSecondsFromRoundKey(saved.sets[0]?.prescriptionKey)).toBe(target.restSeconds);
    expect(saved.elapsedSeconds).toBe(
      roundSessionDuration(target.plannedRounds, target.workSeconds, target.restSeconds),
    );
    expect(roundHistoryLine(saved)).toBe(
      `${target.plannedRounds} rounds · ${formatTimerClock(target.workSeconds)} round · ${formatTimerClock(target.restSeconds)} rest · ${formatTimerClock(saved.elapsedSeconds ?? 0)} total · RPE 8`,
    );

    const from = addZonedDays(now, -1, APP_TIMEZONE);
    const to = addZonedDays(now, 2, APP_TIMEZONE);
    const day = dayKey(now, APP_TIMEZONE);
    expect(await completedLocalDayKeys(user.id, from, to, APP_TIMEZONE)).toContain(day);
    expect(await partialLocalDayKeys(user.id, from, to, APP_TIMEZONE)).not.toContain(day);
    expect((await completedSessionIdsByLocalDay(user.id, from, to, APP_TIMEZONE))[day] ?? []).toContain(dayId);

    const home = await getHomeToday(user.id, now, APP_TIMEZONE);
    expect(home.completedDayIds).toContain(dayId);
    expect(home.partialDayIds).not.toContain(dayId);

    const progress = buildProgressSummary([saved], "lb");
    expect(progress.sessionCount).toBe(1);
    expect(progress.lastSessionTitle).toBe(target.exerciseName);
    expect(await getShareCardView(user.id, saved.id)).not.toBeNull();
  });

  it("keeps a short bag day partial until the planned rounds are logged", async () => {
    const user = await makeUser("bag-rounds-partial@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: { timeZone: APP_TIMEZONE, experienceLevel: "intermediate" },
    });
    const now = new Date();
    const { dayId, target } = await bagDayFor(user.id, now);
    const saved = await logRoundSessionForUser({
      userId: user.id,
      type: "bag",
      programDayId: dayId,
      roundsCompleted: 1,
      configuredRounds: target.plannedRounds,
      workSeconds: target.workSeconds,
      restSeconds: target.restSeconds,
      now,
    });
    expect(saved.status).toBe("partial");
    expect(saved.plannedSetCount).toBe(target.plannedRounds);
    expect(saved.sets).toHaveLength(1);

    const from = addZonedDays(now, -1, APP_TIMEZONE);
    const to = addZonedDays(now, 2, APP_TIMEZONE);
    const day = dayKey(now, APP_TIMEZONE);
    expect(await completedLocalDayKeys(user.id, from, to, APP_TIMEZONE)).not.toContain(day);
    expect(await partialLocalDayKeys(user.id, from, to, APP_TIMEZONE)).toContain(day);
    expect((await completedSessionIdsByLocalDay(user.id, from, to, APP_TIMEZONE))[day] ?? []).not.toContain(
      dayId,
    );

    const home = await getHomeToday(user.id, now, APP_TIMEZONE);
    expect(home.completedDayIds).not.toContain(dayId);
    expect(home.partialDayIds).toContain(dayId);
    expect(await getShareCardView(user.id, saved.id)).not.toBeNull();
    expect(buildProgressSummary([saved], "lb").sessionCount).toBe(1);

    const finished = await logRoundSessionForUser({
      userId: user.id,
      type: "bag",
      programDayId: dayId,
      roundsCompleted: target.plannedRounds,
      workSeconds: target.workSeconds,
      restSeconds: target.restSeconds,
      now,
    });
    expect(finished.id).toBe(saved.id);
    expect(finished.status).toBe("complete");
    expect(await prisma.workoutSession.count({ where: { userId: user.id } })).toBe(1);
    expect(await completedLocalDayKeys(user.id, from, to, APP_TIMEZONE)).toContain(day);
    expect(await partialLocalDayKeys(user.id, from, to, APP_TIMEZONE)).not.toContain(day);
  });

  it("updates one free grappling log instead of inserting a second", async () => {
    const user = await makeUser("grappling-rounds@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: { timeZone: APP_TIMEZONE },
    });
    const now = new Date();
    const first = await logRoundSessionForUser({
      userId: user.id,
      type: "grappling",
      roundsCompleted: 2,
      configuredRounds: 5,
      workSeconds: 180,
      restSeconds: 60,
      notes: "Stay heavy.",
      rpe: 6,
      now,
    });
    const second = await logRoundSessionForUser({
      userId: user.id,
      type: "grappling",
      roundsCompleted: 5,
      configuredRounds: 5,
      workSeconds: 180,
      restSeconds: 60,
      notes: "Stay heavy.",
      rpe: 6,
      now,
    });
    expect(first.status).toBe("partial");
    expect(first.programDayId).toBeNull();
    expect(second.id).toBe(first.id);
    expect(second.status).toBe("complete");
    expect(second.sets).toHaveLength(5);
    expect(await prisma.workoutSession.count({ where: { userId: user.id } })).toBe(1);
  });

  it("saves a short assault bike ride as partial and a full tabata as done", async () => {
    const user = await makeUser("bike-rounds-partial@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: { timeZone: APP_TIMEZONE, experienceLevel: "intermediate" },
    });
    const catalog = await findDemoTrainingCatalog();
    const bikeDay = [...(catalog.strength?.days ?? []), ...(catalog.skill?.days ?? [])].find((day) =>
      day.exercises.some((exercise) => /bike/i.test(exercise.name)),
    );
    expect(bikeDay?.id).toBeTruthy();
    const now = new Date();
    const choice = bikeChoiceById("tabata");
    expect(choice).toBeTruthy();
    const short = await logBikeRoundsForUser({
      userId: user.id,
      choice: choice!,
      roundsCompleted: 3,
      programDayId: bikeDay!.id,
      notes: "Cut it short.",
      rpe: 9,
      now,
    });
    expect(short.status).toBe("partial");
    expect(short.programDayId).toBe(bikeDay!.id);
    expect(short.sets).toHaveLength(3);
    expect(short.notes).toBe("Cut it short.");
    expect(short.sessionRpe).toBe(9);

    const from = addZonedDays(now, -1, APP_TIMEZONE);
    const to = addZonedDays(now, 2, APP_TIMEZONE);
    const day = dayKey(now, APP_TIMEZONE);
    expect(await completedLocalDayKeys(user.id, from, to, APP_TIMEZONE)).not.toContain(day);
    expect(await partialLocalDayKeys(user.id, from, to, APP_TIMEZONE)).toContain(day);

    const full = await logBikeRoundsForUser({
      userId: user.id,
      choice: choice!,
      roundsCompleted: 8,
      programDayId: bikeDay!.id,
      now,
    });
    expect(full.id).toBe(short.id);
    expect(full.status).toBe("complete");
    expect(await prisma.workoutSession.count({ where: { userId: user.id, programDayId: bikeDay!.id } })).toBe(1);
    expect(await completedLocalDayKeys(user.id, from, to, APP_TIMEZONE)).toContain(day);
  });

  it("still withholds a short lift from completedLocalDayKeys", async () => {
    const user = await makeUser("short-lift-still-open@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: { timeZone: APP_TIMEZONE },
    });
    const catalog = await findDemoTrainingCatalog();
    const day = catalog.strength?.days.find((row) => {
      const dose = row.exercises.reduce((sum, exercise) => sum + Math.max(0, exercise.sets ?? 0), 0);
      return dose > 2;
    });
    expect(day?.id).toBeTruthy();
    const now = new Date();
    await prisma.workoutSession.create({
      data: {
        userId: user.id,
        programDayId: day!.id,
        title: day!.title,
        performedAt: now,
        status: "complete",
        plannedSetCount: null,
        sets: {
          create: [
            {
              exerciseName: day!.exercises[0]!.name,
              setNumber: 1,
              reps: 5,
              loadValue: 40,
              loadUnit: "lb",
              completed: true,
            },
          ],
        },
      },
    });
    const from = addZonedDays(now, -1, APP_TIMEZONE);
    const to = addZonedDays(now, 2, APP_TIMEZONE);
    expect(await completedLocalDayKeys(user.id, from, to, APP_TIMEZONE)).not.toContain(
      dayKey(now, APP_TIMEZONE),
    );
  });

  it("keeps the member frame classes and the partial today color", () => {
    const frame = source("src/components/MemberFrame.tsx");
    expect(frame).toContain("min-w-0");
    expect(frame).toContain("pb-36");
    const today = source("src/components/home/HomeToday.tsx");
    expect(today).toContain("data-session-partial");
    expect(today).toContain("#FF3B3B");
    expect(today).toContain("text-accent");
    const timer = source("src/components/timer/RoundTimer.tsx");
    expect(timer).toContain("startRoundLogAction");
    expect(timer).toContain('name="programDayId"');
    expect(source("src/components/timer/BikeClockScreen.tsx")).toContain("logBikeTimerAction");
  });
});
