import { startRestTimer, type RestTimerState } from "@/lib/rest-timer";
import type { PreviousSetLookup } from "@/lib/workouts";

export type PrefillableSet = {
  id?: string;
  exerciseName: string;
  setNumber: number;
  reps: number | null;
  loadValue: number | null;
  durationSeconds: number | null;
  rir?: string | null;
};

export type PreviousSetValues = {
  reps: number | null;
  loadValue: number | null;
  durationSeconds?: number | null;
  rir?: string | null;
};

export function previousForSet(
  previousLoads: PreviousSetLookup,
  exerciseName: string,
  setNumber: number,
) {
  return previousLoads[exerciseName]?.[setNumber] ?? null;
}

export function copyPreviousOntoExercise<T extends PrefillableSet>(
  sets: T[],
  exerciseName: string,
  previousLoads: PreviousSetLookup,
): T[] {
  return sets.map((set) => {
    if (set.exerciseName !== exerciseName) return set;
    const previous = previousForSet(previousLoads, exerciseName, set.setNumber);
    if (!previous) return set;
    return {
      ...set,
      reps: previous.reps ?? set.reps,
      loadValue: previous.loadValue ?? set.loadValue,
      durationSeconds: previous.durationSeconds ?? set.durationSeconds,
      rir: previous.rir || set.rir,
    };
  });
}

/** One tap copies a single previous set onto the matching row. */
export function applyPreviousToSet<T extends PrefillableSet>(
  sets: T[],
  setId: string,
  previous: PreviousSetValues | null,
): T[] {
  if (!previous) return sets;
  return sets.map((set) => {
    if (set.id !== setId) return set;
    return {
      ...set,
      reps: previous.reps ?? set.reps,
      loadValue: previous.loadValue ?? set.loadValue,
      durationSeconds: previous.durationSeconds ?? set.durationSeconds,
      rir: previous.rir || set.rir,
    };
  });
}

export function restTimerAfterSetDone(input: {
  completed: boolean;
  exerciseName: string;
  restSeconds: number;
  nowMs?: number;
}): RestTimerState | null {
  if (!input.completed || input.restSeconds <= 0) return null;
  return startRestTimer(input.exerciseName, input.restSeconds, input.nowMs);
}
