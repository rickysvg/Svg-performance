import { isBikeIntervalName } from "@/lib/bike-sessions";
import { omitRemovedSlots, type RemovalRecord } from "@/lib/exercise-removal";
import { isShadowName, resolveLogMode } from "@/lib/exercise-log-mode";
import { applySwapsToExercises, type SwapRecord } from "@/lib/exercise-swap";
import { prescribedSetTotal } from "@/lib/logged-work";
import { configuredRoundTotal } from "@/lib/round-session";

type NamedSets = { name: string; sets: number };

export type VisibleDoseSet = {
  exerciseName?: string | null;
  prescriptionKey?: string | null;
  logMode?: string | null;
};

function countsAsRoundSet(set: VisibleDoseSet) {
  const mode = resolveLogMode({ logMode: set.logMode, name: set.exerciseName ?? "" });
  if (mode === "timed_round" || isBikeIntervalName(set.exerciseName ?? "") || isShadowName(set.exerciseName ?? "")) {
    return true;
  }
  const key = set.prescriptionKey ?? "";
  return key.startsWith("round:") || key === "bagwork";
}

/**
 * A rounds-only log counts sets × rounds from the stored interval, not the
 * catalog's single set. A mixed log keeps each card's own count.
 */
function doseWithIntervalPlan(
  exercises: NamedSets[],
  summed: number,
  catalog: number,
  loggedSets?: readonly VisibleDoseSet[],
) {
  const base = summed > 0 ? summed : catalog;
  if (!loggedSets || loggedSets.length === 0 || !loggedSets.every(countsAsRoundSet)) {
    return { dose: base, exercises };
  }
  const configured = configuredRoundTotal([...loggedSets]);
  if (configured <= 0) return { dose: base, exercises };
  if (exercises.length !== 1) return { dose: Math.max(base, configured), exercises };
  const sets = Math.max(exercises[0]!.sets, configured);
  return { dose: sets, exercises: [{ ...exercises[0]!, sets }] };
}

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
  /** Logged rows. Interval keys raise a rounds-only plan to sets × rounds. */
  loggedSets?: readonly VisibleDoseSet[];
  includePending?: boolean;
}): { dose: number; names: string[]; exercises: NamedSets[] } {
  const programmed = namedSetRows(input.exercises).map((exercise) => ({
    ...exercise,
    reps: "",
    restSeconds: 0,
  }));
  const swapped = applySwapsToExercises(programmed, input.swaps, {
    sessionId: input.sessionId,
    blockKey: input.blockKey,
    includePending: input.includePending,
  });
  const shown = omitRemovedSlots(programmed, swapped, input.removals, {
    sessionId: input.sessionId,
    includePending: false,
  }).shown;
  const shownRows = namedSetRows(shown);
  const summed = prescribedSetTotal(shownRows);
  const catalog =
    typeof input.catalogDose === "number" && input.catalogDose > 0
      ? Math.round(input.catalogDose)
      : 0;
  const planned = doseWithIntervalPlan(shownRows, summed, catalog, input.loggedSets);
  return {
    dose: planned.dose,
    names: planned.exercises.map((exercise) => exercise.name),
    exercises: planned.exercises,
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
  loggedSets?: readonly VisibleDoseSet[];
}) {
  return visibleSessionDose(input);
}

/**
 * Dose for one logged or planned session.
 * Edits are only the rows for this program day. No slug leaves the catalog count.
 */
/** Tile copy for a short save. "2/22 · Partial" when the visible dose is known. */
export function visiblePartialLabel(ticked?: number | null, planned?: number | null) {
  if (ticked != null && planned != null && planned > 0 && ticked >= 0) {
    return `${ticked}/${planned} · Partial`;
  }
  return "Partial";
}

export function visibleDoseForSession(input: {
  exercises: readonly { name?: string | null; sets?: number | null }[];
  catalogDose?: number;
  sessionId?: string | null;
  blockKey: string;
  programSlug?: string | null;
  dayNumber?: number | null;
  edits?: MemberExerciseEdits | null;
  loggedSets?: readonly VisibleDoseSet[];
  includePending?: boolean;
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
    loggedSets: input.loggedSets,
    includePending: input.includePending,
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
    includePending?: boolean;
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
    includePending: input.includePending,
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
