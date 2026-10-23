import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { attachBikeChoice, bikeChoiceById, choiceToken } from "@/lib/bike-chooser";
import { isLogMode } from "@/lib/exercise-log-mode";
import { completedSessionIdsByLocalDay, partialLocalDayKeys } from "@/lib/chip-completion";
import { getHomeToday } from "@/lib/home";
import { sparringRoundsFromSets } from "@/lib/home-telemetry";
import { sessionProgressLabel } from "@/lib/logged-work";
import { buildProgressSummary } from "@/lib/progress";
import { prisma } from "@/lib/prisma";
import { findDemoTrainingCatalog } from "@/lib/programs";
import { exerciseProgressStateWord } from "@/lib/logged-work";
import {
  launchRoundLogFromClock,
  resolveSubmittedRoundLog,
  restSecondsFromRoundKey,
  ROUND_SET_CAP_SECONDS,
  roundFinishProgress,
  roundHistoryLine,
  roundLogFromClock,
  roundSessionDuration,
  roundTargetForProgramDay,
  SESSION_DURATION_CAP_SECONDS,
} from "@/lib/round-session";
import { formatTimerClock } from "@/lib/round-timer";
import { getShareCardView } from "@/lib/share-card-data";
import { APP_TIMEZONE, addZonedDays, dayKey } from "@/lib/timezone";
import {
  completedLocalDayKeys,
  logBikeRoundsForUser,
  logRoundSessionForUser,
  rateWorkoutSessionForUser,
  startWorkoutFromDay,
  updateWorkoutSessionForUser,
} from "@/lib/workouts";
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

