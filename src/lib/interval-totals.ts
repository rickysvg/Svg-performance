import { bikeTimerRoundCount, customBikeChoice } from "@/lib/bike-chooser";
import { bikeEffortSeconds } from "@/lib/bike-interval-timer";
import { bikeTimerSessionSeconds, loggerChoiceFromSession } from "@/lib/bike-timer-log";
import { roundBlockDuration, type RoundSessionType } from "@/lib/round-session";

export type IntervalTotalType = RoundSessionType | "shadow";

export type IntervalTotalSpec = {
  sets: number;
  /** Rounds inside one set. */
  rounds: number;
  workSeconds: number;
  restSeconds: number;
  setRestSeconds: number;
  /** Unequal shadow rounds. When set, they replace the flat sets × rounds clock. */
  shadowRounds?: { workSeconds: number; restSeconds: number }[];
};

/**
 * The number the save will store.
 * Bike keeps the live timer, including the rest after the last sprint.
 * Bag, pads, sparring, grappling, and shadow stop on the last work interval.
 * Between sets, that trailing rest is the set rest.
 */
export function intervalTotals(type: IntervalTotalType, spec: IntervalTotalSpec, doneRounds: number) {
  if (type === "shadow" && spec.shadowRounds && spec.shadowRounds.length > 0) {
    return shadowTotals(spec.shadowRounds, doneRounds);
  }
  if (type === "bike") {
    const choice =
      customBikeChoice({
        workSeconds: spec.workSeconds,
        restSeconds: spec.restSeconds,
        rounds: spec.rounds,
        repeatRounds: spec.sets,
        restBetweenRoundsSeconds: spec.sets > 1 ? spec.setRestSeconds : 0,
      }) ??
      loggerChoiceFromSession({
        workSeconds: spec.workSeconds,
        restSeconds: spec.restSeconds,
        roundsPerSet: spec.rounds,
        repeatRounds: spec.sets,
        restBetweenRoundsSeconds: spec.sets > 1 ? spec.setRestSeconds : 0,
      });
    const totalRounds = bikeTimerRoundCount(choice);
    const done = clamp(doneRounds, 0, totalRounds);
    const effort = bikeEffortSeconds(choice.spec);
    const workSeconds =
      done >= totalRounds ? effort.workSeconds : done * Math.max(0, Math.round(choice.spec.workSeconds));
    return {
      totalRounds,
      workSeconds,
      totalSeconds: bikeTimerSessionSeconds(choice, done),
    };
  }
  const sets = clamp(spec.sets, 1, 10);
  const perSet = clamp(spec.rounds, 1, 50);
  const totalRounds = sets * perSet;
  const done = clamp(doneRounds, 0, totalRounds);
  const work = Math.max(0, Math.round(spec.workSeconds));
  const rest = Math.max(0, Math.round(spec.restSeconds));
  const setRest = Math.max(0, Math.round(spec.setRestSeconds));
  return {
    totalRounds,
    workSeconds: done * work,
    totalSeconds: roundBlockDuration({
      sets,
      rounds: perSet,
      workSeconds: work,
      restSeconds: rest,
      setRestSeconds: setRest,
      done,
    }),
  };
}

function shadowTotals(rounds: { workSeconds: number; restSeconds: number }[], doneRounds: number) {
  const totalRounds = rounds.length;
  const done = clamp(doneRounds, 0, totalRounds);
  let workSeconds = 0;
  let totalSeconds = 0;
  for (let index = 0; index < done; index += 1) {
    const round = rounds[index]!;
    const work = Math.max(0, Math.round(round.workSeconds));
    workSeconds += work;
    totalSeconds += work;
    if (index < done - 1) totalSeconds += Math.max(0, Math.round(round.restSeconds));
  }
  return { totalRounds, workSeconds, totalSeconds };
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
