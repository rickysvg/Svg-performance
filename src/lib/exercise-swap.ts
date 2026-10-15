/**
 * Swap an exercise and keep a prescription that fits the replacement.
 * Same pattern (lower for lower, press for press) keeps the day's sets, RIR, and rest.
 * A different pattern uses the library's own sets, reps, RIR, and rest.
 */
import { bikeWeekIndex } from "@/lib/bike-sessions";
import {
  canonicalExerciseName,
  categoryLabel,
  libraryExercise,
  type ExerciseCategory,
  type LibraryExercise,
} from "@/lib/exercise-library";
import { isLogMode, resolveLogMode, type LogMode } from "@/lib/exercise-log-mode";
import { formVideoFieldsFor } from "@/lib/form-videos";
import { mesoBlockForWeekIndex } from "@/lib/mesocycle";
import { mergeLoadText, rirFromLoadText } from "@/lib/rir";
import { dayKey, mondayOfZoned } from "@/lib/timezone";

export type SwapScope = "session" | "block";

export type SwapPrescription = {
  name: string;
  sets: number;
  reps: string;
  loadText: string;
  restSeconds: number;
  logMode: LogMode;
  notes: string;
  category: ExerciseCategory;
};

export type SwapRecord = {
  originalName: string;
  replacementName: string;
  scope: SwapScope;
  workoutSessionId: string;
  blockKey: string;
  sets: number;
  reps: string;
  loadText: string;
  restSeconds: number;
  logMode: string;
  notes: string;
  retiredNames: string[];
};

export type SwapSlot = {
  programmedName: string;
  currentName: string;
  sets: number;
  reps: string;
  loadText: string;
  restSeconds: number;
  logMode: string;
  notes: string;
};

const RIR_TOKEN = /\b(\d+\s*-\s*\d+|\d+\+)\s*RIR\b/i;

export function trainingBlockKey(date: Date, timeZone: string) {
  const weekIndex = bikeWeekIndex(date, timeZone);
  const block = mesoBlockForWeekIndex(weekIndex);
  return `${dayKey(mondayOfZoned(date, timeZone), timeZone)}:${block}`;
}

function prescriptionFamily(category: ExerciseCategory) {
  if (category === "upper_push" || category === "upper_pull") return "upper";
  return category;
}

function isUnilateral(reps: string) {
  return /\/\s*(side|leg|arm|each)/i.test(reps);
}

function clampSets(sets: number) {
  if (!Number.isFinite(sets)) return 1;
  return Math.min(12, Math.max(1, Math.round(sets)));
}

function libraryPrescription(exercise: LibraryExercise): SwapPrescription {
  return {
    name: exercise.name,
    sets: clampSets(exercise.sets),
    reps: exercise.reps,
    loadText: exercise.loadText,
    restSeconds: Math.max(0, exercise.restSeconds),
    logMode: exercise.logMode,
    notes: exercise.notes,
    category: exercise.category,
  };
}

function sourceCategory(name: string): ExerciseCategory | null {
  return libraryExercise(canonicalExerciseName(name))?.category ?? null;
}

/**
 * Keep the day's sets, RIR, and rest when the replacement is the same kind of work.
 * Otherwise use the replacement's own prescription.
 */
export function sensiblePrescription(
  source: {
    name: string;
    sets: number;
    reps: string;
    loadText: string;
    restSeconds: number;
    logMode?: string | null;
  },
  replacementName: string,
): SwapPrescription | null {
  const replacement = libraryExercise(replacementName);
  if (!replacement) return null;
  const target = libraryPrescription(replacement);
  const sourceMode = resolveLogMode({
    logMode: source.logMode,
    name: source.name,
    reps: source.reps,
  });
  const sourceFamily = sourceCategory(source.name);
  const samePattern =
    sourceFamily != null &&
    prescriptionFamily(sourceFamily) === prescriptionFamily(target.category) &&
    sourceMode === target.logMode;
  if (!samePattern) return target;

  const reps =
    isUnilateral(source.reps) === isUnilateral(target.reps) ? source.reps : target.reps;
  let loadText = target.loadText;
  const sourceRir = rirFromLoadText(source.loadText);
  const targetRir = rirFromLoadText(target.loadText);
  if (sourceRir && targetRir) {
    loadText = target.loadText.replace(RIR_TOKEN, sourceRir);
  } else if (!targetRir) {
    loadText = target.loadText;
  } else {
    loadText = mergeLoadText(source.loadText, target.loadText);
  }
  return {
    ...target,
    sets: clampSets(source.sets),
    reps,
    loadText,
    restSeconds: Math.max(0, source.restSeconds),
  };
}

export function replacementForSlot(
  swaps: SwapRecord[],
  originalName: string,
  input: { sessionId?: string | null; blockKey: string; includePending?: boolean },
): SwapRecord | null {
  const rows = swaps.filter((swap) => swap.originalName === originalName);
  if (input.sessionId) {
    const bound = rows.find(
      (swap) => swap.scope === "session" && swap.workoutSessionId === input.sessionId,
    );
    if (bound) return bound;
  }
  if (input.includePending || !input.sessionId) {
    const pending = rows.find((swap) => swap.scope === "session" && swap.workoutSessionId === "");
    if (pending) return pending;
  }
  return rows.find((swap) => swap.scope === "block" && swap.blockKey === input.blockKey) ?? null;
}

type Swappable = {
  name: string;
  sets: number;
  reps: string;
  loadText?: string;
  restSeconds: number;
  logMode?: string;
  notes?: string;
  formVideoUrl?: string;
  formVideoPending?: boolean;
};

export function applySwapsToExercises<T extends Swappable>(
  exercises: T[],
  swaps: SwapRecord[],
  input: { sessionId?: string | null; blockKey: string; includePending?: boolean },
): T[] {
  return exercises.map((exercise) => {
    const swap = replacementForSlot(swaps, exercise.name, input);
    if (!swap || swap.replacementName === exercise.name) return exercise;
    const mode = isLogMode(swap.logMode) ? swap.logMode : resolveLogMode({ name: swap.replacementName, reps: swap.reps });
    const video = formVideoFieldsFor(swap.replacementName);
    return {
      ...exercise,
      name: swap.replacementName,
      sets: swap.sets,
      reps: swap.reps,
      loadText: swap.loadText,
      restSeconds: swap.restSeconds,
      logMode: mode,
      notes: swap.notes,
      formVideoUrl: video.formVideoUrl,
      formVideoPending: video.formVideoPending,
    };
  });
}

export function swapSlotsFor(programmed: Swappable[], shown: Swappable[]): SwapSlot[] {
  return programmed.map((source, index) => {
    const current = shown[index] ?? source;
    return {
      programmedName: source.name,
      currentName: current.name,
      sets: current.sets,
      reps: current.reps,
      loadText: current.loadText ?? "",
      restSeconds: current.restSeconds,
      logMode: current.logMode ?? resolveLogMode({ name: current.name, reps: current.reps }),
      notes: current.notes ?? "",
    };
  });
}

export function retiredNamesFromSwaps(swaps: SwapRecord[], shownNames: string[]) {
  const shown = new Set(shownNames);
  const names = new Set<string>();
  for (const swap of swaps) {
    if (!shown.has(swap.originalName)) names.add(swap.originalName);
    for (const name of swap.retiredNames) {
      if (!shown.has(name)) names.add(name);
    }
  }
  return [...names];
}

export function describeSwap(exercise: LibraryExercise) {
  return `${categoryLabel(exercise.category)} · ${exercise.sets} × ${exercise.reps}`;
}
