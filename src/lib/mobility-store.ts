import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import {
  getMobilityRoutine,
  isKickMark,
  kickGapOver10,
  mobilityLogKey,
  prescribedSeconds,
  SIT_REACH_LEVELS,
  sideGapOver10,
  type KickMark,
} from "@/lib/mobility";
import { isReadinessScore, readinessSuggestion, type ReadinessScores } from "@/lib/readiness";
import { estimatedStrength } from "@/lib/testing-week";
import { bikeWeekIndex } from "@/lib/bike-sessions";
import { APP_TIMEZONE } from "@/lib/timezone";
import type { LoadUnit } from "@/lib/units";

/**
 * Saved mobility work lives here, separate from workout streaks.
 * Later, a streak counter should treat a MobilitySession on a local day as
 * activity when durationSeconds >= 480 (8 minutes). A Mobility badge group
 * can read the same rows (routine counts, check-ins, neck sessions).
 * This module does not award badges.
 */

export type MobilitySetInput = {
  exerciseKey: string;
  side: string;
  holdSeconds: number | null;
  reps: number | null;
  sets: number | null;
  depthValue: number | null;
  depthUnit: string;
  heightMark: string;
  painFlag: boolean;
};

function optionalInt(value: number | null, label: string, max: number) {
  if (value == null || Number.isNaN(value)) return null;
  if (!Number.isFinite(value) || value < 0 || value > max) {
    throw new AppError("MOBILITY", `${label} should be between 0 and ${max}.`);
  }
  return Math.round(value);
}

function optionalFloat(value: number | null, label: string, max: number) {
  if (value == null || Number.isNaN(value)) return null;
  if (!Number.isFinite(value) || value < 0 || value > max) {
    throw new AppError("MOBILITY", `${label} should be between 0 and ${max}.`);
  }
  return Math.round(value * 10) / 10;
}

export async function saveMobilitySession(input: {
  userId: string;
  routineId: string;
  performedAt?: Date;
  painFlag?: boolean;
  effort?: number | null;
  notes?: string;
  sets: MobilitySetInput[];
}) {
  const routine = getMobilityRoutine(input.routineId);
  if (!routine) throw new AppError("MOBILITY", "That routine is not on the list.");
  const effort =
    input.effort == null || Number.isNaN(input.effort) ? null : optionalInt(input.effort, "Effort", 5);
  if (effort != null && effort < 1) {
    throw new AppError("MOBILITY", "Effort should be from 1 to 5.");
  }
  const painFlag = Boolean(input.painFlag) || input.sets.some((row) => row.painFlag);
  const sets = input.sets.slice(0, 40).map((row, index) => ({
    exerciseKey: row.exerciseKey.slice(0, 80),
    side: row.side === "left" || row.side === "right" ? row.side : "",
    setNumber: index + 1,
    holdSeconds: optionalInt(row.holdSeconds, "Hold", 600),
    reps: optionalInt(row.reps, "Reps", 200),
    sets: optionalInt(row.sets, "Sets", 20),
    depthValue: optionalFloat(row.depthValue, "Depth", 300),
    depthUnit: row.depthUnit === "in" || row.depthUnit === "cm" ? row.depthUnit : "",
    heightMark: isKickMark(row.heightMark) ? row.heightMark : "",
    painFlag: Boolean(row.painFlag),
  }));
  return prisma.mobilitySession.create({
    data: {
      userId: input.userId,
      routineId: routine.id,
      performedAt: input.performedAt ?? new Date(),
      durationSeconds: prescribedSeconds(routine),
      painFlag,
      effort,
      notes: (input.notes ?? "").slice(0, 500),
      status: "complete",
      sets: { create: sets },
    },
    include: { sets: true },
  });
}

export async function listMobilitySessionsForUser(userId: string, routineId?: string) {
  return prisma.mobilitySession.findMany({
    where: { userId, ...(routineId ? { routineId } : {}) },
    orderBy: { performedAt: "desc" },
    include: { sets: true },
    take: 30,
  });
}

