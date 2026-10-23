import { prisma } from "@/lib/prisma";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { findDemoTrainingCatalog } from "@/lib/programs";
import { easePlanForUser } from "@/lib/recovery-ease";
import { scaleDemoCatalog } from "@/lib/training-scale";
import { planForDate, planWeekIndex, resolvePlanSessions } from "@/lib/week-plan";
import { getWeekPlanSwapsForUser } from "@/lib/week-plan-swap-store";
import {
  attachBikeChoice,
  bikeTimerRoundCount,
  choiceToken,
  customBikeChoice,
  type BikeChoice,
} from "@/lib/bike-chooser";
import { bikeSetDurationSeconds } from "@/lib/bike-interval-timer";
import { highestSetNumber } from "@/lib/logger-insert";
import type { LoadUnit } from "@/lib/units";
import type { LogMode } from "@/lib/exercise-log-mode";
import {
  roundTargetFromExercises,
  type RoundExercise,
  type RoundSessionType,
} from "@/lib/round-session";

export const BIKE_TIMER_EXERCISE = "Assault bike intervals";

/** A clock spec the logger can save even when rest is 0. The chooser rejects that rest. */
export function loggerChoiceFromSession(session: {
  name?: string;
  focus?: string;
  workSeconds: number;
  restSeconds: number;
  roundsPerSet: number;
  warmupSeconds?: number;
  cooldownSeconds?: number;
  repeatRounds?: number;
  restBetweenRoundsSeconds?: number;
  blocks?: number;
}): BikeChoice {
  const workSeconds = Math.min(3600, Math.max(1, Math.round(session.workSeconds) || 15));
  const restSeconds = Math.min(3600, Math.max(0, Math.round(session.restSeconds) || 0));
  const roundsPerSet = Math.min(50, Math.max(1, Math.round(session.roundsPerSet) || 1));
  const repeatRounds = Math.min(20, Math.max(1, Math.round(session.repeatRounds ?? 1) || 1));
  return {
    id: "custom",
    name: (session.name || BIKE_TIMER_EXERCISE).slice(0, 80),
    description: session.focus || "Bike",
    goal: "anaerobic",
    level: "intermediate",
    plain: `${workSeconds}s work / ${restSeconds}s rest × ${roundsPerSet}`,
    spec: {
      workSeconds,
      restSeconds,
      roundsPerSet,
      warmupSeconds: session.warmupSeconds,
      cooldownSeconds: session.cooldownSeconds,
      repeatRounds,
      restBetweenRoundsSeconds: session.restBetweenRoundsSeconds,
      blocks: session.blocks,
    },
  };
}

/**
 * Same token as the live custom timer when the numbers fit `customBikeChoice`.
 * Wider backfill values (rest 0, work past 2 minutes) fall through to the logger choice.
 */
export function choiceForBackfill(input: {
  workSeconds: number;
  restSeconds: number;
  roundsPerSet: number;
  repeatRounds?: number;
  restBetweenRoundsSeconds?: number;
  warmupSeconds?: number;
  cooldownSeconds?: number;
}): BikeChoice {
  return (
    customBikeChoice({
      workSeconds: input.workSeconds,
      restSeconds: input.restSeconds,
      rounds: input.roundsPerSet,
      warmupSeconds: input.warmupSeconds,
      cooldownSeconds: input.cooldownSeconds,
      repeatRounds: input.repeatRounds,
      restBetweenRoundsSeconds: input.restBetweenRoundsSeconds,
    }) ??
    loggerChoiceFromSession({
      workSeconds: input.workSeconds,
      restSeconds: input.restSeconds,
      roundsPerSet: input.roundsPerSet,
      warmupSeconds: input.warmupSeconds,
      cooldownSeconds: input.cooldownSeconds,
      repeatRounds: input.repeatRounds,
      restBetweenRoundsSeconds: input.restBetweenRoundsSeconds,
    })
  );
}

export type BikeTimerSet = {
  exerciseName: string;
  setNumber: number;
  reps: null;
  loadValue: null;
  loadUnit: LoadUnit;
  logMode: LogMode;
  durationSeconds: number;
  completed: true;
  prescriptionKey: string;
};

