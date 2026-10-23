import { isBikeIntervalName } from "@/lib/bike-sessions";
import { historySessionText } from "@/lib/session-progress";
import { isDurationMode, parseDurationSeconds, resolveLogMode } from "@/lib/exercise-log-mode";
import { gymExerciseKey, loggedExerciseName } from "@/lib/gym-exercise";
import { defaultLoggedReps, parseAddedPlan } from "@/lib/logger-insert";

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

/** First positive integer in a plan rep string, capped at 200. */
export function leadingPlanCount(text: string | null | undefined) {
  const match = String(text ?? "").match(/\d+/);
  if (!match) return null;
  const value = Number(match[0]);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.min(200, Math.round(value));
}

const PLAN_TIME_UNIT = "(minutes|minute|mins|min|seconds|second|secs|sec)";

function secondsForUnit(count: number, unit: string) {
  const safe = Math.min(200, count);
  const seconds = unit.toLowerCase().startsWith("min") ? safe * 60 : safe;
  return Math.max(1, Math.round(seconds));
}

/**
 * Reps or seconds from a plan string.
 * "6 / side" is 6 reps. "3x5" and "3×5" are 5 reps, not 3.
 * "3:00" is 180 seconds. "1.5 min" is 90. "2 x 30 sec" is 30 seconds per set.
 * "1 min" is 60 seconds. A range such as "30–40 sec" uses the low end.
 */
