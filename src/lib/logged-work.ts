import { isBikeIntervalName } from "@/lib/bike-sessions";
import { gymExerciseKey, loggedExerciseName } from "@/lib/gym-exercise";

/**
 * Entered numbers mean the member did some work. They do not finish the day.
 * Done is sessionCountsAsPlannedCompletion: saved complete, with every
 * prescribed set ticked. One checked set stays partial.
 */

export type LoggedWorkSet = {
  reps?: number | null;
  loadValue?: number | null;
  durationSeconds?: number | null;
};

export function setHasLoggedWork(set: LoggedWorkSet) {
  if (typeof set.reps === "number" && Number.isFinite(set.reps)) return true;
  if (typeof set.loadValue === "number" && Number.isFinite(set.loadValue)) return true;
  if (
    typeof set.durationSeconds === "number" &&
    Number.isFinite(set.durationSeconds) &&
    set.durationSeconds > 0
  ) {
    return true;
  }
  return false;
}

/** Any entered set. Not a Done check — one logged set is still a partial day. */
export function sessionHasLoggedWork(sets: LoggedWorkSet[]) {
  return sets.some(setHasLoggedWork);
}

export type TickedSet = LoggedWorkSet & {
  completed?: boolean | null;
  exerciseName?: string | null;
};

/** A ticked set is one the member checked off and actually logged. */
export function setIsTicked(set: TickedSet) {
  return Boolean(set.completed) && setHasLoggedWork(set);
}

export function tickedSetCount(sets: TickedSet[]) {
  return sets.filter(setIsTicked).length;
}

export function tickedExerciseKeys(sets: TickedSet[]) {
  return sets.filter(setIsTicked).map((set) => gymExerciseKey(set.exerciseName ?? ""));
}

/** Catalog or saved-template dose. Missing rows count as zero. */
export function prescribedSetTotal(exercises: { sets?: number | null }[] | null | undefined) {
  return (exercises ?? []).reduce(
    (sum, exercise) => sum + Math.max(0, Math.round(exercise.sets ?? 0)),
    0,
  );
}

/**
 * Stored count wins. Otherwise the prescribed dose, then the set rows still
 * on the session. A null count must not treat one ticked row as the whole day.
 */
export function resolvedPlannedSetCount(
  session: { plannedSetCount?: number | null; sets: readonly unknown[] },
  prescribedCount?: number | null,
) {
  if (typeof session.plannedSetCount === "number" && session.plannedSetCount > 0) {
    return session.plannedSetCount;
  }
  if (typeof prescribedCount === "number" && prescribedCount > 0) return prescribedCount;
  return session.sets.length;
}

/**
 * A planned session is done only when it was saved complete, every planned
 * exercise has a ticked set, and the ticked count covers the sets prescribed
 * at start. One checked set, a draft, and status "partial" do not finish the day.
 * A push-up logged on a bike day does not finish the bike.
 */
export function sessionCountsAsPlannedCompletion(
  session: { status: string; sets: TickedSet[]; plannedSetCount?: number | null },
  plannedExerciseNames: string[],
  prescribedCount?: number | null,
) {
  if (session.status !== "complete") return false;
  const tickedCount = tickedSetCount(session.sets);
  if (tickedCount === 0) return false;
  // Null plannedSetCount falls through stored count, then dose, then rows.
  const plannedCount = resolvedPlannedSetCount(session, prescribedCount);
  if (plannedCount > 0 && tickedCount < plannedCount) return false;
  const ticked = tickedExerciseKeysForPlan(session.sets);
  if (plannedExerciseNames.length === 0) return true;
  const planned = plannedExerciseNames.map((name) => exerciseCompletionKey(name));
  // "Assault bike intervals" (the timer log) satisfies a card that says "Assault bike".
  if (planned.every((name) => ticked.includes(name))) return true;
  // Scaling can drop a catalog exercise the started session never contained.
  // A full prescription still finishes the day. A different exercise on that
  // day does not: the session has to share a planned name.
  const filled = plannedCount > 0 && tickedCount >= plannedCount;
  if (!filled) return false;
  const present = new Set(session.sets.map((set) => exerciseCompletionKey(set.exerciseName ?? "")));
  const missing = planned.filter((name) => !ticked.includes(name));
  return missing.every((name) => !present.has(name)) && planned.some((name) => ticked.includes(name));
}