export async function previousMobilityLogs(userId: string, routineId: string) {
  const latest = await prisma.mobilitySession.findFirst({
    where: { userId, routineId, status: "complete" },
    orderBy: { performedAt: "desc" },
    include: { sets: true },
  });
  const map = new Map<string, NonNullable<typeof latest>["sets"][number]>();
  if (!latest) return map;
  for (const row of latest.sets) {
    map.set(mobilityLogKey(row.exerciseKey, row.side), row);
  }
  return map;
}

export type CheckInInput = {
  sitReachValue: number | null;
  sitReachUnit: string;
  sitReachLevel: string;
  frontSplitLeft: number | null;
  frontSplitRight: number | null;
  sideSplit: number | null;
  lengthUnit: string;
  hipLeft: number | null;
  hipRight: number | null;
  ankleLeft: number | null;
  ankleRight: number | null;
  kickFrontLeft: string;
  kickFrontRight: string;
  kickSideLeft: string;
  kickSideRight: string;
  shoulderGap: number | null;
  painFlag: boolean;
  notes: string;
};

function score02(value: number | null, label: string) {
  if (value == null || Number.isNaN(value)) return null;
  if (value !== 0 && value !== 1 && value !== 2) {
    throw new AppError("MOBILITY", `${label} is 0, 1, or 2.`);
  }
  return value;
}

function kick(value: string): KickMark | "" {
  return isKickMark(value) ? value : "";
}

export function checkInGaps(row: {
  frontSplitLeft: number | null;
  frontSplitRight: number | null;
  hipLeft: number | null;
  hipRight: number | null;
  ankleLeft: number | null;
  ankleRight: number | null;
  kickFrontLeft: string;
  kickFrontRight: string;
  kickSideLeft: string;
  kickSideRight: string;
}) {
  return {
    frontSplit: sideGapOver10(row.frontSplitLeft, row.frontSplitRight),
    hip: sideGapOver10(row.hipLeft, row.hipRight),
    ankle: sideGapOver10(row.ankleLeft, row.ankleRight),
    kickFront: kickGapOver10(row.kickFrontLeft, row.kickFrontRight),
    kickSide: kickGapOver10(row.kickSideLeft, row.kickSideRight),
  };
}

export async function saveMobilityCheckIn(userId: string, input: CheckInInput, performedAt = new Date()) {
  const level = (SIT_REACH_LEVELS as readonly string[]).includes(input.sitReachLevel)
    ? input.sitReachLevel
    : "";
  const lengthUnit = input.lengthUnit === "in" ? "in" : "cm";
  const row = await prisma.mobilityCheckIn.create({
    data: {
      userId,
      performedAt,
      sitReachValue: optionalFloat(input.sitReachValue, "Sit-and-reach", 80),
      sitReachUnit: input.sitReachUnit === "in" || input.sitReachUnit === "cm" ? input.sitReachUnit : lengthUnit,
      sitReachLevel: level,
      frontSplitLeft: optionalFloat(input.frontSplitLeft, "Front split", 120),
      frontSplitRight: optionalFloat(input.frontSplitRight, "Front split", 120),
      sideSplit: optionalFloat(input.sideSplit, "Side split", 120),
      lengthUnit,
      hipLeft: score02(input.hipLeft, "90/90"),
      hipRight: score02(input.hipRight, "90/90"),
      ankleLeft: optionalFloat(input.ankleLeft, "Ankle", 30),
      ankleRight: optionalFloat(input.ankleRight, "Ankle", 30),
      kickFrontLeft: kick(input.kickFrontLeft),
      kickFrontRight: kick(input.kickFrontRight),
      kickSideLeft: kick(input.kickSideLeft),
      kickSideRight: kick(input.kickSideRight),
      shoulderGap: optionalFloat(input.shoulderGap, "Shoulder reach", 40),
      painFlag: Boolean(input.painFlag),
      notes: input.notes.slice(0, 500),
    },
  });
  return { row, gaps: checkInGaps(row) };
}

export async function listMobilityCheckIns(userId: string) {
  return prisma.mobilityCheckIn.findMany({
    where: { userId },
    orderBy: { performedAt: "asc" },
    take: 24,
  });
}

