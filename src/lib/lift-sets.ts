/**
 * Set ceilings for SVG lift prescriptions.
 * Main lifts stay at 4. Accessories stay at 3, and a written 2 stays 2.
 * Bag rounds, shadowboxing, and conditioning intervals are not lift sets.
 */

export type LiftSetBand = "beginner" | "intermediate" | "advanced";

const MAIN_LIFT_NAME =
  /^(?:trap-bar deadlift|goblet squat|pause goblet squat|pause air squat|romanian deadlift|dumbbell romanian deadlift|dumbbell bench press|overhead press|single-arm overhead press|one-arm row|chest-supported dumbbell row|half-kneeling one-arm row|lat pulldown|chin-up|floor press|kettlebell swing|pause push-up)$/i;

/** Primary work only when the written count is already 4. A 3-set version stays an accessory. */
const MAIN_WHEN_FOUR =
  /^(?:single-leg rdl|hip hinge|walking lunge|air squat|push-up|prone scap squeeze)$/i;

const CONDITIONING_INTERVAL =
  /\b(?:jump rope|easy bike|intervals?|sled push|sled hamstring|banded kettlebell swing)\b|\bbike\b/i;

export function isConditioningIntervalName(name: string) {
  return CONDITIONING_INTERVAL.test(name);
}

export function isMainLift(input: {
  name: string;
  sets: number;
  notes?: string | null;
  loadText?: string | null;
}) {
  const text = `${input.notes ?? ""} ${input.loadText ?? ""}`;
  // A 3-set row labeled secondary stays an accessory. A 4-set compound does not.
  if (input.sets < 4 && /\bsecondary\b/i.test(text)) return false;
  if (MAIN_LIFT_NAME.test(input.name.trim())) return true;
  if (/\bmain (?:lift|press|pull|squat|hinge|unilateral)\b/i.test(text)) return true;
  return input.sets >= 4 && MAIN_WHEN_FOUR.test(input.name.trim());
}

/** Clamp a count using the original exercise to decide main vs accessory. */
export function capPrescribedSets(
  exercise: {
    name: string;
    sets: number;
    notes?: string | null;
    loadText?: string | null;
  },
  sets: number,
) {
  if (isConditioningIntervalName(exercise.name)) return sets;
  if (isMainLift(exercise)) return Math.min(4, sets);
  if (exercise.sets <= 2) return exercise.sets;
  return Math.min(3, sets);
}

/** Clamp a written count. Does not add a set. */
export function clampLiftSets(input: {
  name: string;
  sets: number;
  notes?: string | null;
  loadText?: string | null;
}) {
  return capPrescribedSets(input, input.sets);
}

/**
 * Level scaling for a stored lift. Mains may gain one set, never past 4.
 * Accessories do not gain a set.
 */
export function scaleLiftSets(
  input: {
    name: string;
    sets: number;
    notes?: string | null;
    loadText?: string | null;
  },
  band: LiftSetBand,
) {
  if (isConditioningIntervalName(input.name)) return input.sets;
  if (!isMainLift(input)) return capPrescribedSets(input, input.sets);
  if (band === "beginner") return Math.min(4, input.sets);
  return capPrescribedSets(input, input.sets + 1);
}
