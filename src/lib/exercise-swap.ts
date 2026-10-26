/**
 * Swap an exercise and keep a prescription that fits the replacement.
 * Same pattern (lower for lower, press for press) keeps the day's sets, RIR, and rest.
 * A different pattern uses the library's own sets, reps, RIR, and rest.
 */
import { bikeWeekIndex, memberWeekIndex } from "@/lib/bike-sessions";
import {
  canonicalExerciseName,
  categoryLabel,
  EXERCISE_LIBRARY,
  libraryExercise,
  type ExerciseCategory,
  type LibraryExercise,
} from "@/lib/exercise-library";
import { tagsForExercise } from "@/lib/exercise-tags";
import { isLogMode, resolveLogMode, type LogMode } from "@/lib/exercise-log-mode";
import { formVideoFieldsFor } from "@/lib/form-videos";
import { mesoBlockForWeekIndex } from "@/lib/mesocycle";
import { mergeLoadText, rirFromLoadText } from "@/lib/rir";
import { dayKey, mondayOfZoned } from "@/lib/timezone";

export type SwapScope = "session" | "block";

/** "Goblet squat (2)" is the same exercise. A swap must not invent that suffix. */
export function cleanSwapName(name: string) {
  return name.replace(/\s*\((?:\d+|second)\)\s*$/i, "").trim();
}

export function swapAlreadyInWorkoutMessage(name: string) {
  return `${cleanSwapName(name)} is already in this workout. This swap stays as its own exercise.`;
}

/** A second copy keeps its own name so the logger does not fold the two together. */
export function distinctExerciseName(used: Iterable<string>, baseName: string) {
  const taken = new Set(used);
  const base = cleanSwapName(baseName);
  if (!taken.has(base)) return base;
  let n = 2;
  let candidate = `${base} · ${n}`;
  while (taken.has(candidate)) {
    n += 1;
    candidate = `${base} · ${n}`;
  }
  return candidate;
}

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

