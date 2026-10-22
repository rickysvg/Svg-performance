import { BAGWORK_PRESCRIPTION } from "@/lib/bagwork";
import { isBikeIntervalName, memberWeekIndex, parseBikeIntervalReps } from "@/lib/bike-sessions";
import { parseDurationSeconds } from "@/lib/exercise-log-mode";
import { getActiveCampSnapshot } from "@/lib/fight-camp";
import { getProgramDayById } from "@/lib/programs";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { formatTimerClock } from "@/lib/round-timer";
import { SESSION_DURATION_CAP_SECONDS } from "@/lib/share-card";
import { scaleBandFromPrefs, scaleProgramDay } from "@/lib/training-scale";
import type { LoadUnit } from "@/lib/units";

/** One round or bike effort. Longer values are trimmed, not rejected. */
export const ROUND_SET_CAP_SECONDS = 60 * 60;

export { SESSION_DURATION_CAP_SECONDS };

export const ROUND_SESSION_TYPES = ["bag", "pads", "sparring", "grappling", "bike"] as const;
export type RoundSessionType = (typeof ROUND_SESSION_TYPES)[number];

export const ROUND_SESSION_TITLES: Record<RoundSessionType, string> = {
  bag: "Heavy bag rounds",
  pads: "Pad rounds",
  sparring: "Sparring rounds",
  grappling: "Grappling rounds",
  bike: "Assault bike intervals",
};

export type RoundExercise = {
  name?: string | null;
  sets?: number | null;
  reps?: string | null;
  restSeconds?: number | null;
  logMode?: string | null;
};

export type RoundPlanTarget = {
  exerciseName: string;
  plannedRounds: number;
  workSeconds: number;
  restSeconds: number;
};

export function isRoundSessionType(value: string | null | undefined): value is RoundSessionType {
  return typeof value === "string" && ROUND_SESSION_TYPES.includes(value as RoundSessionType);
}

export function exerciseMatchesRoundType(
  name: string,
  _logMode: string | null | undefined,
  type: RoundSessionType,
) {
  if (type === "bike") return isBikeIntervalName(name);
  if (type === "bag") return /\bbag rounds?\b/i.test(name);
  if (type === "pads") return /\bpads?\b|\bmitts?\b/i.test(name);
  if (type === "sparring") return /\bspar/i.test(name);
  if (type === "grappling") return /\bgrappl/i.test(name);
  return false;
}

/** Planned rounds are the program's set rows for that round exercise, not a second dose rule. */
export function roundTargetFromExercises(
  exercises: readonly RoundExercise[],
  type: RoundSessionType,
): RoundPlanTarget | null {
  const matches = exercises.filter((exercise) =>
    exerciseMatchesRoundType(exercise.name ?? "", exercise.logMode, type),
  );
  if (matches.length === 0) return null;
  const plannedRounds = matches.reduce(
    (sum, exercise) => sum + Math.max(0, Math.round(exercise.sets ?? 0)),
    0,
  );
  if (plannedRounds < 1) return null;
  const primary = matches.reduce((best, exercise) =>
    Math.round(exercise.sets ?? 0) > Math.round(best.sets ?? 0) ? exercise : best,
  );
  const reps = primary.reps ?? "";
  const parsedBike = type === "bike" ? parseBikeIntervalReps(reps) : null;
  const workSeconds = parsedBike?.workSeconds ?? parseDurationSeconds(reps) ?? 180;
  const restSeconds =
    parsedBike?.restSeconds ?? Math.max(0, Math.round(primary.restSeconds ?? 0));
  const exerciseName = (primary.name ?? "").trim() || ROUND_SESSION_TITLES[type];
  return { exerciseName, plannedRounds, workSeconds, restSeconds };
}

export function roundPrescriptionKey(type: RoundSessionType, restSeconds: number) {
  return `round:${type}:${Math.max(0, Math.round(restSeconds))}`;
}

export function restSecondsFromRoundKey(key: string | null | undefined) {
  if (!key?.startsWith("round:")) return null;
  const rest = Number(key.split(":")[2]);
  return Number.isFinite(rest) ? rest : null;
}

export function roundSessionDuration(rounds: number, workSeconds: number, restSeconds: number) {
  const done = Math.max(0, Math.round(rounds));
  if (done < 1) return 0;
  const work = Math.max(0, Math.round(workSeconds));
  const rest = Math.max(0, Math.round(restSeconds));
  return done * work + Math.max(0, done - 1) * rest;
}

/**
 * A save is complete only when the timer's rounds and the planned day's rounds
 * are both covered. Anything shorter is Partial.
 */
export function roundSaveStatus(input: {
  roundsCompleted: number;
  plannedRounds: number;
  configuredRounds?: number | null;
}) {
  const done = Math.round(input.roundsCompleted);
  const planned = Math.max(1, Math.round(input.plannedRounds));
  const configured =
    input.configuredRounds == null ? planned : Math.max(1, Math.round(input.configuredRounds));
  if (done >= planned && done >= configured) return "complete" as const;
  return "partial" as const;
}

export function trimRoundSetSeconds(seconds: number) {
  const rounded = Math.round(seconds);
  if (!Number.isFinite(rounded)) return 1;
  return Math.min(ROUND_SET_CAP_SECONDS, Math.max(1, rounded));
}

