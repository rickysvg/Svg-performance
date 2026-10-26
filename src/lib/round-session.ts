import { BAGWORK_PRESCRIPTION } from "@/lib/bagwork";
import { isBikeIntervalName, memberWeekIndex, parseBikeIntervalReps } from "@/lib/bike-sessions";
import { parseDurationSeconds } from "@/lib/exercise-log-mode";
import { getActiveCampSnapshot } from "@/lib/fight-camp";
import { getProgramDayById } from "@/lib/programs";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import {
  exerciseSetProgress,
  setHasLoggedWork,
  setIsTicked,
  sessionProgressLabel,
  type ExerciseSetProgress,
} from "@/lib/logged-work";
import { bikeChoiceFromKey, bikeTimerRoundCount } from "@/lib/bike-chooser";
import { formatIntervalClock } from "@/lib/interval-shorthand";
import { bikeSetDurationSeconds } from "@/lib/bike-interval-timer";
import { bikeCardioDurationSeconds } from "@/lib/workout-complete";
import { completedWorkRounds, type TimerPhase } from "@/lib/round-timer";
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

/** Rest, groups, set rest, and rounds per set. Old `round:bag:60` keys still parse. */
export function roundStructureKey(
  type: RoundSessionType,
  restSeconds: number,
  structure: { sets: number; setRestSeconds: number; roundsPerSet: number },
) {
  const rest = Math.max(0, Math.round(restSeconds));
  const sets = Math.max(1, Math.round(structure.sets));
  const setRest = sets > 1 ? Math.max(0, Math.round(structure.setRestSeconds)) : 0;
  const rounds = Math.max(1, Math.round(structure.roundsPerSet));
  return `round:${type}:${rest}:${sets}:${setRest}:${rounds}`;
}

export function roundStructureFromKey(key: string | null | undefined) {
  if (!key?.startsWith("round:")) return null;
  const parts = key.split(":");
  const type = parts[1] ?? "";
  const rest = Number(parts[2]);
  if (!type || !Number.isFinite(rest)) return null;
  const sets = parts[3] != null && parts[3] !== "" ? Number(parts[3]) : 1;
  const setRest = parts[4] != null && parts[4] !== "" ? Number(parts[4]) : 0;
  const rounds = parts[5] != null && parts[5] !== "" ? Number(parts[5]) : null;
  return {
    type,
    restSeconds: rest,
    sets: Number.isFinite(sets) && sets > 0 ? Math.round(sets) : 1,
    setRestSeconds: Number.isFinite(setRest) && setRest >= 0 ? Math.round(setRest) : 0,
    roundsPerSet: rounds != null && Number.isFinite(rounds) && rounds > 0 ? Math.round(rounds) : null,
  };
}

export function restSecondsFromRoundKey(key: string | null | undefined) {
  return roundStructureFromKey(key)?.restSeconds ?? null;
}

/** Full interval count from a bike token or a round structure key. 0 when the key does not say. */
export function configuredRoundTotal(
  sets: { prescriptionKey?: string | null }[],
) {
  const bike = sets.map((set) => bikeChoiceFromKey(set.prescriptionKey)).find((choice) => choice != null);
  if (bike) return bikeTimerRoundCount(bike);
  const structure = sets
    .map((set) => roundStructureFromKey(set.prescriptionKey))
    .find((row) => row?.roundsPerSet);
  if (!structure?.roundsPerSet) return 0;
  return structure.sets * structure.roundsPerSet;
}

/**
 * Bag, pads, sparring, and grappling stop on the last work interval.
 * The rest after the last round of a set is the set rest when another set follows.
 */
