/**
 * Strength prescriptions.
 * Main lifts stop at 4 sets. Accessories stop at 3.
 * A move already written for 2 sets (or 1) stays there.
 * Bag rounds, shadowboxing, and conditioning intervals are not lifts.
 */

export const MAIN_LIFT_MAX_SETS = 4;
export const ACCESSORY_MAX_SETS = 3;

export type SetRole = "main" | "accessory" | "conditioning";

const CONDITIONING_INTERVAL_NAME =
  /\b(jump rope|assault bike|tempo bike|endurance bike|cardiac output|sled push|sled hamstring|banded kettlebell swing)\b|\bintervals?\b/i;

/** Compounds that stay main lifts even when the stored line has no RIR yet. */
const PRIMARY_MAIN_LIFT =
  /^(?:trap-bar deadlift|goblet squat|pause goblet squat|romanian deadlift|dumbbell romanian deadlift|dumbbell bench press|overhead press|single-arm overhead press|one-arm row|chest-supported dumbbell row|half-kneeling one-arm row|lat pulldown|chin-up|floor press|kettlebell swing)$/i;

export function isConditioningIntervalName(name: string, reps = "") {
  if (/\bbanded kettlebell swing\b/i.test(name)) return true;
  if (/\bkettlebell swing\b/i.test(name)) return false;
  if (/\bburpees?\b/i.test(name) && /\bsec\b/i.test(reps)) return true;
  return CONDITIONING_INTERVAL_NAME.test(name);
}

export function exerciseSetRole(input: {
  name: string;
  loadText?: string | null;
  notes?: string | null;
  reps?: string | null;
  role?: SetRole | null;
}): SetRole {
  if (input.role === "main" || input.role === "accessory" || input.role === "conditioning") {
    return input.role;
  }
  if (isConditioningIntervalName(input.name, input.reps ?? "")) return "conditioning";
  const blob = `${input.notes ?? ""} ${input.loadText ?? ""}`;
  if (/main (?:lift|press|pull|squat|hinge)/i.test(blob)) return "main";
  if (PRIMARY_MAIN_LIFT.test(input.name.trim())) return "main";
  const rir = blob.match(/\b(\d)\s*-\s*(\d)\s*RIR\b/i);
  if (rir && (rir[1] === "0" || (rir[1] === "1" && rir[2] === "3"))) return "main";
  return "accessory";
}

/** Cap a lift. Conditioning intervals pass through. Two-set accessories stay at 2. */
export function capSetsForRole(role: SetRole, sets: number) {
  if (role === "conditioning") return sets;
  const safe = Number.isFinite(sets) ? Math.round(sets) : 0;
  if (safe <= 0) return 0;
  if (role === "accessory" && safe <= 2) return safe;
  const cap = role === "main" ? MAIN_LIFT_MAX_SETS : ACCESSORY_MAX_SETS;
  return Math.min(cap, safe);
}