/**
 * An off-plan log whose exercises were swapped is done when every logged
 * set is ticked and the count covers the dose. A stored planned count wins.
 * With no stored count, the swap still has to meet the scaled day dose:
 * two ticked sets on a 30-set day stay partial. A short log of the original
 * exercises stays partial too.
 */
export function offPlanSessionDone(
  session: { status: string; sets: TickedSet[]; plannedSetCount?: number | null },
  dose: number,
  planNames: readonly string[],
) {
  const stored =
    typeof session.plannedSetCount === "number" && session.plannedSetCount > 0
      ? session.plannedSetCount
      : null;
  const required = stored ?? (dose > 0 ? dose : null);
  const stamped = { ...session, plannedSetCount: required };
  if (sessionCountsAsPlannedCompletion(stamped, [...planNames])) return true;
  if (session.status !== "complete") return false;
  if (session.sets.length === 0 || !session.sets.every((set) => setIsTicked(set))) return false;
  const replaced = session.sets.some((set) => {
    const name = (set.exerciseName ?? "").trim();
    if (!name) return false;
    return !planNames.some((planned) => loggedNameMatchesPlanned(planned, name));
  });
  if (!replaced) return false;
  if (required != null && required > 0) return tickedSetCount(session.sets) >= required;
  return true;
}

/** First positive integer in a plan rep string. "6 / side" and "10 sec" both count. */
export function leadingPlanCount(text: string | null | undefined) {
  const match = String(text ?? "").match(/\d+/);
  if (!match) return null;
  const value = Number(match[0]);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.min(200, Math.round(value));
}

/** Rep scheme stored on a programmed set, after the exercise name. */
export function repsTextFromPrescriptionKey(key: string | null | undefined) {
  const raw = String(key ?? "").trim();
  if (!raw || raw.startsWith("added|")) return "";
  const scheme = raw.includes("|") ? (raw.split("|").pop() ?? "") : raw;
  const parts = scheme.split("::");
  return parts.length > 1 ? parts.slice(1).join("::") : "";
}

/**
 * A checked set with an empty load still counts when the plan already
 * named the reps. Bodyweight and "no pounds typed" stay savable.
 */
export function withTickedPlanWork<T extends PersistSet>(set: T): T {
  if (!set.completed || setHasLoggedWork(set)) return set;
  const count = leadingPlanCount(repsTextFromPrescriptionKey(set.prescriptionKey));
  if (count == null) return set;
  if (set.logMode === "timed" || set.logMode === "timed_round" || set.logMode === "load_timed") {
    return { ...set, durationSeconds: count };
  }
  return { ...set, reps: count };
}

/** Timer logs use a different bike label than the day card. Other names stay on their gym key. */
export function loggedNameMatchesPlanned(plannedName: string, loggedName: string) {
  if (gymExerciseKey(plannedName) === gymExerciseKey(loggedName)) return true;
  return isBikeIntervalName(plannedName) && isBikeIntervalName(loggedName);
}

function exerciseCompletionKey(name: string) {
  if (isBikeIntervalName(name)) return "\0bike-interval";
  return gymExerciseKey(name);
}

function tickedExerciseKeysForPlan(sets: readonly TickedSet[]) {
  return sets.filter(setIsTicked).map((set) => exerciseCompletionKey(set.exerciseName ?? ""));
}

/** History label. A short save reads partial, never complete. */
export function completionListLabel(session: {
  status: string;
  sets: TickedSet[];
  plannedSetCount?: number | null;
  programDay?: { exercises?: { sets?: number | null }[] } | null;
}) {
  const dose = prescribedSetTotal(session.programDay?.exercises);
  if (sessionCountsAsPlannedCompletion(session, [], dose)) return "complete";
  if (session.status === "complete") return "partial";
  return session.status;
}

export function formatSetProgress(ticked: number, planned: number) {
  if (planned > 0) return `${ticked}/${planned} sets`;
  const count = Math.max(0, ticked);
  return `${count} set${count === 1 ? "" : "s"}`;
}

/** Prisma filter: a saved set with a number the member entered. */
export const loggedSetSome = {
  some: {
    OR: [
      { reps: { not: null } },
      { loadValue: { not: null } },
      { durationSeconds: { gt: 0 } },
    ],
  },
};