export function trainingBlockKey(
  date: Date,
  timeZone: string,
  anchor?: Date | null,
  weekIndex?: number | null,
) {
  const index =
    typeof weekIndex === "number" && Number.isFinite(weekIndex)
      ? Math.max(0, Math.floor(weekIndex))
      : anchor && !Number.isNaN(anchor.getTime())
        ? memberWeekIndex(date, anchor, timeZone)
        : bikeWeekIndex(date, timeZone);
  const block = mesoBlockForWeekIndex(index);
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
  const used = new Set(exercises.map((exercise) => exercise.name));
  return exercises.map((exercise) => {
    const swap = replacementForSlot(swaps, exercise.name, input);
    if (!swap || swap.replacementName === exercise.name) return exercise;
    used.delete(exercise.name);
    const name = distinctExerciseName(used, swap.replacementName);
    used.add(name);
    const mode = isLogMode(swap.logMode) ? swap.logMode : resolveLogMode({ name: swap.replacementName, reps: swap.reps });
    const video = formVideoFieldsFor(name);
    return {
      ...exercise,
      name,
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

function equipmentFits(exercise: LibraryExercise, equipment: "gym" | "none") {
  // Bodyweight and no-equipment work in a gym. Gym-only gear does not fit a no-weights session.
  if (exercise.equipment === "none" || exercise.equipment === "both") return true;
  return equipment === "gym";
}

function swapSource(name: string) {
  const raw = name.trim();
  const current = canonicalExerciseName(raw);
  const near = libraryExercise(current) ?? libraryExercise(raw);
  return { raw, current, near };
}

/** Same movement pattern, or an explicit swap either way. A shared tag is not enough. */
export function isGoodSwapMatch(name: string, exercise: LibraryExercise) {
  const { raw, current, near } = swapSource(name);
  if (near && exercise.category === near.category) return true;
  if (near?.swapsWith?.includes(exercise.name)) return true;
  return Boolean(exercise.swapsWith?.includes(current) || exercise.swapsWith?.includes(raw));
}

/**
 * Finer than the library category. Hip switches stay with hip openers,
 * squats stay with squats, and a push-up stays with presses.
 */
export function movementTarget(name: string): string {
  const canonical = canonicalExerciseName(name);
  const n = canonical.toLowerCase();
  if (/90\/90|hip circle|hip switch|butterfly|\bpigeon\b/.test(n)) return "hip-rotation";
  if (/frog|couch stretch|deep squat hold|knee to chest|leg raise/.test(n)) return "hip-opener";
  if (/half split|straddle lean|wall hang/.test(n)) return "hamstring";
  if (/\bankle\b/.test(n)) return "ankle";
  if (/shoulder circle|child's pose|^hang$/.test(n)) return "shoulder";
  if (/\bneck\b/.test(n)) return "neck";
  if (/squat jump|broad jump|plyo/.test(n)) return "explosive";
  if (/sit-to-stand|\bsquat\b/.test(n)) return "squat";
  if (/hinge|deadlift|\brdl\b|glute bridge|hip thrust/.test(n)) return "hinge";
  if (/lunge|step-up|split squat/.test(n)) return "lunge";
  if (/pike|overhead/.test(n)) return "overhead-push";
  if (/push-?up|\bbench\b|floor press|landmine press|chest pass/.test(n)) return "horizontal-push";
  if (/\brow\b|pulldown|pull-apart|chin-up|face pull|pullover/.test(n)) return "pull";
  if (/plank|dead bug|hollow|bird dog|pallof|woodchop/.test(n)) return "core";
  const category = libraryExercise(canonical)?.category;
  return category ?? "general";
}

/** Body region used for the Best badge. Hip openers share a region; a squat does not. */
export function movementRegion(name: string): string {
  const target = movementTarget(name);
  if (target === "hip-rotation" || target === "hip-opener" || target === "hamstring") return "hip";
  if (target === "horizontal-push" || target === "overhead-push") return "push";
  if (target === "squat" || target === "hinge" || target === "lunge" || target === "lower") return "lower";
  return target;
}

/** The lime Best badge. Region and pattern both have to match. */
export function showBestSwapBadge(name: string, suggestions: readonly LibraryExercise[]) {
  const top = suggestions[0];
  const { near } = swapSource(name);
  if (!top || !near || top.category !== near.category) return false;
  return movementRegion(near.name) === movementRegion(top.name);
}

/**
 * The three replacements a member can tap without searching.
 * Body region comes first, then pattern, then equipment.
 * Bodyweight still fits a gym member. Logged lifts only reorder inside that region.
 */
export function bestSwapReplacements(input: {
  name: string;
  equipment: "gym" | "none";
  loggedNames?: readonly string[];
  limit?: number;
}): LibraryExercise[] {
  const limit = Math.max(1, input.limit ?? 3);
  const { raw, current, near } = swapSource(input.name);
  const sourceTags = new Set(tagsForExercise(near?.name ?? current).map((tag) => tag.toLowerCase()));
  const preferred = new Set<string>([
    ...(near?.swapsWith ?? []),
    ...EXERCISE_LIBRARY.filter(
      (exercise) => exercise.swapsWith?.includes(current) || exercise.swapsWith?.includes(raw),
    ).map((exercise) => exercise.name),
  ]);
  const loggedRank = new Map<string, number>();
  for (const [index, name] of (input.loggedNames ?? []).entries()) {
    const clean = canonicalExerciseName(name);
    if (!loggedRank.has(clean)) loggedRank.set(clean, index);
  }
  const sourceTarget = movementTarget(near?.name ?? current);
  const sourceRegion = movementRegion(near?.name ?? current);
  const ranked = EXERCISE_LIBRARY.filter((exercise) => {
    if (exercise.memberHidden) return false;
    if (exercise.name === raw) return false;
    if (exercise.name === current && raw === current) return false;
    if (!equipmentFits(exercise, input.equipment)) return false;
    return isGoodSwapMatch(input.name, exercise);
  })
    .map((exercise) => {
      let score = 0;
      const samePattern = Boolean(near && exercise.category === near.category);
      const sameTarget = movementTarget(exercise.name) === sourceTarget;
      const sameRegion = movementRegion(exercise.name) === sourceRegion;
      if (preferred.has(exercise.name)) score += 80;
      if (samePattern) score += 40;
      const shared = tagsForExercise(exercise.name).filter((tag) => sourceTags.has(tag.toLowerCase())).length;
      score += shared * 15;
      const logged = loggedRank.get(exercise.name);
      if (logged != null) score += Math.max(8, 28 - logged * 4);
      const equipmentRank =
        near && exercise.equipment === near.equipment ? 0 : exercise.equipment === "both" || near?.equipment === "both" ? 1 : 2;
      return { exercise, score, samePattern, sameTarget, sameRegion, equipmentRank };
    })
    .sort(
      (a, b) =>
        Number(b.sameTarget) - Number(a.sameTarget) ||
        Number(b.sameRegion) - Number(a.sameRegion) ||
        Number(b.samePattern) - Number(a.samePattern) ||
        b.score - a.score ||
        a.equipmentRank - b.equipmentRank ||
        a.exercise.name.localeCompare(b.exercise.name),
    );
  const regional = ranked.filter((row) => row.sameRegion);
  return (regional.length > 0 ? regional : ranked).slice(0, limit).map((row) => row.exercise);
}