export function planWorkFromText(text: string | null | undefined): {
  reps: number | null;
  seconds: number | null;
} {
  const raw = String(text ?? "").trim();
  if (!raw) return { reps: null, seconds: null };
  const clock = raw.match(/(\d{1,3}):([0-5]\d)/);
  if (clock) {
    const total = Number(clock[1]) * 60 + Number(clock[2]);
    if (total > 0) return { reps: null, seconds: Math.min(200 * 60, total) };
  }
  const range = raw.match(
    new RegExp(`(\\d+(?:\\.\\d+)?)\\s*[-–—]\\s*\\d+(?:\\.\\d+)?\\s*${PLAN_TIME_UNIT}\\b`, "i"),
  );
  if (range) {
    const count = Number(range[1]);
    if (Number.isFinite(count) && count > 0) {
      return { reps: null, seconds: secondsForUnit(count, range[2] ?? "") };
    }
  }
  const timed = raw.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${PLAN_TIME_UNIT}\\b`, "i"));
  if (timed) {
    const count = Number(timed[1]);
    if (Number.isFinite(count) && count > 0) {
      return { reps: null, seconds: secondsForUnit(count, timed[2] ?? "") };
    }
  }
  const setsByReps = raw.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (setsByReps) {
    const reps = leadingPlanCount(setsByReps[2]);
    return { reps, seconds: null };
  }
  return { reps: leadingPlanCount(raw), seconds: null };
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
  const work = planWorkFromText(repsTextFromPrescriptionKey(set.prescriptionKey));
  const timed = set.logMode === "timed" || set.logMode === "timed_round" || set.logMode === "load_timed";
  if (timed) {
    const seconds = work.seconds ?? work.reps;
    if (seconds == null) return set;
    return { ...set, durationSeconds: seconds };
  }
  if (work.reps == null) return set;
  return { ...set, reps: work.reps };
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

/**
 * The finish screen opens for a full save and for a partial that still has
 * work. A past log and a short round save both need that screen. A short
 * custom ride stays partial; it does not become a finished plan.
 */
export function sessionOpensFinishScreen(session: { status: string; backfilled?: boolean | null }) {
  return session.status === "complete" || session.status === "partial";
}

/** History label. A short save reads partial, never complete. */
export function completionListLabel(session: {
  status: string;
  sets: TickedSet[];
  plannedSetCount?: number | null;
  programDay?: { exercises?: { name?: string | null; sets?: number | null }[] } | null;
}) {
  const dose = prescribedSetTotal(session.programDay?.exercises);
  const stored =
    sessionCountsAsPlannedCompletion(session, [], dose)
      ? "complete"
      : session.status === "complete"
        ? "partial"
        : session.status;
  const planned = session.programDay?.exercises ?? [];
  if (stored === "complete" && planned.length > 0) {
    const progress = sessionProgressLabel(exerciseSetProgress(planned, session.sets));
    if (progress?.endsWith("partial")) return "partial";
  }
  return stored;
}

/**
 * History count. Same line Calendar and the finish screen render.
 * Pass the scaled dose from calendarPlanDoses when the session is planned.
 */
export function historyCountLine(
  session: {
    status: string;
    sets: TickedSet[];
    plannedSetCount?: number | null;
    programDayId?: string | null;
    programDay?: { exercises?: { name?: string | null; sets?: number | null }[] } | null;
  },
  dose?: { dose?: number | null; exercises?: { name?: string | null; sets?: number | null }[] | null } | null,
) {
  return historySessionText(session, dose);
}

export type ExerciseProgressState = "complete" | "partial" | "open";

export type ExerciseSetProgress = {
  name: string;
  ticked: number;
  planned: number;
  state: ExerciseProgressState;
};

/** Per exercise: ticked sets against the prescription. */
export function exerciseSetProgress(
  planned: { name?: string | null; sets?: number | null }[],
  logged: TickedSet[],
): ExerciseSetProgress[] {
  const byKey = new Map<string, { name: string; ticked: number; rows: number }>();
  for (const set of logged) {
    const name = (set.exerciseName ?? "").trim();
    if (!name) continue;
    const key = exerciseCompletionKey(name);
    const row = byKey.get(key) ?? { name, ticked: 0, rows: 0 };
    row.rows += 1;
    if (setIsTicked(set)) row.ticked += 1;
    byKey.set(key, row);
  }
  const used = new Set<string>();
  const rows: ExerciseSetProgress[] = [];
  for (const exercise of planned) {
    const name = (exercise.name ?? "").trim();
    if (!name) continue;
    const key = exerciseCompletionKey(name);
    used.add(key);
    const loggedRow = byKey.get(key);
    const plannedCount = Math.max(0, Math.round(exercise.sets ?? loggedRow?.rows ?? 0));
    const ticked = loggedRow?.ticked ?? 0;
    rows.push({
      name,
      ticked,
      planned: plannedCount,
      state:
        ticked <= 0 ? "open" : plannedCount > 0 && ticked >= plannedCount ? "complete" : "partial",
    });
  }
  for (const [key, row] of byKey) {
    if (used.has(key)) continue;
    rows.push({
      name: row.name,
      ticked: row.ticked,
      planned: Math.max(row.rows, row.ticked),
      state: row.ticked <= 0 ? "open" : row.ticked >= row.rows ? "complete" : "partial",
    });
  }
  return rows;
}

export function progressTotals(rows: ExerciseSetProgress[]) {
  return {
    ticked: rows.reduce((sum, row) => sum + row.ticked, 0),
    planned: rows.reduce((sum, row) => sum + row.planned, 0),
  };
}

export function sessionProgressLabel(
  rows: ExerciseSetProgress[],
  options?: { forcePartial?: boolean },
) {
  const { ticked, planned } = progressTotals(rows);
  if (ticked <= 0) return null;
  const done =
    !options?.forcePartial &&
    planned > 0 &&
    ticked >= planned &&
    rows.every((row) => row.state === "complete" || row.planned === 0);
  return `${formatSetProgress(ticked, planned)} · ${done ? "complete" : "partial"}`;
}

/** Card and Today copy for a short save. A draft does not use this line. */
export function partialSetsLine(ticked: number, planned: number) {
  return `Partial · ${ticked}/${planned} sets`;
}

/** Finish and calendar rows. A finished exercise reads done, even on a partial day. */
export function exerciseProgressStateWord(state: string) {
  return state === "complete" ? "done" : state;
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

type ResumeSet = TickedSet & {
  notes?: string | null;
  prescriptionKey?: string | null;
  logMode?: string | null;
};

/**
 * A library add writes the prescription into the row before the member touches it.
 * Those numbers are not a resume. A tick, a different number, a load, or a note is.
 */
export function setIsUntickedPrefill(set: ResumeSet) {
  if (set.completed) return false;
  const plan = parseAddedPlan(set.prescriptionKey);
  if (!plan) return false;
  const mode = resolveLogMode({
    logMode: set.logMode,
    name: set.exerciseName ?? "",
    reps: plan.reps,
  });
  const timed = isDurationMode(mode);
  const reps = timed ? null : defaultLoggedReps(plan.reps);
  const duration = timed ? parseDurationSeconds(plan.reps) : null;
  return (
    (set.reps ?? null) === reps &&
    (set.durationSeconds ?? null) === duration &&
    set.loadValue == null &&
    (set.notes ?? "").trim().length === 0
  );
}

/** A draft can Resume when a set was ticked or the member changed one. */
export function draftHasResumeWork(sets: ResumeSet[]) {
  return sets.some((set) => {
    if (setIsTicked(set)) return true;
    if (setIsUntickedPrefill(set)) return false;
    return setHasLoggedWork(set) || (set.notes ?? "").trim().length > 0;
  });
}

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
  status: "draft" | "complete" | "partial",
  options?: { retainEmptySets?: boolean },
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
  // A round save on a mixed day keeps the other exercises' rows, including
  // ones the member has not ticked yet. Lift finishes still drop empty rows.
  if (status !== "draft" && !options?.retainEmptySets) {
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
