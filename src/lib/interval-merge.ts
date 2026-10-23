import { bikeChoiceFromKey } from "@/lib/bike-chooser";
import { isShadowName } from "@/lib/exercise-log-mode";
import { setHasLoggedWork } from "@/lib/logged-work";
import {
  roundStructureFromKey,
  setBelongsToRoundType,
  type RoundSessionType,
} from "@/lib/round-session";

/**
 * Shared merge rule for a logged interval and a later save of the same day.
 * Live bag saves (PR #154 `reuseRoundSessionId`) and past/today backfill both
 * call this. A false result means create a separate session.
 *
 * Merge only when the existing log is the same plan and type, the work, rest,
 * sets, and set-rest match, the new count is at least the stored count, and
 * the log is not a running draft or a mixed/lift draft. Callers must not
 * delete or replace the rounds already stored.
 */

export type IntervalMergeType = RoundSessionType | "shadow";

export type IntervalMergeClock = {
  workSeconds: number;
  restSeconds: number;
  /** Groups. One when the workout is a single series of rounds. */
  sets: number;
  setRestSeconds: number;
  roundsCompleted: number;
  /** Shadow rounds can differ. When set, the stored prefix must match in order. */
  roundWorkSeconds?: number[];
};

export type IntervalMergeSet = {
  exerciseName?: string | null;
  logMode?: string | null;
  prescriptionKey?: string | null;
  durationSeconds?: number | null;
  reps?: number | null;
  loadValue?: number | null;
  completed?: boolean | null;
};

export type IntervalMergeSession = {
  status: string;
  programDayId?: string | null;
  /** Set while the live timer is running. */
  timerStartedAt?: Date | null;
  sets: IntervalMergeSet[];
};

function samePlan(existing: string | null | undefined, incoming: string | null | undefined) {
  return (existing ?? null) === (incoming ?? null);
}

function belongs(set: IntervalMergeSet, type: IntervalMergeType) {
  if (type === "shadow") return isShadowName(set.exerciseName ?? "");
  return setBelongsToRoundType(set, type);
}

function logged(sets: IntervalMergeSet[], type: IntervalMergeType) {
  return sets.filter((set) => set.completed !== false && belongs(set, type) && setHasLoggedWork(set));
}

function storedRest(set: IntervalMergeSet, type: IntervalMergeType) {
  if (type === "shadow") return 0;
  const choice = bikeChoiceFromKey(set.prescriptionKey);
  if (choice) return choice.spec.restSeconds;
  return roundStructureFromKey(set.prescriptionKey)?.restSeconds ?? null;
}

function storedGroups(set: IntervalMergeSet, type: IntervalMergeType) {
  if (type === "shadow") return { sets: 1, setRestSeconds: 0 };
  const choice = bikeChoiceFromKey(set.prescriptionKey);
  if (choice) {
    return {
      sets: Math.max(1, choice.spec.repeatRounds ?? 1),
      setRestSeconds: Math.max(0, choice.spec.restBetweenRoundsSeconds ?? 0),
    };
  }
  const structure = roundStructureFromKey(set.prescriptionKey);
  return {
    sets: Math.max(1, structure?.sets ?? 1),
    setRestSeconds: Math.max(0, structure?.setRestSeconds ?? 0),
  };
}

/**
 * True when this save can extend the existing log. False means a new session.
 * `timerKnown` is false when the running-clock columns could not be read;
 * a draft is then left alone.
 */
export function canMergeIntervalLog(
  existing: IntervalMergeSession,
  incoming: {
    type: IntervalMergeType;
    programDayId: string | null;
    clock: IntervalMergeClock;
  },
  timerKnown = true,
) {
  if (!samePlan(existing.programDayId, incoming.programDayId)) return false;
  if (existing.sets.some((set) => !belongs(set, incoming.type))) return false;
  if (existing.status === "draft" && (!timerKnown || existing.timerStartedAt)) return false;

  const stored = logged(existing.sets, incoming.type);
  if (stored.length === 0) return false;
  if (stored.length > incoming.clock.roundsCompleted) return false;

  const work = Math.max(0, Math.round(incoming.clock.workSeconds));
  const rest = Math.max(0, Math.round(incoming.clock.restSeconds));
  const groups = storedGroups(stored[0]!, incoming.type);
  const incomingSets = Math.max(1, Math.round(incoming.clock.sets));
  const incomingSetRest = Math.max(0, Math.round(incoming.clock.setRestSeconds));
  if (groups.sets !== incomingSets) return false;
  if (incomingSets > 1 && groups.setRestSeconds !== incomingSetRest) return false;

  const roundWork = incoming.clock.roundWorkSeconds;
  return stored.every((set, index) => {
    const duration = Math.round(set.durationSeconds ?? 0);
    const expected = roundWork ? Math.round(roundWork[index] ?? -1) : work;
    if (duration !== expected) return false;
    const setRest = storedRest(set, incoming.type);
    return setRest === rest;
  });
}