export async function saveReadinessCheckIn(input: {
  userId: string;
  dayKey: string;
  scores: ReadinessScores;
  restingHr?: number | null;
}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dayKey)) {
    throw new AppError("READINESS", "That day is not valid.");
  }
  for (const [label, value] of [
    ["Sleep", input.scores.sleep],
    ["Soreness", input.scores.soreness],
    ["Energy", input.scores.energy],
  ] as const) {
    if (!isReadinessScore(value)) {
      throw new AppError("READINESS", `${label} is a score from 1 to 5.`);
    }
  }
  const hr =
    input.restingHr == null || Number.isNaN(input.restingHr)
      ? null
      : optionalInt(input.restingHr, "Resting heart rate", 220);
  if (hr != null && hr < 30) {
    throw new AppError("READINESS", "Resting heart rate should be at least 30.");
  }
  const saved = await prisma.readinessCheckIn.upsert({
    where: { userId_dayKey: { userId: input.userId, dayKey: input.dayKey } },
    create: {
      userId: input.userId,
      dayKey: input.dayKey,
      sleep: input.scores.sleep,
      soreness: input.scores.soreness,
      energy: input.scores.energy,
      restingHr: hr,
    },
    update: {
      sleep: input.scores.sleep,
      soreness: input.scores.soreness,
      energy: input.scores.energy,
      restingHr: hr,
    },
  });
  return {
    saved,
    suggestion: readinessSuggestion(input.scores),
  };
}

export async function getReadinessForDay(userId: string, dayKey: string) {
  return prisma.readinessCheckIn.findUnique({
    where: { userId_dayKey: { userId, dayKey } },
  });
}

export type TestingInput = {
  broadJumpValue: number | null;
  broadJumpUnit: string;
  strengthExercise: string;
  strengthLoad: number | null;
  strengthReps: number | null;
  strengthUnit: LoadUnit;
  bikeSprintValue: number | null;
  bikeSprintUnit: string;
  bikeFiveMinValue: number | null;
  bikeFiveMinUnit: string;
  restingHr: number | null;
  notes: string;
};

export async function saveTestingResult(
  userId: string,
  input: TestingInput,
  performedAt = new Date(),
  timeZone = APP_TIMEZONE,
) {
  const lift =
    input.strengthExercise === "Trap-bar deadlift" || input.strengthExercise === "Squat"
      ? input.strengthExercise
      : "";
  const load = optionalFloat(input.strengthLoad, "Strength load", 800);
  const reps = optionalInt(input.strengthReps, "Strength reps", 12);
  const estimate = load != null && reps != null ? estimatedStrength(load, reps) : null;
  return prisma.testingResult.create({
    data: {
      userId,
      performedAt,
      weekIndex: bikeWeekIndex(performedAt, timeZone),
      broadJumpValue: optionalFloat(input.broadJumpValue, "Broad jump", 400),
      broadJumpUnit: input.broadJumpUnit === "in" ? "in" : "cm",
      strengthExercise: lift,
      strengthLoad: load,
      strengthReps: reps,
      strengthUnit: input.strengthUnit,
      strengthEstimate: estimate,
      bikeSprintValue: optionalFloat(input.bikeSprintValue, "Bike sprint", 2000),
      bikeSprintUnit: input.bikeSprintUnit === "watts" ? "watts" : input.bikeSprintValue != null ? "rpm" : "",
      bikeFiveMinValue: optionalFloat(input.bikeFiveMinValue, "5-minute bike", 20),
      bikeFiveMinUnit: input.bikeFiveMinUnit === "mi" ? "mi" : "km",
      restingHr: input.restingHr == null ? null : optionalInt(input.restingHr, "Resting heart rate", 220),
      notes: input.notes.slice(0, 500),
    },
  });
}

export async function listTestingResults(userId: string) {
  return prisma.testingResult.findMany({
    where: { userId },
    orderBy: { performedAt: "desc" },
    take: 12,
  });
}

export async function latestMobilityAnchor(userId: string) {
  const first = await prisma.mobilitySession.findFirst({
    where: { userId },
    orderBy: { performedAt: "asc" },
    select: { performedAt: true },
  });
  return first?.performedAt ?? null;
}
