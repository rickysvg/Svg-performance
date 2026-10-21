/**
 * Insert, reorder, and remove an exercise inside a logger without folding it
 * into a programmed row. Order is the first time each name appears.
 */
import { isDurationMode, parseDurationSeconds, resolveLogMode } from "@/lib/exercise-log-mode";
import { distinctExerciseName } from "@/lib/exercise-swap";
import type { LibraryExercise } from "@/lib/exercise-library";

export function exerciseNamesInOrder<T extends { exerciseName: string }>(sets: T[]): string[] {
  const names: string[] = [];
  for (const set of sets) {
    const name = set.exerciseName.trim();
    if (!name || names.includes(name)) continue;
    names.push(name);
  }
  return names;
}

export function insertSetsAtExercise<T extends { exerciseName: string }>(
  sets: T[],
  index: number,
  incoming: T[],
): T[] {
  if (incoming.length === 0) return sets;
  const names = exerciseNamesInOrder(sets);
  const at = Math.max(0, Math.min(Math.round(index), names.length));
  if (at >= names.length) return [...sets, ...incoming];
  const pivot = sets.findIndex((set) => set.exerciseName === names[at]);
  if (pivot < 0) return [...sets, ...incoming];
  return [...sets.slice(0, pivot), ...incoming, ...sets.slice(pivot)];
}

export function moveExercise<T extends { exerciseName: string }>(
  sets: T[],
  name: string,
  direction: "up" | "down",
): T[] {
  const names = exerciseNamesInOrder(sets);
  const index = names.indexOf(name);
  if (index < 0) return sets;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= names.length) return sets;
  const nextNames = [...names];
  const [moved] = nextNames.splice(index, 1);
  nextNames.splice(target, 0, moved!);
  const groups = new Map<string, T[]>();
  for (const set of sets) {
    const list = groups.get(set.exerciseName) ?? [];
    list.push(set);
    groups.set(set.exerciseName, list);
  }
  return nextNames.flatMap((exercise) => groups.get(exercise) ?? []);
}

export function removeExerciseSets<T extends { exerciseName: string }>(sets: T[], name: string): T[] {
  return sets.filter((set) => set.exerciseName !== name);
}

export function libraryBaseName(name: string) {
  return name.replace(/\s·\s\d+$/, "").trim();
}

export function defaultSetCount(sets: number) {
  if (!Number.isFinite(sets)) return 1;
  return Math.min(12, Math.max(1, Math.round(sets)));
}

/** Leading count from a library rep string ("8 / leg", "30 sec"). */
export function defaultLoggedReps(reps: string): number | null {
  const match = String(reps).match(/(\d+)/);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n) || n <= 0 || n > 200) return null;
  return n;
}

export type AddedSetDraft = {
  exerciseName: string;
  setNumber: number;
  reps: number | null;
  durationSeconds: number | null;
  logMode: string;
  restSeconds: number;
  prescriptionReps: string;
};

/** One row per library set. A name already in the workout stays its own exercise. */
export function draftsForLibraryExercise(
  used: Iterable<string>,
  exercise: Pick<LibraryExercise, "name" | "sets" | "reps" | "logMode" | "restSeconds">,
): AddedSetDraft[] {
  const exerciseName = distinctExerciseName(used, exercise.name);
  const logMode = resolveLogMode({
    logMode: exercise.logMode,
    name: exerciseName,
    reps: exercise.reps,
  });
  const timed = isDurationMode(logMode);
  const reps = timed ? null : defaultLoggedReps(exercise.reps);
  const durationSeconds = timed ? parseDurationSeconds(exercise.reps) : null;
  const count = defaultSetCount(exercise.sets);
  const restSeconds = Math.max(0, Math.round(exercise.restSeconds) || 0);
  return Array.from({ length: count }, (_, index) => ({
    exerciseName,
    setNumber: index + 1,
    reps,
    durationSeconds,
    logMode,
    restSeconds,
    prescriptionReps: exercise.reps,
  }));
}

/** Rest, reps, and optional load notes travel with the set. No schema change. */
export function addedPrescriptionKey(input: {
  exerciseName: string;
  reps: string;
  restSeconds: number;
  loadText?: string;
  notes?: string;
}) {
  const rest = Math.max(0, Math.round(input.restSeconds) || 0);
  const base = `added|${encodeURIComponent(input.exerciseName.trim())}|${encodeURIComponent(input.reps.trim())}|${rest}`;
  const loadText = input.loadText?.trim() ?? "";
  const notes = input.notes?.trim() ?? "";
  const extra = loadText || notes ? `|${encodeURIComponent(loadText)}|${encodeURIComponent(notes)}` : "";
  return `${base}${extra}`.slice(0, 240);
}

function decodePlanPart(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseAddedPlan(
  key: string | null | undefined,
): { reps: string; restSeconds: number; loadText?: string; notes?: string } | null {
  const raw = String(key ?? "");
  if (!raw.startsWith("added|")) return null;
  const parts = raw.split("|");
  if (parts.length < 4) return null;
  const reps = decodePlanPart(parts[2] ?? "");
  const restSeconds = Number(parts[3]);
  if (!Number.isFinite(restSeconds)) return null;
  const base = { reps, restSeconds: Math.max(0, restSeconds) };
  if (parts.length < 5) return base;
  const loadText = decodePlanPart(parts[4] ?? "");
  const notes = decodePlanPart(parts[5] ?? "");
  if (!loadText && !notes) return base;
  return { ...base, loadText, notes };
}