export function roundBlockDuration(input: {
  sets: number;
  rounds: number;
  workSeconds: number;
  restSeconds: number;
  setRestSeconds: number;
  done: number;
}) {
  const sets = Math.max(1, Math.round(input.sets));
  const perSet = Math.max(1, Math.round(input.rounds));
  const done = Math.min(sets * perSet, Math.max(0, Math.round(input.done)));
  const work = Math.max(0, Math.round(input.workSeconds));
  const rest = Math.max(0, Math.round(input.restSeconds));
  const setRest = Math.max(0, Math.round(input.setRestSeconds));
  let remaining = done;
  let totalSeconds = 0;
  for (let set = 0; set < sets && remaining > 0; set += 1) {
    const inSet = Math.min(perSet, remaining);
    totalSeconds += roundSessionDuration(inSet, work, rest);
    remaining -= inSet;
    if (remaining > 0) totalSeconds += setRest;
  }
  return totalSeconds;
}

export function roundSessionDuration(rounds: number, workSeconds: number, restSeconds: number) {
  const done = Math.max(0, Math.round(rounds));
  if (done < 1) return 0;
  const work = Math.max(0, Math.round(workSeconds));
  const rest = Math.max(0, Math.round(restSeconds));
  return done * work + Math.max(0, done - 1) * rest;
}

export type RoundClockLog = {
  roundsCompleted: number;
  /** Configured rest gap. Mid-rest does not shrink this to the seconds already counted. */
  restSeconds: number;
  elapsedSeconds: number;
};

type RoundClockInput = {
  phase: TimerPhase | string;
  round: number;
  totalRounds: number;
  workSeconds: number;
  restSeconds: number;
  phaseElapsedSeconds: number;
};

function clockPhase(value: string): TimerPhase {
  if (value === "work" || value === "rest" || value === "done" || value === "idle") return value;
  return "idle";
}

function clockParts(input: RoundClockInput) {
  const phase = clockPhase(input.phase);
  const work = Math.max(0, Math.round(input.workSeconds));
  const configuredRest = Math.max(0, Math.round(input.restSeconds));
  const phaseElapsed = Math.max(0, Math.round(input.phaseElapsedSeconds));
  const round = Math.round(input.round);
  const totalRounds = Math.round(input.totalRounds);
  return { phase, work, configuredRest, phaseElapsed, round, totalRounds };
}

/**
 * Running total while the clock is moving. Rest counts as it elapses, so a
 * 15/15 session is monotonic: round 1 is 0→15, rest 1 is 15→30, round 2 is
 * 30→45, rest 2 is 45→60. This is the number on the timer, not the saved log.
 */
export function roundLiveElapsed(input: RoundClockInput) {
  const { phase, work, configuredRest, phaseElapsed, round, totalRounds } = clockParts(input);
  if (phase === "done") return roundSessionDuration(totalRounds, work, configuredRest);
  if (phase === "rest") {
    const intoRest = configuredRest > 0 ? Math.min(configuredRest, phaseElapsed) : phaseElapsed;
    const finished = completedWorkRounds("rest", round, totalRounds);
    return roundSessionDuration(finished, work, configuredRest) + intoRest;
  }
  if (phase === "work") {
    const intoWork = work > 0 ? Math.min(work, phaseElapsed) : phaseElapsed;
    const finished = Math.max(0, round - 1);
    return finished * work + finished * configuredRest + intoWork;
  }
  return 0;
}

/**
 * A mid-timer save counts work rounds that already finished.
 * Stored rest stays the configured gap. The saved total is completed work
 * plus the configured rests that sit between those rounds. A rest still in
 * progress does not add to the save. The next work block does count the rest
 * that just finished, plus any partial work already done in that block.
 */
export function roundLogFromClock(input: RoundClockInput): RoundClockLog {
  const { phase, work, configuredRest, phaseElapsed, round, totalRounds } = clockParts(input);
  const roundsCompleted = completedWorkRounds(phase, round, totalRounds);
  if (phase === "work") {
    const intoWork = work > 0 ? Math.min(work, phaseElapsed) : phaseElapsed;
    const finished = Math.max(0, roundsCompleted);
    return {
      roundsCompleted,
      restSeconds: configuredRest,
      elapsedSeconds: finished * work + finished * configuredRest + intoWork,
    };
  }
  return {
    roundsCompleted,
    restSeconds: configuredRest,
    elapsedSeconds: roundSessionDuration(roundsCompleted, work, configuredRest),
  };
}

