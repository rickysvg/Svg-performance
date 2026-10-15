/**
 * Drop one exercise from the session the member is looking at.
 * A later session of the same day is unchanged.
 */
import type { WorkoutSetInput } from "@/lib/workouts";

export type RemovalRecord = {
  id?: string;
  originalName: string;
  exerciseName: string;
  workoutSessionId: string;
};

export type RemovalSnapshot = {
  index: number;
  sets: WorkoutSetInput[];
};

export function activeRemovals(
  removals: RemovalRecord[],
  input: { sessionId?: string | null; includePending?: boolean },
) {
  return removals.filter((row) => {
    if (input.sessionId && row.workoutSessionId === input.sessionId) return true;
    if ((input.includePending || !input.sessionId) && row.workoutSessionId === "") return true;
    return false;
  });
}

function slotIsRemoved(sourceName: string, removal: RemovalRecord) {
  return removal.originalName === sourceName;
}

/** Hide programmed slots that were removed. Parallel arrays stay aligned. */
export function omitRemovedSlots<T extends { name: string }>(
  programmed: T[],
  shown: T[],
  removals: RemovalRecord[],
  input: { sessionId?: string | null; includePending?: boolean },
): { programmed: T[]; shown: T[] } {
  const active = activeRemovals(removals, input);
  const nextProgrammed: T[] = [];
  const nextShown: T[] = [];
  const count = Math.max(programmed.length, shown.length);
  for (let index = 0; index < count; index += 1) {
    const source = programmed[index] ?? shown[index];
    const current = shown[index] ?? programmed[index];
    if (!source || !current) continue;
    if (active.some((row) => slotIsRemoved(source.name, row))) continue;
    nextProgrammed.push(source);
    nextShown.push(current);
  }
  return { programmed: nextProgrammed, shown: nextShown };
}

/** Names a local logger draft must not resurrect. */
export function hiddenNamesForRemovals(removals: RemovalRecord[], keptNames: string[]) {
  const kept = new Set(keptNames);
  const names = new Set<string>();
  for (const row of removals) {
    if (!kept.has(row.exerciseName)) names.add(row.exerciseName);
    if (row.originalName !== row.exerciseName && !kept.has(row.originalName)) {
      names.add(row.originalName);
    }
  }
  return [...names];
}

export function canRemoveExercise(visibleCount: number) {
  return visibleCount > 1;
}

/** Programmed cards, plus exercises the member added that are not on the plan. */
export function visibleExerciseCount(
  shown: { name: string }[],
  sets: { exerciseName: string }[],
) {
  const planned = new Set(shown.map((row) => row.name));
  const extras = new Set<string>();
  for (const set of sets) {
    const name = set.exerciseName.trim();
    if (!name || planned.has(name)) continue;
    extras.add(name);
  }
  return shown.length + extras.size;
}

export function withoutExerciseName<T extends { exerciseName: string }>(
  sets: T[],
  exerciseName: string,
) {
  return sets.filter((set) => set.exerciseName !== exerciseName);
}

export function snapshotRemovedSets(
  sets: WorkoutSetInput[],
  exerciseName: string,
): RemovalSnapshot {
  const index = sets.findIndex((set) => set.exerciseName === exerciseName);
  return {
    index: index < 0 ? sets.length : index,
    sets: sets.filter((set) => set.exerciseName === exerciseName),
  };
}

export function restoreSnapshotSets(
  sets: WorkoutSetInput[],
  snapshot: RemovalSnapshot | null,
): WorkoutSetInput[] {
  if (!snapshot || snapshot.sets.length === 0) return sets;
  const name = snapshot.sets[0]?.exerciseName;
  if (!name || sets.some((set) => set.exerciseName === name)) return sets;
  const index = Math.max(0, Math.min(snapshot.index, sets.length));
  return [...sets.slice(0, index), ...snapshot.sets, ...sets.slice(index)];
}

export function parseRemovalSnapshot(raw: string): RemovalSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RemovalSnapshot>;
    if (!parsed || !Array.isArray(parsed.sets)) return null;
    const sets = parsed.sets.filter(
      (set): set is WorkoutSetInput =>
        Boolean(set) &&
        typeof set === "object" &&
        typeof (set as WorkoutSetInput).exerciseName === "string",
    );
    return {
      index: typeof parsed.index === "number" && parsed.index >= 0 ? parsed.index : 0,
      sets,
    };
  } catch {
    return null;
  }
}
