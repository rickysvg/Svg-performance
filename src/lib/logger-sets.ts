import { isBikeIntervalName } from "@/lib/bike-sessions";
import { setHasLoggedWork } from "@/lib/logged-work";
import { textIsBikeWorkout } from "@/lib/timer-session";

export type PrescriptionSetCount = {
  name: string;
  sets: number;
};

export type LoggerDraftSet = {
  exerciseName: string;
  setNumber: number;
  reps?: number | null;
  loadValue?: number | null;
  loadUnit?: string;
  logMode?: string;
  durationSeconds?: number | null;
  completed?: boolean;
  notes?: string;
  prescriptionKey?: string;
  rir?: string;
};

export type LoggerDraftLike = {
  sets: LoggerDraftSet[];
};

type RestorableSet = {
  exerciseName: string;
  setNumber: number;
  reps?: number | null;
  loadValue?: number | null;
  loadUnit?: string;
  logMode?: string;
  durationSeconds?: number | null;
  completed?: boolean;
  notes?: string;
  prescriptionKey?: string;
  rir?: string;
};

function defaultExerciseKey(name: string) {
  return name.trim().toLowerCase();
}

function logScore(set: RestorableSet) {
  let score = 0;
  if (set.completed) score += 4;
  if (set.reps != null) score += 2;
  if (set.loadValue != null) score += 2;
  if (set.durationSeconds != null) score += 2;
  if (set.notes?.trim()) score += 1;
  return score;
}

function applyDraft<T extends RestorableSet>(base: T, snap: LoggerDraftSet, exerciseName: string): T {
  return {
    ...base,
    exerciseName,
    setNumber: snap.setNumber,
    reps: "reps" in snap ? snap.reps ?? null : base.reps,
    loadValue: "loadValue" in snap ? snap.loadValue ?? null : base.loadValue,
    loadUnit: snap.loadUnit || base.loadUnit,
    logMode: snap.logMode || base.logMode,
    durationSeconds: "durationSeconds" in snap ? snap.durationSeconds ?? null : base.durationSeconds,
    completed: "completed" in snap ? Boolean(snap.completed) : base.completed,
    notes: "notes" in snap ? snap.notes ?? "" : base.notes,
    prescriptionKey: snap.prescriptionKey || base.prescriptionKey,
    rir: snap.rir || base.rir,
  };
}

function isBikeRow(name: string) {
  return isBikeIntervalName(name) || textIsBikeWorkout(name);
}

function rowHasWork(set: {
  completed?: boolean;
  reps?: number | null;
  loadValue?: number | null;
  durationSeconds?: number | null;
}) {
  return Boolean(set.completed) || setHasLoggedWork(set);
}

/**
 * A plan ride that already has a logged bike interval does not also need the
 * plan's bike row. "Daru alactic power bike" and "Assault bike intervals" are
 * the same ride, and an empty Daru row must not be created on Undo finish.
 */
export function planRowsForLoggedSets<T extends { exerciseName: string; completed?: boolean; reps?: number | null; loadValue?: number | null; durationSeconds?: number | null }>(
  prescriptions: PrescriptionSetCount[],
  logged: readonly T[],
): PrescriptionSetCount[] {
  const loggedBike = logged.some((set) => isBikeRow(set.exerciseName) && rowHasWork(set));
  if (!loggedBike) return prescriptions;
  return prescriptions.filter((row) => !isBikeRow(row.name));
}

/** Drop an empty plan-bike row when the logged bike exercise already has a name. */
export function dropEmptyPlanBikeRows<T extends { exerciseName: string; completed?: boolean; reps?: number | null; loadValue?: number | null; durationSeconds?: number | null }>(
  rows: T[],
  logged: readonly { exerciseName: string; completed?: boolean; reps?: number | null; loadValue?: number | null; durationSeconds?: number | null }[],
): T[] {
  const keep = new Set(
    logged.filter((set) => isBikeRow(set.exerciseName) && rowHasWork(set)).map((set) => set.exerciseName),
  );
  if (keep.size === 0) return rows;
  return rows.filter((row) => {
    if (!isBikeRow(row.exerciseName)) return true;
    if (keep.has(row.exerciseName)) return true;
    if (rowHasWork(row)) return true;
    return false;
  });
}