/**
 * Clock fields win over a stale rounds/rest pair once the timer has left idle.
 * A running timer that drops the phase stamp can still post the configured
 * round count, rest 0, and a full-session total (prod "2 rounds / 0:00 rest").
 * That shape is the clock position with the rest field zeroed, not a finished log.
 */
export function resolveSubmittedRoundLog(input: {
  rounds: number;
  workSeconds: number;
  restSeconds: number;
  configuredRounds?: number | null;
  configuredRestSeconds?: number | null;
  phase?: string | null;
  timerRound?: number | null;
  phaseElapsedSeconds?: number | null;
  elapsedSeconds?: number | null;
}): RoundClockLog {
  const phase = (input.phase ?? "").trim();
  const postedRest = Math.max(0, Math.round(input.restSeconds));
  const configuredRest =
    input.configuredRestSeconds == null || !Number.isFinite(input.configuredRestSeconds)
      ? postedRest
      : Math.max(0, Math.round(input.configuredRestSeconds));
  const restForClock = postedRest > 0 ? postedRest : configuredRest;
  if (phase === "work" || phase === "rest" || phase === "done") {
    const clock = roundLogFromClock({
      phase,
      round: Number(input.timerRound ?? 0),
      totalRounds: Number(input.configuredRounds ?? input.rounds),
      workSeconds: input.workSeconds,
      restSeconds: restForClock,
      phaseElapsedSeconds: Number(input.phaseElapsedSeconds ?? 0),
    });
    if (clock.roundsCompleted >= 1) return clock;
  }
  const droppedPhase = runningTimerDroppedPhase(input);
  if (droppedPhase) {
    const clock = roundLogFromClock({
      phase: "rest",
      round: droppedPhase.timerRound,
      totalRounds: droppedPhase.configured,
      workSeconds: input.workSeconds,
      restSeconds: restForClock,
      phaseElapsedSeconds: droppedPhase.phaseElapsed,
    });
    if (clock.roundsCompleted >= 1) return clock;
  }
  const roundsCompleted = Math.max(0, Math.round(input.rounds));
  const elapsed =
    input.elapsedSeconds == null || !Number.isFinite(input.elapsedSeconds)
      ? roundSessionDuration(roundsCompleted, input.workSeconds, postedRest)
      : Math.max(0, Math.round(input.elapsedSeconds));
  return { roundsCompleted, restSeconds: postedRest, elapsedSeconds: elapsed };
}

/**
 * Prod saved 2 rounds and 0:00 rest while the first rest was still running.
 * The form kept the setup round count, wrote the elapsed rest (0) into rest,
 * and never stamped phase. timerRound still said which round the clock was on.
 * An idle "log the whole setup" submit has phaseElapsed 0, so it does not match.
 */
function runningTimerDroppedPhase(input: {
  rounds: number;
  restSeconds: number;
  configuredRounds?: number | null;
  phase?: string | null;
  timerRound?: number | null;
  phaseElapsedSeconds?: number | null;
}) {
  const phase = (input.phase ?? "").trim();
  if (phase === "work" || phase === "rest" || phase === "done") return null;
  const configured =
    input.configuredRounds == null ? null : Math.max(1, Math.round(input.configuredRounds));
  const timerRound = Math.round(Number(input.timerRound ?? 0));
  const phaseElapsed = Math.round(Number(input.phaseElapsedSeconds ?? 0));
  if (configured == null || configured < 2) return null;
  if (Math.round(input.rounds) < configured) return null;
  if (Math.round(input.restSeconds) !== 0) return null;
  if (timerRound < 1 || timerRound >= configured) return null;
  if (phaseElapsed <= 0) return null;
  return { configured, timerRound, phaseElapsed };
}

/**
 * Launch "End" and the auto-done log. Never substitute the configured round
 * count when the clock has not finished a round, and never store elapsed rest
 * in place of the configured gap.
 */
