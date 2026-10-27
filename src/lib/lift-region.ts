import {
  EXERCISE_LIBRARY,
  canonicalExerciseName,
  type ExerciseCategory,
} from "@/lib/exercise-library";

const CATEGORY_BY_NAME = new Map<string, ExerciseCategory>(
  EXERCISE_LIBRARY.map((exercise) => [exercise.name.toLowerCase(), exercise.category]),
);

export type LiftRegion = "lower" | "upper";

/**
 * Program and Daru names that are not in the exercise library.
 * Farmer's carry is not here: it aliases to Farmer carry, which the library
 * already files under conditioning.
 */
const LIFT_REGION_MAP: Record<string, LiftRegion> = {
  "Bent-over DB shrug": "upper",
  "Prone Y raise": "upper",
  "Prone T raise": "upper",
  "Prone W raise": "upper",
  "Prone scap squeeze": "upper",
  "Sled hamstring drag": "lower",
  Superman: "lower",
  "Superman hold": "lower",
};

const NAME_ALIASES: Record<string, string> = {
  "Farmer's carry": "Farmer carry",
};

/**
 * Names reviewed in the program, Daru list, bodyweight plan, and mobility
 * neck drills that are not an upper or lower lift. They stay out of those
 * filters instead of being forced into one.
 */
export const UNMAPPED_EXERCISE_NAMES = [
  "Neck extension hold",
  "Neck isometric matrix",
  "Neck isometric — extension",
  "Neck isometric — left",
  "Neck isometric — right",
  "Banded DB front-rack march",
  "Mountain climbers",
] as const;

export type LiftMetadataKind = LiftRegion | "other" | "unmapped";

function libraryCategory(name: string): ExerciseCategory | null {
  const canonical = canonicalExerciseName(name.trim());
  const aliased = NAME_ALIASES[canonical] ?? NAME_ALIASES[name.trim()] ?? canonical;
  return CATEGORY_BY_NAME.get(aliased.toLowerCase()) ?? null;
}

function mappedRegion(name: string): LiftRegion | null {
  const trimmed = name.trim();
  const canonical = canonicalExerciseName(trimmed);
  return LIFT_REGION_MAP[canonical] ?? LIFT_REGION_MAP[trimmed] ?? null;
}

/** Library category when the exercise is known, otherwise a maintained region. */
export function liftMetadataKind(name: string): LiftMetadataKind {
  const category = libraryCategory(name);
  if (category === "lower") return "lower";
  if (category === "upper_push" || category === "upper_pull") return "upper";
  if (category) return "other";
  return mappedRegion(name) ?? "unmapped";
}

/** Lower or upper lift. Core, conditioning, mobility, bike, and neck work stay null. */
export function liftRegionForExercise(name: string): LiftRegion | null {
  const kind = liftMetadataKind(name);
  return kind === "lower" || kind === "upper" ? kind : null;
}