/** The set count printed on the exercise card, capped like the save validator. */
export function prescribedSetTarget(sets: number) {
  if (!Number.isFinite(sets)) return 0;
  return Math.max(0, Math.min(20, Math.round(sets)));
}

/**
 * Pre-create one row per prescribed set. Extra rows the athlete added stay.
 * Missing rows are appended so a 4-set card does not open on 2 rows.
 */
export function withPrescribedSetRows<T extends { exerciseName: string; setNumber: number }>(
  sets: T[],
  prescriptions: PrescriptionSetCount[],
  createSet: (exerciseName: string, setNumber: number) => T,
): T[] {
  if (prescriptions.length === 0) return sets;
  const next = [...sets];
  for (const prescription of prescriptions) {
    const target = prescribedSetTarget(prescription.sets);
    const existing = next.filter((set) => set.exerciseName === prescription.name);
    let missing = target - existing.length;
    if (missing <= 0) continue;
    let setNumber = existing.reduce((max, set) => Math.max(max, set.setNumber), 0);
    while (missing > 0) {
      setNumber += 1;
      next.push(createSet(prescription.name, setNumber));
      missing -= 1;
    }
  }
  return next;
}

function mergeLogged<T extends RestorableSet>(current: T, incoming: T): T {
  const incomingBetter = logScore(incoming) > logScore(current);
  const primary = incomingBetter ? incoming : current;
  const fallback = incomingBetter ? current : incoming;
  const id =
    (current as { id?: string }).id ?? (incoming as { id?: string }).id;
  return {
    ...primary,
    ...(id ? { id } : {}),
    exerciseName: primary.exerciseName || fallback.exerciseName,
    setNumber: primary.setNumber || fallback.setNumber,
    reps: primary.reps ?? fallback.reps,
    loadValue: primary.loadValue ?? fallback.loadValue,
    durationSeconds: primary.durationSeconds ?? fallback.durationSeconds,
    loadUnit: primary.loadUnit || fallback.loadUnit,
    logMode: primary.logMode || fallback.logMode,
    completed: Boolean(primary.completed || fallback.completed),
    notes: primary.notes?.trim() ? primary.notes : fallback.notes ?? "",
    prescriptionKey: primary.prescriptionKey || fallback.prescriptionKey,
    rir: primary.rir || fallback.rir,
  } as T;
}

/**
 * Rebuild logger rows for a reload.
 * Draft values replace the server row at the same set index.
 * A second copy of the prescription is not appended.
 * Numbers the member already typed are kept.
 */
