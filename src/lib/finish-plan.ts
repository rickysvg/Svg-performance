import { omitRemovedSlots, type RemovalRecord } from "@/lib/exercise-removal";
import { applySwapsToExercises, type SwapRecord } from "@/lib/exercise-swap";
import { prescribedSetTotal } from "@/lib/logged-work";

type NamedSets = { name: string; sets: number };

/**
 * Exercises the finish screen should count.
 * A swap replaces the programmed name. A removal of that swapped card drops
 * the original slot, so the set total matches the logger.
 */
export function visibleFinishDose(input: {
  exercises: NamedSets[];
  swaps: SwapRecord[];
  removals: RemovalRecord[];
  sessionId: string;
  blockKey: string;
  catalogDose?: number;
}): { dose: number; names: string[]; exercises: NamedSets[] } {
  const programmed = input.exercises
    .map((exercise) => ({
      name: exercise.name.trim(),
      sets: Math.max(0, Math.round(exercise.sets ?? 0)),
      reps: "",
      restSeconds: 0,
    }))
    .filter((exercise) => exercise.name.length > 0);
  const swapped = applySwapsToExercises(programmed, input.swaps, {
    sessionId: input.sessionId,
    blockKey: input.blockKey,
    includePending: false,
  });
  const shown = omitRemovedSlots(programmed, swapped, input.removals, {
    sessionId: input.sessionId,
    includePending: false,
  }).shown;
  const exercises = shown.map((exercise) => ({
    name: exercise.name,
    sets: Math.max(0, Math.round(exercise.sets ?? 0)),
  }));
  const summed = prescribedSetTotal(exercises);
  const catalog =
    typeof input.catalogDose === "number" && input.catalogDose > 0
      ? Math.round(input.catalogDose)
      : 0;
  return {
    dose: summed > 0 ? summed : catalog,
    names: exercises.map((exercise) => exercise.name),
    exercises,
  };
}