type PersistSet = {
  exerciseName: string;
  setNumber: number;
  reps: number | null;
  loadValue: number | null;
  loadUnit: string;
  logMode?: string;
  durationSeconds?: number | null;
  completed: boolean;
  notes?: string;
  prescriptionKey?: string;
  rir?: string;
};

function finiteOrNull(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function logScore(set: PersistSet) {
  let score = 0;
  if (setHasLoggedWork(set)) score += 4;
  if (set.completed) score += 2;
  if (set.reps != null) score += 1;
  if (set.loadValue != null) score += 1;
  if (set.durationSeconds != null) score += 1;
  return score;
}

/** Keep every number the member typed. Empty duplicate rows do not replace them. */
function mergePersist<T extends PersistSet>(current: T, incoming: T): T {
  const incomingBetter = logScore(incoming) > logScore(current);
  const primary = incomingBetter ? incoming : current;
  const fallback = incomingBetter ? current : incoming;
  return {
    ...primary,
    exerciseName: primary.exerciseName.trim() || fallback.exerciseName.trim(),
    reps: primary.reps ?? fallback.reps,
    loadValue: primary.loadValue ?? fallback.loadValue,
    durationSeconds: primary.durationSeconds ?? fallback.durationSeconds,
    completed: primary.completed || fallback.completed,
    notes: primary.notes?.trim() ? primary.notes : fallback.notes ?? "",
    rir: primary.rir || fallback.rir || "",
    prescriptionKey: primary.prescriptionKey || fallback.prescriptionKey || "",
    logMode: primary.logMode || fallback.logMode,
    loadUnit: primary.loadUnit || fallback.loadUnit,
  };
}

/**
 * Collapse duplicate set rows before save.
 * Finish (complete) drops empty unchecked rows so a bloated 8/16-row logger
 * can still save. Draft sync keeps the plan's empty rows unless the payload
 * is already over the save cap, and never drops a row that has numbers.
 */
export function prepareSetsForPersist<T extends PersistSet>(
  sets: T[],
  status: "draft" | "complete",
): T[] {
  const order: string[] = [];
  const slots = new Map<string, T>();
  for (const set of sets) {
    const exerciseName = loggedExerciseName(set.exerciseName);
    if (!exerciseName) continue;
    const setNumber = Number.isFinite(set.setNumber) ? Math.max(1, Math.round(set.setNumber)) : 1;
    const key = `${exerciseName.toLowerCase()}\u0000${setNumber}`;
    const normalized = {
      ...set,
      exerciseName,
      setNumber,
      reps: finiteOrNull(set.reps),
      loadValue: finiteOrNull(set.loadValue),
      durationSeconds: finiteOrNull(set.durationSeconds),
    };
    const existing = slots.get(key);
    if (!existing) {
      slots.set(key, normalized);
      order.push(key);
    } else {
      slots.set(key, mergePersist(existing, normalized));
    }
  }

  let rows = order.map((key) => slots.get(key)!);
  if (status === "complete") {
    rows = rows.filter(setHasLoggedWork);
  } else if (rows.length > 80) {
    const logged = rows.filter(setHasLoggedWork);
    const empty = rows.filter((row) => !setHasLoggedWork(row));
    rows = [...logged, ...empty.slice(0, Math.max(0, 80 - logged.length))];
  }

  return renumberOutOfRange(rows).slice(0, 200);
}

function renumberOutOfRange<T extends PersistSet>(rows: T[]): T[] {
  const groups = new Map<string, T[]>();
  const order: string[] = [];
  for (const row of rows) {
    const key = loggedExerciseName(row.exerciseName).toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(row);
  }
  const out: T[] = [];
  for (const key of order) {
    const group = groups.get(key)!;
    const numbers = group.map((row) => row.setNumber);
    const needsRenumber =
      new Set(numbers).size !== numbers.length ||
      numbers.some((number) => number < 1 || number > 20);
    const sorted = [...group].sort((a, b) => a.setNumber - b.setNumber);
    sorted.forEach((row, index) => {
      out.push(needsRenumber ? { ...row, setNumber: index + 1 } : row);
    });
  }
  return out;
}