export function restoreLoggerSets<T extends RestorableSet>(
  serverSets: T[],
  draft: LoggerDraftLike | null,
  prescriptions: PrescriptionSetCount[],
  createSet: (exerciseName: string, setNumber: number) => T,
  exerciseKey: (name: string) => string = defaultExerciseKey,
): T[] {
  const prescriptionByKey = new Map<string, PrescriptionSetCount>();
  for (const prescription of prescriptions) {
    const key = exerciseKey(prescription.name);
    if (!prescriptionByKey.has(key)) prescriptionByKey.set(key, prescription);
  }

  const order: string[] = [];
  const seen = new Set<string>();
  const touch = (name: string) => {
    const key = exerciseKey(name);
    if (!seen.has(key)) {
      seen.add(key);
      order.push(key);
    }
    return key;
  };
  // Saved order wins, so an exercise inserted between two others stays there
  // after a reload. A draft on this phone is newer than the server copy.
  // The program order only fills a name that is not already in either list.
  const primary = draft?.sets.length ? draft.sets : serverSets;
  for (const set of primary) if (set.exerciseName) touch(set.exerciseName);
  if (draft?.sets.length) {
    for (const set of serverSets) if (set.exerciseName) touch(set.exerciseName);
  }
  for (const prescription of prescriptions) touch(prescription.name);

  const slots = new Map<string, Map<number, T>>();
  const slotMap = (key: string) => {
    let map = slots.get(key);
    if (!map) {
      map = new Map();
      slots.set(key, map);
    }
    return map;
  };
  const displayName = (key: string, fallback: string) =>
    prescriptionByKey.get(key)?.name ?? fallback;

  for (const set of serverSets) {
    const number = Number.isFinite(set.setNumber) ? Math.round(set.setNumber) : 0;
    if (!set.exerciseName || number < 1) continue;
    const key = exerciseKey(set.exerciseName);
    const name = displayName(key, set.exerciseName);
    const named = { ...set, exerciseName: name, setNumber: number };
    const map = slotMap(key);
    const existing = map.get(number);
    map.set(number, existing ? mergeLogged(existing, named) : named);
  }

  for (const snap of draft?.sets ?? []) {
    const number = Number.isFinite(snap.setNumber) ? Math.round(snap.setNumber) : 0;
    if (!snap.exerciseName || number < 1) continue;
    const key = exerciseKey(snap.exerciseName);
    const name = displayName(key, snap.exerciseName);
    const map = slotMap(key);
    const existing = map.get(number);
    const base = existing ?? createSet(name, number);
    map.set(number, applyDraft(base, { ...snap, setNumber: number }, name));
  }

  const result: T[] = [];
  for (const key of order) {
    const map = slots.get(key);
    if (!map || map.size === 0) {
      const missing = prescriptionByKey.get(key);
      const missingTarget = missing ? prescribedSetTarget(missing.sets) : 0;
      if (!missing || missingTarget <= 0) continue;
      for (let n = 1; n <= missingTarget; n += 1) result.push(createSet(missing.name, n));
      continue;
    }
    const prescription = prescriptionByKey.get(key);
    const target = prescription ? prescribedSetTarget(prescription.sets) : 0;
    const name = prescription?.name ?? [...map.values()][0]!.exerciseName;
    const bikeChoice = [...map.values()].some((row) => String(row.prescriptionKey ?? "").includes("#bw:"));
    if (bikeChoice) {
      const chosen = [...map.values()]
        .filter((row) => String(row.prescriptionKey ?? "").includes("#bw:"))
        .sort((a, b) => a.setNumber - b.setNumber);
      chosen.forEach((row, index) => {
        result.push({ ...row, exerciseName: name, setNumber: index + 1 });
      });
      continue;
    }
    if (target <= 0) {
      for (const setNumber of [...map.keys()].sort((a, b) => a - b)) {
        const row = map.get(setNumber)!;
        result.push({ ...row, exerciseName: name, setNumber });
      }
      continue;
    }

    const kept = new Map<number, T>();
    const extras: T[] = [];
    for (const [setNumber, row] of map) {
      if (setNumber <= target) kept.set(setNumber, { ...row, exerciseName: name, setNumber });
      else extras.push({ ...row, exerciseName: name });
    }
    for (let n = 1; n <= target; n += 1) {
      if (!kept.has(n)) kept.set(n, createSet(name, n));
    }

    const loggedExtras: T[] = [];
    const emptyExtras: T[] = [];
    const duplicateBatch = extras.length >= target;
    for (const extra of extras.sort((a, b) => a.setNumber - b.setNumber)) {
      if (!setHasLoggedWork(extra)) {
        emptyExtras.push(extra);
        continue;
      }
      const slot = ((extra.setNumber - 1) % target) + 1;
      const home = kept.get(slot);
      if (duplicateBatch && home && !setHasLoggedWork(home)) {
        kept.set(slot, mergeLogged(home, { ...extra, setNumber: slot, exerciseName: name }));
        continue;
      }
      loggedExtras.push(extra);
    }

    for (let n = 1; n <= target; n += 1) {
      result.push(kept.get(n)!);
    }
    if (emptyExtras.length < target) {
      result.push(...emptyExtras);
    }
    result.push(...loggedExtras);
  }
  return result;
}
