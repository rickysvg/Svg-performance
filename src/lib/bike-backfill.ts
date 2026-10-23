import { bikeChoiceMinutes, customBikeChoice, type BikeChoice } from "@/lib/bike-chooser";
import { isBikeIntervalName, parseBikeIntervalReps } from "@/lib/bike-sessions";

/** Fields on the past-workout Assault bike form. Sets are repeats of the round block. */
export type BikeBackfillSpec = {
  workSeconds: number;
  restSeconds: number;
  roundsPerSet: number;
  sets: number;
  restBetweenSetsSeconds: number;
};

export const DEFAULT_BIKE_BACKFILL: BikeBackfillSpec = {
  workSeconds: 15,
  restSeconds: 15,
  roundsPerSet: 8,
  sets: 1,
  restBetweenSetsSeconds: 0,
};

type PrescriptionExercise = {
  name?: string | null;
  sets?: number | null;
  reps?: string | null;
  restSeconds?: number | null;
};

/**
 * The day's bike row, when the plan has one.
 * Reps carry work, rest, and rounds per set. The exercise set count is how many times that block repeats.
 */
export function bikeBackfillSpecFromExercises(exercises: readonly PrescriptionExercise[]): BikeBackfillSpec | null {
  for (const exercise of exercises) {
    const name = (exercise.name ?? "").trim();
    const parsed = parseBikeIntervalReps(exercise.reps ?? "");
    if (!parsed && !isBikeIntervalName(name)) continue;
    if (!parsed) continue;
    const sets = Math.round(exercise.sets ?? 1);
    const between = Math.round(exercise.restSeconds ?? 0);
    return {
      workSeconds: parsed.workSeconds,
      restSeconds: parsed.restSeconds,
      roundsPerSet: parsed.roundsPerSet,
      sets: Number.isFinite(sets) && sets > 0 ? sets : 1,
      restBetweenSetsSeconds: Number.isFinite(between) && between > 0 ? between : 0,
    };
  }
  return null;
}

/** Same choice a custom live bike timer would save for these numbers. */
export function bikeBackfillChoice(spec: BikeBackfillSpec): BikeChoice | null {
  return customBikeChoice({
    workSeconds: spec.workSeconds,
    restSeconds: spec.restSeconds,
    rounds: spec.roundsPerSet,
    repeatRounds: spec.sets,
    restBetweenRoundsSeconds: spec.restBetweenSetsSeconds,
  });
}

export function bikeBackfillTotalRounds(spec: Pick<BikeBackfillSpec, "roundsPerSet" | "sets">) {
  const rounds = Math.max(1, Math.round(spec.roundsPerSet) || 1);
  const sets = Math.max(1, Math.round(spec.sets) || 1);
  return rounds * sets;
}

/** Whole minutes for the form. The save stores the timer's exact seconds unless the member edits this. */
export function bikeBackfillMinutes(spec: BikeBackfillSpec): number | null {
  const choice = bikeBackfillChoice(spec);
  if (!choice) return null;
  return bikeChoiceMinutes(choice);
}

export type BikeBackfillFormState = BikeBackfillSpec & {
  doneRounds: number;
  minutes: number;
  minutesEdited: boolean;
  finishedEdited: boolean;
};

export function bikeBackfillFormFromSpec(spec: BikeBackfillSpec): BikeBackfillFormState {
  const minutes = bikeBackfillMinutes(spec) ?? 1;
  return {
    ...spec,
    doneRounds: bikeBackfillTotalRounds(spec),
    minutes,
    minutesEdited: false,
    finishedEdited: false,
  };
}

/** Interval edits recalculate minutes and total rounds. A typed minute or finished count stays until the interval changes. */
export function syncBikeBackfillForm(
  state: BikeBackfillFormState,
  patch: Partial<BikeBackfillSpec & { doneRounds: number; minutes: number }> & {
    source: "prefill" | "interval" | "minutes" | "finished";
  },
): BikeBackfillFormState {
  if (patch.source === "minutes") {
    const minutes = Number(patch.minutes);
    return {
      ...state,
      minutes: Number.isFinite(minutes) ? minutes : state.minutes,
      minutesEdited: true,
    };
  }
  if (patch.source === "finished") {
    const done = Number(patch.doneRounds);
    const total = bikeBackfillTotalRounds(state);
    const next = Number.isFinite(done) ? Math.round(done) : state.doneRounds;
    return {
      ...state,
      doneRounds: Math.min(Math.max(0, next), total),
      finishedEdited: true,
    };
  }
  const nextSpec: BikeBackfillSpec = {
    workSeconds: numberOr(patch.workSeconds, state.workSeconds),
    restSeconds: numberOr(patch.restSeconds, state.restSeconds),
    roundsPerSet: numberOr(patch.roundsPerSet, state.roundsPerSet),
    sets: numberOr(patch.sets, state.sets),
    restBetweenSetsSeconds: numberOr(patch.restBetweenSetsSeconds, state.restBetweenSetsSeconds),
  };
  const total = bikeBackfillTotalRounds(nextSpec);
  const minutes = bikeBackfillMinutes(nextSpec);
  const finishedEdited = patch.source === "prefill" ? false : state.finishedEdited;
  return {
    ...nextSpec,
    minutes: minutes ?? state.minutes,
    minutesEdited: false,
    finishedEdited,
    doneRounds: finishedEdited ? Math.min(Math.max(0, state.doneRounds), total) : total,
  };
}

function numberOr(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
