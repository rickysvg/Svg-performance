import { omitRemovedSlots, type RemovalRecord } from "@/lib/exercise-removal";
import { applySwapsToExercises, type SwapRecord } from "@/lib/exercise-swap";
import { prescribedSetTotal } from "@/lib/logged-work";

type NamedSets = { name: string; sets: number };

export function exerciseEditKey(programSlug: string, dayNumber: number) {
  return `${programSlug}:${dayNumber}`;
}

/** Swaps and removals for one member, keyed by program slug and day number. */
export type MemberExerciseEdits = Map<string, { swaps: SwapRecord[]; removals: RemovalRecord[] }>;

export function namedSetRows(
  exercises: readonly { name?: string | null; sets?: number | null }[] | null | undefined,
): NamedSets[] {
  return (exercises ?? [])
    .map((exercise) => ({
      name: (exercise.name ?? "").trim(),
      sets: Math.max(0, Math.round(exercise.sets ?? 0)),
    }))
    .filter((exercise) => exercise.name.length > 0);
}

/**
 * Exercises and sets a session should count.
 * A swap replaces the programmed name. A removal of that swapped card drops
 * the original slot, so the set total matches the logger.
 */
export function visibleSessionDose(input: {
  exercises: NamedSets[];
  swaps: SwapRecord[];
  removals: RemovalRecord[];
  sessionId: string;
  blockKey: string;
  catalogDose?: number;
}): { dose: number; names: string[]; exercises: NamedSets[] } {
  const programmed = namedSetRows(input.exercises).map((exercise) => ({
    ...exercise,
    reps: "",
    restSeconds: 0,
  }));
  const swapped = applySwapsToExercises(programmed, input.swaps, {
    sessionId: input.sessionId,
    blockKey: input.blockKey,
    includePending: false,
  });
  const shown = omitRemovedSlots(programmed, swapped, input.removals, {
    sessionId: input.sessionId,
    includePending: false,
  }).shown;
  const exercises = namedSetRows(shown);
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

/** Finish screen. Same dose the calendar, history, today, and train summary use. */
export function visibleFinishDose(input: {
  exercises: NamedSets[];
  swaps: SwapRecord[];
  removals: RemovalRecord[];
  sessionId: string;
  blockKey: string;
  catalogDose?: number;
}) {
  return visibleSessionDose(input);
}

/**
 * Dose for one logged or planned session.
 * Edits are only the rows for this program day. No slug leaves the catalog count.
 */
export function visibleDoseForSession(input: {
  exercises: readonly { name?: string | null; sets?: number | null }[];
  catalogDose?: number;
  sessionId?: string | null;
  blockKey: string;
  programSlug?: string | null;
  dayNumber?: number | null;
  edits?: MemberExerciseEdits | null;
}) {
  const key =
    input.programSlug && input.dayNumber != null
      ? exerciseEditKey(input.programSlug, input.dayNumber)
      : "";
  const edit = key && input.edits ? input.edits.get(key) : undefined;
  return visibleSessionDose({
    exercises: namedSetRows(input.exercises),
    swaps: edit?.swaps ?? [],
    removals: edit?.removals ?? [],
    sessionId: input.sessionId ?? "",
    blockKey: input.blockKey,
    catalogDose: input.catalogDose,
  });
}

/** Keep reps and media from the programmed card while showing the visible name and sets. */
export function projectVisibleExercises<T extends { name?: string | null; sets: number }>(
  exercises: readonly T[],
  visible: readonly { name: string; sets: number }[],
): T[] {
  return visible.map((row) => {
    const match = exercises.find((exercise) => (exercise.name ?? "").trim() === row.name);
    const donor = match ?? exercises[0];
    if (!donor) return { name: row.name, sets: row.sets } as T;
    return { ...donor, name: row.name, sets: row.sets };
  });
}

export function withVisiblePlanExercises<
  T extends {
    programSlug?: string;
    dayNumber?: number;
    day?: { exercises: Array<{ name?: string | null; sets: number }> } | null;
  },
>(
  session: T,
  input: {
    edits?: MemberExerciseEdits | null;
    blockKey: string;
    sessionId?: string | null;
    catalogDose?: number;
  },
): T {
  const exercises = session.day?.exercises;
  if (!exercises || exercises.length === 0) return session;
  const visible = visibleDoseForSession({
    exercises,
    catalogDose: input.catalogDose,
    sessionId: input.sessionId,
    blockKey: input.blockKey,
    programSlug: session.programSlug,
    dayNumber: session.dayNumber,
    edits: input.edits,
  });
  const same =
    visible.exercises.length === exercises.length &&
    visible.exercises.every(
      (row, index) => row.name === (exercises[index]?.name ?? "").trim() && row.sets === exercises[index]?.sets,
    );
  if (same) return session;
  return {
    ...session,
    day: session.day
      ? { ...session.day, exercises: projectVisibleExercises(exercises, visible.exercises) }
      : session.day,
  };
}