/** Today's plan, scaled the same way Train and the bike logger read it. */
export async function loadScheduledPlanSessions(userId: string, now = new Date()) {
  const [profile, swaps, catalog, account] = await Promise.all([
    getProfileForUser(userId),
    getWeekPlanSwapsForUser(userId),
    findDemoTrainingCatalog(),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);
  const tz = await timeZoneForUser(userId, profile?.timeZone ?? null);
  const prefs = {
    primaryFocus: profile?.primaryFocus,
    weeklyAvailability: profile?.weeklyAvailability ?? [],
    sessionsPerWeek: profile?.sessionsPerWeek ?? null,
    trainingFocus: profile?.trainingFocus,
    liftDaysPerWeek: profile?.liftDaysPerWeek,
    experienceLevel: profile?.experienceLevel,
    email: account?.email,
    outsideTraining: profile?.outsideTraining,
    planAnchor: profile?.onboardingCompletedAt ?? null,
  };
  const built = planForDate(prefs, now, tz, swaps);
  const eased = await easePlanForUser(userId, now, tz, built);
  const scaled = scaleDemoCatalog(catalog, {
    experienceLevel: profile?.experienceLevel,
    competitionStatus: profile?.competitionStatus,
    weightAccess: profile?.weightAccess,
    weekIndex: planWeekIndex(now, tz, profile?.onboardingCompletedAt ?? null),
  });
  return resolvePlanSessions(eased.plan, scaled);
}

/** Today's scheduled bike program day, when the plan has one. */
export async function scheduledBikeProgramDayId(userId: string, now = new Date()) {
  const sessions = await loadScheduledPlanSessions(userId, now);
  const bike = sessions.find((session) => session.dayId && session.logHref);
  return bike?.dayId ?? null;
}

/** Today's bag, pads, sparring, grappling, or bike day, when the plan has one. */
export async function scheduledRoundPlanTarget(
  userId: string,
  type: RoundSessionType,
  now = new Date(),
) {
  const sessions = await loadScheduledPlanSessions(userId, now);
  for (const session of sessions) {
    if (!session.dayId || !session.day) continue;
    const exercises = session.day.exercises as RoundExercise[];
    const target = roundTargetFromExercises(exercises, type);
    if (!target) continue;
    const daySetCount = exercises.reduce(
      (sum, exercise) => sum + Math.max(0, Math.round(exercise.sets ?? 0)),
      0,
    );
    return { programDayId: session.dayId, daySetCount, ...target };
  }
  return null;
}

/** Prescribed length of the ride, including easy spins between efforts. */
export function bikeTimerSessionSeconds(choice: BikeChoice, roundsCompleted = bikeTimerRoundCount(choice)) {
  const fullRounds = bikeTimerRoundCount(choice);
  const done = Math.min(fullRounds, Math.max(0, Math.round(roundsCompleted)));
  const full = bikeSetDurationSeconds(choice.spec);
  if (done <= 0) return 0;
  if (done >= fullRounds) return full;
  return Math.max(1, Math.round((full * done) / fullRounds));
}

/** Sets a real bike save writes. Only rounds that already finished are included. */
export function bikeTimerLogSets(
  choice: BikeChoice,
  unit: LoadUnit,
  roundsCompleted = bikeTimerRoundCount(choice),
  existing: Iterable<{ exerciseName?: string | null; setNumber?: number | null }> = [],
): BikeTimerSet[] {
  const count = Math.min(bikeTimerRoundCount(choice), Math.max(0, Math.round(roundsCompleted)));
  if (count < 1) return [];
  const key = attachBikeChoice("timer", choiceToken(choice));
  const duration = Math.max(1, Math.round(choice.spec.workSeconds));
  const start = highestSetNumber(existing, BIKE_TIMER_EXERCISE);
  return Array.from({ length: count }, (_, index) => ({
    exerciseName: BIKE_TIMER_EXERCISE,
    setNumber: start + index + 1,
    reps: null,
    loadValue: null,
    loadUnit: unit,
    logMode: "timed_round",
    durationSeconds: duration,
    completed: true,
    prescriptionKey: key,
  }));
}