describe("mid-timer round saves", () => {
  it("stores the configured rest and the work already finished", () => {
    expect(
      roundLogFromClock({
        phase: "rest",
        round: 1,
        totalRounds: 2,
        workSeconds: 15,
        restSeconds: 15,
        phaseElapsedSeconds: 6,
      }),
    ).toEqual({ roundsCompleted: 1, restSeconds: 15, elapsedSeconds: 15 });
    expect(
      resolveSubmittedRoundLog({
        rounds: 2,
        workSeconds: 15,
        restSeconds: 15,
        configuredRounds: 2,
        phase: "rest",
        timerRound: 1,
        phaseElapsedSeconds: 6,
        elapsedSeconds: 21,
      }),
    ).toEqual({ roundsCompleted: 1, restSeconds: 15, elapsedSeconds: 15 });
    expect(
      roundLogFromClock({
        phase: "work",
        round: 2,
        totalRounds: 3,
        workSeconds: 15,
        restSeconds: 15,
        phaseElapsedSeconds: 0,
      }),
    ).toEqual({ roundsCompleted: 1, restSeconds: 15, elapsedSeconds: 15 });
    expect(
      roundLogFromClock({
        phase: "work",
        round: 2,
        totalRounds: 3,
        workSeconds: 15,
        restSeconds: 15,
        phaseElapsedSeconds: 15,
      }).elapsedSeconds,
    ).toBe(30);
    expect(
      roundLogFromClock({
        phase: "rest",
        round: 2,
        totalRounds: 3,
        workSeconds: 15,
        restSeconds: 15,
        phaseElapsedSeconds: 0,
      }).elapsedSeconds,
    ).toBe(45);
    const restBeforeRound3 = roundLogFromClock({
      phase: "rest",
      round: 2,
      totalRounds: 3,
      workSeconds: 15,
      restSeconds: 15,
      phaseElapsedSeconds: 14,
    }).elapsedSeconds;
    expect(
      roundLogFromClock({
        phase: "work",
        round: 3,
        totalRounds: 3,
        workSeconds: 15,
        restSeconds: 15,
        phaseElapsedSeconds: 0,
      }).elapsedSeconds,
    ).toBe(restBeforeRound3);
  });

  it("does not save two rounds and a zero rest from a running timer", () => {
    // The clock is in the first rest. A stale form still has the setup's 2
    // rounds, rest 0 (elapsed rest written into the field), and a 0:30 total.
    // Phase present: the clock wins, and the configured rest is kept when it
    // arrives on its own field.
    expect(
      resolveSubmittedRoundLog({
        rounds: 2,
        workSeconds: 15,
        restSeconds: 0,
        configuredRounds: 2,
        configuredRestSeconds: 15,
        phase: "rest",
        timerRound: 1,
        phaseElapsedSeconds: 6,
        elapsedSeconds: 30,
      }),
    ).toEqual({ roundsCompleted: 1, restSeconds: 15, elapsedSeconds: 15 });
    // Phase stamp dropped. Same stale rounds/rest/total, clock position still set.
    expect(
      resolveSubmittedRoundLog({
        rounds: 2,
        workSeconds: 15,
        restSeconds: 0,
        configuredRounds: 2,
        configuredRestSeconds: 15,
        phase: "",
        timerRound: 1,
        phaseElapsedSeconds: 6,
        elapsedSeconds: 30,
      }),
    ).toEqual({ roundsCompleted: 1, restSeconds: 15, elapsedSeconds: 15 });
    // Without the configured-rest field the round count still cannot stay at 2.
    expect(
      resolveSubmittedRoundLog({
        rounds: 2,
        workSeconds: 15,
        restSeconds: 0,
        configuredRounds: 2,
        phase: "",
        timerRound: 1,
        phaseElapsedSeconds: 6,
        elapsedSeconds: 30,
      }).roundsCompleted,
    ).toBe(1);
    // Idle "log the setup" has no phase elapsed, so the form's rounds stand.
    expect(
      resolveSubmittedRoundLog({
        rounds: 2,
        workSeconds: 15,
        restSeconds: 15,
        configuredRounds: 2,
        phase: "",
        timerRound: 1,
        phaseElapsedSeconds: 0,
      }),
    ).toEqual({ roundsCompleted: 2, restSeconds: 15, elapsedSeconds: 45 });
    // Launch End must not substitute the configured round count or elapsed rest.
    expect(
      launchRoundLogFromClock({
        phase: "rest",
        round: 1,
        totalRounds: 2,
        workSeconds: 15,
        restSeconds: 15,
        phaseElapsedSeconds: 0,
      }),
    ).toEqual({ rounds: 1, restSeconds: 15, elapsedSeconds: 15 });
    expect(
      launchRoundLogFromClock({
        phase: "work",
        round: 1,
        totalRounds: 2,
        workSeconds: 15,
        restSeconds: 15,
        phaseElapsedSeconds: 6,
      }).rounds,
    ).toBe(0);
  });

  it("keeps a 1-of-2 and 1-of-8 finish partial", () => {
    const pads = roundFinishProgress({
      plannedExercises: [],
      sets: [
        {
          exerciseName: "Pad rounds",
          completed: true,
          durationSeconds: 180,
          prescriptionKey: "round:pads:60",
          logMode: "timed_round",
        },
      ],
      plannedSetCount: 2,
      status: "partial",
    });
    expect(pads).toEqual([
      { name: "Pad rounds", ticked: 1, planned: 2, state: "partial" },
    ]);

    const bikeSets = [
      {
        exerciseName: "Assault bike intervals",
        completed: true,
        durationSeconds: 20,
        prescriptionKey: attachBikeChoice("timer", choiceToken(bikeChoiceById("tabata")!)),
        logMode: "timed_round",
      },
    ];
    const bike = roundFinishProgress({
      plannedExercises: Array.from({ length: 8 }, () => ({
        name: "Assault bike intervals",
        sets: 1,
      })),
      sets: bikeSets,
      plannedSetCount: 8,
      status: "partial",
    });
    expect(bike).toEqual([
      { name: "Assault bike intervals", ticked: 1, planned: 8, state: "partial" },
    ]);
    const label = sessionProgressLabel(bike, { forcePartial: true });
    expect(label).toContain("1/8");
    expect(label).toContain("partial");
    expect(label).not.toContain("8/8");
    expect(label?.endsWith("complete")).toBe(false);
    expect(roundHistoryLine({ elapsedSeconds: 20, sets: bikeSets })).toBe(
      "1 round · 0:20 round · 0:10 rest · 0:20 total",
    );

    const mixed = roundFinishProgress({
      plannedExercises: [
        { name: "Bench press", sets: 2 },
        { name: "Row", sets: 3 },
      ],
      sets: [
        { exerciseName: "Bench press", completed: true, reps: 5 },
        { exerciseName: "Bench press", completed: true, reps: 5 },
        { exerciseName: "Row", completed: true, reps: 8 },
      ],
      status: "partial",
    });
    const bench = mixed.find((row) => row.name === "Bench press");
    expect(bench).toMatchObject({ ticked: 2, planned: 2, state: "complete" });
    expect(`${bench?.ticked}/${bench?.planned} · ${exerciseProgressStateWord(bench?.state ?? "")}`).toBe(
      "2/2 · done",
    );
    expect(mixed.find((row) => row.name === "Row")).toMatchObject({
      ticked: 1,
      planned: 3,
      state: "partial",
    });
    expect(
      roundHistoryLine({
        elapsedSeconds: 40 * 60,
        sets: [
          { exerciseName: "Bench press", completed: true, reps: 5, loadValue: 100 },
          {
            exerciseName: "Assault bike intervals",
            completed: true,
            durationSeconds: 20,
            prescriptionKey: attachBikeChoice("timer", choiceToken(bikeChoiceById("tabata")!)),
          },
        ],
      }),
    ).toBeNull();
  });

  it("counts timer sparring rounds on the home rounds tile", () => {
    expect(
      sparringRoundsFromSets([
        {
          exerciseName: "Sparring rounds",
          prescriptionKey: "round:sparring:60",
          durationSeconds: 180,
          completed: true,
        },
        {
          exerciseName: "Sparring rounds",
          prescriptionKey: "round:sparring:60",
          durationSeconds: 180,
          completed: true,
        },
        {
          exerciseName: "Heavy bag rounds",
          prescriptionKey: "round:bag:60",
          durationSeconds: 180,
          completed: true,
        },
      ]),
    ).toBe(2);
  });
});