/** Session clock for a round or bike save. Matches the 4 hour training cap. */
export function trimRoundSessionSeconds(seconds: number) {
  const rounded = Math.round(seconds);
  if (!Number.isFinite(rounded) || rounded < 1) return 0;
  return Math.min(SESSION_DURATION_CAP_SECONDS, rounded);
}

export function roundLogSets(input: {
  type: RoundSessionType;
  exerciseName: string;
  rounds: number;
  workSeconds: number;
  restSeconds: number;
  unit: LoadUnit;
}) {
  const rounds = Math.max(0, Math.round(input.rounds));
  const workSeconds = Math.max(1, Math.round(input.workSeconds));
  const key = roundPrescriptionKey(input.type, input.restSeconds);
  return Array.from({ length: rounds }, (_, index) => ({
    exerciseName: input.exerciseName,
    setNumber: index + 1,
    reps: null,
    loadValue: null,
    loadUnit: input.unit,
    logMode: "timed_round" as const,
    durationSeconds: workSeconds,
    completed: true,
    prescriptionKey: key,
    notes: `Rest ${Math.max(0, Math.round(input.restSeconds))}s`,
  }));
}

/** A saved round, bagwork, or bike set. Shadowbox and technique rows are not. */
export function setIsSavedRoundWork(set: {
  exerciseName?: string | null;
  logMode?: string | null;
  prescriptionKey?: string | null;
}) {
  const key = set.prescriptionKey ?? "";
  if (key.startsWith("round:") || key === BAGWORK_PRESCRIPTION) return true;
  if (isBikeIntervalName(set.exerciseName ?? "")) return true;
  return ROUND_SESSION_TYPES.some((type) =>
    exerciseMatchesRoundType(set.exerciseName ?? "", set.logMode, type),
  );
}

export function setBelongsToRoundType(
  set: { exerciseName?: string | null; logMode?: string | null; prescriptionKey?: string | null },
  type: RoundSessionType,
) {
  if ((set.prescriptionKey ?? "").startsWith(`round:${type}:`)) return true;
  if (type === "bike") return isBikeIntervalName(set.exerciseName ?? "");
  return exerciseMatchesRoundType(set.exerciseName ?? "", set.logMode, type);
}

export function sessionMatchesRoundType(
  session: {
    title?: string | null;
    sets: { exerciseName?: string | null; logMode?: string | null; prescriptionKey?: string | null }[];
  },
  type: RoundSessionType,
) {
  if (session.sets.length === 0) return false;
  if (session.sets.some((set) => (set.prescriptionKey ?? "").startsWith(`round:${type}:`))) return true;
  if (type === "bike") return session.sets.some((set) => isBikeIntervalName(set.exerciseName ?? ""));
  if ((session.title ?? "") === ROUND_SESSION_TITLES[type]) return true;
  return session.sets.some((set) =>
    exerciseMatchesRoundType(set.exerciseName ?? "", set.logMode, type),
  );
}

export function roundHistoryLine(session: {
  sessionRpe?: number | null;
  elapsedSeconds?: number | null;
  sets: {
    exerciseName?: string | null;
    prescriptionKey?: string | null;
    logMode?: string | null;
    durationSeconds?: number | null;
    completed?: boolean | null;
  }[];
}) {
  const sets = session.sets.filter(
    (set) =>
      set.completed !== false &&
      (set.durationSeconds ?? 0) > 0 &&
      (set.prescriptionKey ?? "").startsWith("round:") &&
      !isBikeIntervalName(set.exerciseName ?? ""),
  );
  if (sets.length === 0) return null;
  const work = sets[0]?.durationSeconds ?? 0;
  const rest = restSecondsFromRoundKey(sets[0]?.prescriptionKey) ?? 0;
  const total =
    session.elapsedSeconds && session.elapsedSeconds > 0
      ? session.elapsedSeconds
      : roundSessionDuration(sets.length, work, rest);
  const parts = [
    `${sets.length} round${sets.length === 1 ? "" : "s"}`,
    `${formatTimerClock(work)} round`,
    `${formatTimerClock(rest)} rest`,
    `${formatTimerClock(total)} total`,
  ];
  if (session.sessionRpe != null) parts.push(`RPE ${session.sessionRpe}`);
  return parts.join(" · ");
}

export async function roundTargetForProgramDay(input: {
  userId: string;
  programDayId: string;
  type: RoundSessionType;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const profile = await getProfileForUser(input.userId);
  const zone = await timeZoneForUser(input.userId, profile?.timeZone ?? null);
  let raw;
  try {
    raw = await getProgramDayById(input.programDayId);
  } catch {
    return null;
  }
  const weekIndex = memberWeekIndex(now, profile?.onboardingCompletedAt ?? now, zone);
  const camp = await getActiveCampSnapshot(input.userId, now, zone);
  const day = scaleProgramDay(raw, {
    band: scaleBandFromPrefs({
      experienceLevel: profile?.experienceLevel,
      competitionStatus: profile?.competitionStatus,
    }),
    programSlug: raw.program.slug,
    weightAccess: profile?.weightAccess,
    weekIndex,
    campPhase: camp?.phase ?? null,
  });
  const target = roundTargetFromExercises(day.exercises, input.type);
  if (!target) return null;
  const daySetCount = day.exercises.reduce(
    (sum, exercise) => sum + Math.max(0, Math.round(exercise.sets ?? 0)),
    0,
  );
  return { programDayId: raw.id, daySetCount, ...target };
}
