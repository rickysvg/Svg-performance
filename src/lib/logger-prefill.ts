import { startRestTimer, type RestTimerState } from "@/lib/rest-timer";
import type { PreviousSetLookup } from "@/lib/workouts";

export type PrefillableSet = {
  exerciseName: string;
  setNumber: number;
  reps: number | null;
  loadValue: number | null;
  durationSeconds: number | null;
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