describe("round session logs", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("saves a full bag log once and keeps the skill day's planned count", async () => {
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
    expect(saved.status).toBe("partial");
    expect(saved.programDayId).toBe(dayId);
    expect(saved.title).toBe(target.exerciseName);
    expect(saved.notes).toBe("Jab stayed long.");
    expect(saved.sessionRpe).toBe(8);
    expect(saved.plannedSetCount).toBe(target.daySetCount);
    expect(saved.plannedSetCount).toBeGreaterThan(target.plannedRounds);
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
    expect(await completedLocalDayKeys(user.id, from, to, APP_TIMEZONE)).not.toContain(day);
    expect(await partialLocalDayKeys(user.id, from, to, APP_TIMEZONE)).toContain(day);
    expect((await completedSessionIdsByLocalDay(user.id, from, to, APP_TIMEZONE))[day] ?? []).not.toContain(
      dayId,
    );

    const home = await getHomeToday(user.id, now, APP_TIMEZONE);
    expect(home.completedDayIds).not.toContain(dayId);
    expect(home.partialDayIds).toContain(dayId);

    const progress = buildProgressSummary([saved], "lb");
    expect(progress.sessionCount).toBe(1);
    expect(progress.lastSessionTitle).toBe(target.exerciseName);
    expect(await getShareCardView(user.id, saved.id)).not.toBeNull();
  });

  it("saves a mid-rest bag log as one partial round and keeps the configured rest", async () => {
    const user = await makeUser("bag-mid-rest@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: { timeZone: APP_TIMEZONE },
    });
    const now = new Date();
    const clock = resolveSubmittedRoundLog({
      rounds: 2,
      workSeconds: 15,
      restSeconds: 0,
      configuredRounds: 2,
      configuredRestSeconds: 15,
      phase: "rest",
      timerRound: 1,
      phaseElapsedSeconds: 6,
      elapsedSeconds: 30,
    });
    const saved = await logRoundSessionForUser({
      userId: user.id,
      type: "bag",
      roundsCompleted: clock.roundsCompleted,
      configuredRounds: 2,
      workSeconds: 15,
      restSeconds: clock.restSeconds,
      elapsedSeconds: clock.elapsedSeconds,
      now,
    });
    expect(saved.status).toBe("partial");
    expect(saved.sets).toHaveLength(1);
    expect(saved.plannedSetCount).toBe(2);
    expect(restSecondsFromRoundKey(saved.sets[0]?.prescriptionKey)).toBe(15);
    expect(saved.elapsedSeconds).toBe(15);
    const line = roundHistoryLine(saved);
    expect(line).toContain("1 round");
    expect(line).toContain("0:15 rest");
    expect(line).toContain("0:15 total");
    expect(line).not.toContain("0:06");
    expect(line).not.toContain("2 rounds");
    expect(line).not.toContain("0:00 rest");
    const finish = roundFinishProgress({
      plannedExercises: [],
      sets: saved.sets,
      plannedSetCount: saved.plannedSetCount,
      status: saved.status,
    });
    expect(finish[0]).toMatchObject({ ticked: 1, planned: 2, state: "partial" });
    expect(`${finish[0]?.ticked}/${finish[0]?.planned}`).not.toBe("2/2");
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
    expect(saved.plannedSetCount).toBe(target.daySetCount);
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
    expect(finished.status).toBe("partial");
    expect(finished.plannedSetCount).toBe(target.daySetCount);
    expect(await prisma.workoutSession.count({ where: { userId: user.id } })).toBe(1);
    expect(await completedLocalDayKeys(user.id, from, to, APP_TIMEZONE)).not.toContain(day);
    expect(await partialLocalDayKeys(user.id, from, to, APP_TIMEZONE)).toContain(day);
  });

  it("keeps Shadowbox and the skill day's 13 planned sets when bag rounds are saved", async () => {
    const user = await makeUser("bag-keeps-shadow@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: { timeZone: APP_TIMEZONE, experienceLevel: "intermediate" },
    });
    const now = new Date();
    const catalog = await findDemoTrainingCatalog();
    const day = catalog.skill?.days.find((row) => /intelligent jab/i.test(row.title));
    expect(day?.id).toBeTruthy();
    const seeded = (day?.exercises ?? []).reduce(
      (sum, exercise) => sum + Math.max(0, Math.round(exercise.sets ?? 0)),
      0,
    );
    // Seed: shadow, shadow, jab x3, bag rounds x7, cool-down.
    expect(seeded).toBe(13);
    expect(day!.exercises.some((exercise) => /shadowbox/i.test(exercise.name))).toBe(true);
    expect(day!.exercises.some((exercise) => exercise.sets === 3 && /jab/i.test(exercise.name))).toBe(true);
    const target = await roundTargetForProgramDay({
      userId: user.id,
      programDayId: day!.id,
      type: "bag",
      now,
    });
    expect(target?.plannedRounds).toBe(7);
    const planSets = day!.exercises.flatMap((exercise) =>
      Array.from({ length: Math.max(0, Math.round(exercise.sets ?? 0)) }, (_, index) => ({
        exerciseName: exercise.name,
        setNumber: index + 1,
        sortOrder: exercise.sortOrder * 10 + index,
        loadUnit: "lb",
        logMode: exercise.logMode || "timed",
        completed: false,
      })),
    );
    expect(planSets).toHaveLength(13);
    const opened = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        programDayId: day!.id,
        title: day!.title,
        performedAt: now,
        status: "draft",
        plannedSetCount: planSets.length,
        sets: { create: planSets },
      },
      include: { sets: true },
    });
    expect(opened.plannedSetCount).toBe(13);
    expect(opened.sets.some((set) => /shadowbox/i.test(set.exerciseName))).toBe(true);
    const otherBefore = opened.sets
      .filter((set) => !/bag rounds/i.test(set.exerciseName))
      .map((set) => set.exerciseName)
      .sort();

    const saved = await logRoundSessionForUser({
      userId: user.id,
      type: "bag",
      programDayId: day!.id,
      roundsCompleted: target!.plannedRounds,
      workSeconds: target!.workSeconds,
      restSeconds: 0,
      now,
    });
    expect(saved.id).toBe(opened.id);
    expect(saved.status).toBe("partial");
    expect(saved.title).toBe(day!.title);
    expect(target!.daySetCount).toBe(11);
    expect(saved.plannedSetCount).toBe(target!.daySetCount);
    expect(saved.sets).toHaveLength(13);
    const resumed = await startWorkoutFromDay({
      userId: user.id,
      programDayId: day!.id,
      preferredUnits: "lb",
      scale: { experienceLevel: "intermediate" },
      planAnchor: now,
      timeZone: APP_TIMEZONE,
      now,
    });
    expect(resumed.id).toBe(saved.id);
    const shadow = saved.sets.find((set) => /shadowbox/i.test(set.exerciseName));
    expect(shadow).toBeTruthy();
    const continued = await updateWorkoutSessionForUser({
      userId: user.id,
      workoutId: saved.id,
      title: saved.title,
      performedAt: now,
      notes: saved.notes,
      status: "draft",
      sets: saved.sets.map((set) => ({
        exerciseName: set.exerciseName,
        setNumber: set.setNumber,
        reps: set.reps,
        loadValue: set.loadValue,
        loadUnit: "lb" as const,
        logMode: isLogMode(set.logMode) ? set.logMode : undefined,
        durationSeconds: set.id === shadow!.id ? 180 : set.durationSeconds,
        completed: set.id === shadow!.id ? true : set.completed,
        notes: set.notes,
        prescriptionKey: set.prescriptionKey,
        rir: set.rir,
      })),
      timeZone: APP_TIMEZONE,
    });
    expect(continued.status).toBe("draft");
    expect(continued.sets.some((set) => /shadowbox/i.test(set.exerciseName) && set.completed)).toBe(true);
    expect(saved.sets.filter((set) => /bag rounds/i.test(set.exerciseName))).toHaveLength(
      target!.plannedRounds,
    );
    expect(saved.sets.some((set) => /shadowbox/i.test(set.exerciseName))).toBe(true);
    expect(
      saved.sets
        .filter((set) => !/bag rounds/i.test(set.exerciseName))
        .map((set) => set.exerciseName)
        .sort(),
    ).toEqual(otherBefore);
    expect(restSecondsFromRoundKey(saved.sets.find((set) => /bag rounds/i.test(set.exerciseName))?.prescriptionKey)).toBe(
      target!.restSeconds,
    );
    const from = addZonedDays(now, -1, APP_TIMEZONE);
    const to = addZonedDays(now, 2, APP_TIMEZONE);
    const loggedDay = dayKey(now, APP_TIMEZONE);
    expect(await completedLocalDayKeys(user.id, from, to, APP_TIMEZONE)).not.toContain(loggedDay);
    expect(await partialLocalDayKeys(user.id, from, to, APP_TIMEZONE)).toContain(loggedDay);
  });

  it("lets a partial round log take a difficulty rating", async () => {
    const user = await makeUser("partial-round-rating@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: { timeZone: APP_TIMEZONE },
    });
    const saved = await logRoundSessionForUser({
      userId: user.id,
      type: "pads",
      roundsCompleted: 1,
      configuredRounds: 3,
      workSeconds: 180,
      restSeconds: 60,
      now: new Date(),
    });
    expect(saved.status).toBe("partial");
    const rated = await rateWorkoutSessionForUser({
      userId: user.id,
      workoutId: saved.id,
      difficultyRating: "hard",
    });
    expect(rated.difficultyRating).toBe("hard");
  });

  it("trims round and bike efforts to 60 minutes and the session to 4 hours", async () => {
    const user = await makeUser("round-duration-cap@example.com");
    await prisma.profile.update({
      where: { userId: user.id },
      data: { timeZone: APP_TIMEZONE },
    });
    const now = new Date();
    const saved = await logRoundSessionForUser({
      userId: user.id,
      type: "grappling",
      roundsCompleted: 2,
      configuredRounds: 2,
      workSeconds: 90 * 60,
      restSeconds: 60,
      elapsedSeconds: 5 * 60 * 60,
      now,
    });
    expect(saved.status).toBe("complete");
    expect(saved.sets.every((set) => set.durationSeconds === ROUND_SET_CAP_SECONDS)).toBe(true);
    expect(saved.elapsedSeconds).toBe(SESSION_DURATION_CAP_SECONDS);

    const bike = await logRoundSessionForUser({
      userId: user.id,
      type: "bike",
      roundsCompleted: 1,
      configuredRounds: 1,
      workSeconds: 20,
      restSeconds: 10,
      elapsedSeconds: 90 * 60,
      sets: [
        {
          exerciseName: "Assault bike intervals",
          setNumber: 1,
          reps: null,
          loadValue: null,
          loadUnit: "lb",
          logMode: "timed_round",
          durationSeconds: 90 * 60,
          completed: true,
          prescriptionKey: "round:bike:10",
        },
      ],
      now,
    });
    expect(bike.sets[0]?.durationSeconds).toBe(ROUND_SET_CAP_SECONDS);
    expect(bike.elapsedSeconds).toBe(90 * 60);
    expect(bike.elapsedSeconds).toBeLessThanOrEqual(SESSION_DURATION_CAP_SECONDS);
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

  it("rejects a rating when a partial session has no work", async () => {
    const user = await makeUser("empty-partial-rate@example.com");
    const empty = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        title: "Empty partial",
        status: "partial",
        performedAt: new Date(),
        sets: {
          create: {
            exerciseName: "Squat",
            setNumber: 1,
            completed: false,
            loadUnit: "lb",
          },
        },
      },
    });
    await expect(
      rateWorkoutSessionForUser({
        userId: user.id,
        workoutId: empty.id,
        difficultyRating: "just_right",
      }),
    ).rejects.toThrow(/Log a set/);
    const worked = await prisma.workoutSession.create({
      data: {
        userId: user.id,
        title: "Short partial",
        status: "partial",
        performedAt: new Date(),
        sets: {
          create: {
            exerciseName: "Squat",
            setNumber: 1,
            reps: 5,
            completed: true,
            loadUnit: "lb",
          },
        },
      },
    });
    const rated = await rateWorkoutSessionForUser({
      userId: user.id,
      workoutId: worked.id,
      difficultyRating: "just_right",
    });
    expect(rated.difficultyRating).toBe("just_right");
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
    expect(timer).toContain("roundLogFromClock");
    expect(timer).toContain('name="programDayId"');
    expect(timer).toContain('name="phase"');
    expect(source("src/components/timer/TimerDurationSteppers.tsx")).toContain("onPointerDown");
    expect(source("src/components/timer/TimerDurationSteppers.tsx")).toContain("applyStepperTap");
    expect(source("src/components/timer/TimerDurationSteppers.tsx")).not.toContain("setTimeout");
    expect(source("next.config.ts")).toContain('source: "/train"');
    expect(source("src/components/timer/BikeClockScreen.tsx")).toContain("logBikeTimerAction");
  });
});