export function launchRoundLogFromClock(input: {
  phase: TimerPhase | string;
  round: number;
  totalRounds: number;
  workSeconds: number;
  restSeconds: number;
  phaseElapsedSeconds: number;
}) {
  const clock = roundLogFromClock(input);
  const rounds =
    input.phase === "done" ? Math.max(0, Math.round(input.totalRounds)) : clock.roundsCompleted;
  const elapsedSeconds =
    input.phase === "done"
      ? roundSessionDuration(rounds, input.workSeconds, input.restSeconds)
      : clock.elapsedSeconds;
  return {
    rounds,
    restSeconds: Math.max(0, Math.round(input.restSeconds)),
    elapsedSeconds,
  };
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

/**
 * True when this save uses the same work and rest as the rounds already stored.
 * A different clock must not replace those sets.
 */
export function sameRoundClock(
  sets: {
    exerciseName?: string | null;
    logMode?: string | null;
    prescriptionKey?: string | null;
    reps?: number | null;
    loadValue?: number | null;
    durationSeconds?: number | null;
  }[],
  type: RoundSessionType,
  workSeconds: number,
  restSeconds: number,
) {
  const logged = sets.filter((set) => setBelongsToRoundType(set, type) && setHasLoggedWork(set));
  if (logged.length === 0) return true;
  const work = Math.max(1, Math.round(workSeconds));
  const rest = Math.max(0, Math.round(restSeconds));
  return logged.every((set) => {
    if ((set.durationSeconds ?? 0) !== work) return false;
    const storedRest =
      restSecondsFromRoundKey(set.prescriptionKey) ??
      bikeChoiceFromKey(set.prescriptionKey)?.spec.restSeconds;
    return storedRest === rest;
  });
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

/** Same clock as the live bike save, including the rest after the last sprint. */
function bikeClockSeconds(
  choice: NonNullable<ReturnType<typeof bikeChoiceFromKey>>,
  roundsCompleted: number,
) {
  const fullRounds = bikeTimerRoundCount(choice);
  const done = Math.min(fullRounds, Math.max(0, Math.round(roundsCompleted)));
  const full = bikeSetDurationSeconds(choice.spec);
  if (done <= 0) return 0;
  if (done >= fullRounds) return full;
  return Math.max(1, Math.round((full * done) / fullRounds));
}

export function roundHistoryLine(session: {
  sessionRpe?: number | null;
  elapsedSeconds?: number | null;
  sets: {
    exerciseName?: string | null;
    prescriptionKey?: string | null;
    logMode?: string | null;
    durationSeconds?: number | null;
    reps?: number | null;
    loadValue?: number | null;
    completed?: boolean | null;
  }[];
}) {
  const logged = session.sets.filter(
    (set) => set.completed !== false && setHasLoggedWork(set),
  );
  const sets = logged.filter((set) => {
    if ((set.durationSeconds ?? 0) <= 0) return false;
    const key = set.prescriptionKey ?? "";
    if (key.startsWith("round:")) return true;
    return isBikeIntervalName(set.exerciseName ?? "");
  });
  if (sets.length === 0 || sets.length !== logged.length) return null;
  const work = sets[0]?.durationSeconds ?? 0;
  const rest =
    restSecondsFromRoundKey(sets[0]?.prescriptionKey) ??
    bikeChoiceFromKey(sets[0]?.prescriptionKey)?.spec.restSeconds ??
    0;
  const bike = bikeChoiceFromKey(sets[0]?.prescriptionKey);
  const structure = roundStructureFromKey(sets[0]?.prescriptionKey);
  const block =
    !bike && structure?.roundsPerSet
      ? roundBlockDuration({
          sets: structure.sets,
          rounds: structure.roundsPerSet,
          workSeconds: work,
          restSeconds: structure.restSeconds,
          setRestSeconds: structure.setRestSeconds,
          done: sets.length,
        })
      : null;
  const bikeOnly = sets.every((set) => isBikeIntervalName(set.exerciseName ?? ""));
  const rideSeconds = bike
    ? bikeClockSeconds(bike, sets.length)
    : sets.reduce(
        (sum, set) => sum + (set.durationSeconds != null && set.durationSeconds > 0 ? set.durationSeconds : 0),
        0,
      );
  const wallSeconds =
    typeof session.elapsedSeconds === "number" && session.elapsedSeconds > 0
      ? Math.round(session.elapsedSeconds)
      : 0;
  const structureSeconds = bikeOnly
    ? bikeCardioDurationSeconds({
        title: sets[0]?.exerciseName ?? "Bike",
        performedAt: new Date(0),
        status: "complete",
        elapsedSeconds: session.elapsedSeconds,
        sets: sets.map((set) => ({
          exerciseName: set.exerciseName ?? "",
          reps: set.reps ?? null,
          loadValue: set.loadValue ?? null,
          loadUnit: "lb",
          logMode: set.logMode,
          durationSeconds: set.durationSeconds,
          completed: set.completed !== false,
          prescriptionKey: set.prescriptionKey,
        })),
      })
    : wallSeconds > 0
      ? wallSeconds
      : bike
        ? bikeClockSeconds(bike, sets.length)
        : (block ?? roundSessionDuration(sets.length, work, rest));
  // A session clock one second past the set's ride (1:12 vs 1:11) is the same ride.
  // A clock that ran meaningfully longer still wins.
  const total =
    bikeOnly && rideSeconds > 0 && wallSeconds > 0 && Math.abs(wallSeconds - rideSeconds) <= 1
      ? rideSeconds
      : structureSeconds;
  const parts = [
    `${sets.length} round${sets.length === 1 ? "" : "s"}`,
    `${formatIntervalClock(work)} round`,
    `${formatIntervalClock(rest)} rest`,
    `${formatIntervalClock(total)} total`,
  ];
  if (session.sessionRpe != null) parts.push(`RPE ${session.sessionRpe}`);
  return parts.join(" · ");
}

/** Progress already names the rounds. History keeps the clock, not a second count. */
export function historyDetailBesideCount(line: string | null) {
  if (!line) return null;
  const clock = line.replace(/^\d+ rounds?(?: · )?/, "");
  return clock.length > 0 ? clock : null;
}

type FinishSet = {
  exerciseName?: string | null;
  completed?: boolean | null;
  reps?: number | null;
  loadValue?: number | null;
  durationSeconds?: number | null;
  prescriptionKey?: string | null;
  logMode?: string | null;
};

/**
 * Finish and Today rows for a round-only log use the stored plan.
 * One logged round of a 2-round or 8-round timer stays partial, not 1/1 complete.
 * A mixed skill day still uses the program rows, so a short bag save is not 7/7.
 */
export function roundFinishProgress(input: {
  plannedExercises: { name?: string | null; sets?: number | null }[];
  sets: FinishSet[];
  plannedSetCount?: number | null;
  status?: string | null;
}): ExerciseSetProgress[] {
  const base = exerciseSetProgress(input.plannedExercises, input.sets);
  const roundOnly = input.sets.length > 0 && input.sets.every((set) => setIsSavedRoundWork(set));
  if (!roundOnly) return base;
  const ticked = input.sets.filter((set) => setIsTicked(set)).length;
  const stored = Math.max(0, Math.round(input.plannedSetCount ?? 0));
  const collapsed = base.reduce((sum, row) => sum + row.planned, 0);
  const planned = stored > 0 ? stored : Math.max(collapsed, ticked);
  const partial = input.status === "partial" || (planned > 0 && ticked < planned);
  const name = base.find((row) => row.ticked > 0)?.name || base[0]?.name || "Rounds";
  return [
    {
      name,
      ticked,
      planned: planned > 0 ? planned : ticked,
      state: ticked <= 0 ? "open" : partial ? "partial" : "complete",
    },
  ];
}

export function roundProgressLabel(input: {
  plannedExercises: { name?: string | null; sets?: number | null }[];
  sets: FinishSet[];
  plannedSetCount?: number | null;
  status?: string | null;
}) {
  return sessionProgressLabel(roundFinishProgress(input), {
    forcePartial: input.status === "partial",
  });
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
