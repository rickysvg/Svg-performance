import { bikeWorkSecondsPerSet, isBikeIntervalName } from "@/lib/bike-sessions";
import { isDurationMode, parseDurationSeconds, resolveLogMode } from "@/lib/exercise-log-mode";

export type EquipmentId =
  | "barbell"
  | "bench"
  | "cable"
  | "dumbbell"
  | "machine"
  | "kettlebell"
  | "band"
  | "bodyweight"
  | "pull-up"
  | "jump-rope"
  | "bike"
  | "bag"
  | "pads";

export type EquipmentChip = {
  id: EquipmentId;
  label: string;
};

export const EQUIPMENT_CHIPS: Record<EquipmentId, EquipmentChip> = {
  barbell: { id: "barbell", label: "Barbell" },
  bench: { id: "bench", label: "Bench" },
  cable: { id: "cable", label: "Cable" },
  dumbbell: { id: "dumbbell", label: "Dumbbell" },
  machine: { id: "machine", label: "Machine" },
  kettlebell: { id: "kettlebell", label: "Kettlebell" },
  band: { id: "band", label: "Band" },
  bodyweight: { id: "bodyweight", label: "Bodyweight" },
  "pull-up": { id: "pull-up", label: "Pull-up bar" },
  "jump-rope": { id: "jump-rope", label: "Jump rope" },
  bike: { id: "bike", label: "Bike" },
  bag: { id: "bag", label: "Heavy bag" },
  pads: { id: "pads", label: "Pads" },
};

const STRENGTH_NAME_EQUIPMENT: Record<string, EquipmentId[]> = {
  "Goblet squat": ["dumbbell"],
  "Romanian deadlift": ["dumbbell", "barbell"],
  "Reverse lunge": ["dumbbell"],
  "Squat jump or box step-up": ["bodyweight"],
  "Front plank": ["bodyweight"],
  "Push-up or dumbbell bench press": ["dumbbell", "bench"],
  "One-arm row": ["dumbbell", "bench"],
  "Overhead press": ["barbell", "dumbbell"],
  "Band pull-apart or face pull": ["band", "cable"],
  "Farmer carry": ["dumbbell"],
  "Kettlebell swing or hip hinge": ["kettlebell"],
  "Chin-up, band-assist, or lat pulldown": ["pull-up", "band", "machine"],
  "Lateral bound or side step-over": ["bodyweight"],
  "Jump rope or easy bike intervals": ["jump-rope", "bike"],
  "Assault bike intervals": ["bike"],
  "Side plank": ["bodyweight"],
};

const SKILL_NAME_EQUIPMENT: Record<string, EquipmentId[]> = {
  "Jab–cross (1–2)": ["bag"],
  "Low kick (roundhouse)": ["bag"],
  "Hands to low-kick combo": ["bag"],
  "Teep (push kick)": ["bag"],
  "Double-collar clinch posture": ["bag", "pads"],
  "Straight knee (clinch)": ["bag", "pads"],
  "Alternate knee rhythm": ["bag"],
  "Exit the clinch / frame": ["bodyweight"],
  "Boxing jab": ["bag"],
  "Lead hook": ["bag"],
  "1-2-3 bag rounds": ["bag"],
  "Mount / high-posture hold": ["bodyweight"],
  "Short punch from mount": ["bag"],
  "Hip drive + post": ["bodyweight"],
  "Ground-and-pound burst": ["bag"],
  "Level change (penetration step)": ["bodyweight"],
  "Double-leg entry": ["bodyweight"],
  Sprawl: ["bodyweight"],
  "Shot–sprawl reset": ["bodyweight"],
  "Closed guard posture break": ["bodyweight"],
  "Hip escape (shrimp)": ["bodyweight"],
  "Closed guard hip tilt": ["bodyweight"],
  "Frame and recover": ["bodyweight"],
};

const NAME_EQUIPMENT: Record<string, EquipmentId[]> = {
  ...STRENGTH_NAME_EQUIPMENT,
  ...SKILL_NAME_EQUIPMENT,
};

export function exerciseSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function exerciseThumbSrc(name: string) {
  return `/exercise-thumbs/${exerciseSlug(name)}.svg`;
}

export function fallbackThumbSrc() {
  return "/exercise-thumbs/fallback.svg";
}

export function equipmentForExercise(name: string): EquipmentId[] {
  const exact = NAME_EQUIPMENT[name];
  if (exact) return exact;
  const lower = name.toLowerCase();
  const found: EquipmentId[] = [];
  if (/\bbarbell\b/.test(lower)) found.push("barbell");
  if (/\bbench\b/.test(lower)) found.push("bench");
  if (/\bcable\b|\blat pulldown\b/.test(lower)) found.push("cable");
  if (/\bdumbbell\b/.test(lower)) found.push("dumbbell");
  if (/\bmachine\b/.test(lower)) found.push("machine");
  if (/\bkettlebell\b/.test(lower)) found.push("kettlebell");
  if (/\bband\b/.test(lower)) found.push("band");
  if (/\bpull-?up\b|\bchin-?up\b/.test(lower)) found.push("pull-up");
  if (/\bjump rope\b/.test(lower)) found.push("jump-rope");
  if (/\bbike\b/.test(lower)) found.push("bike");
  if (/\bbag\b/.test(lower)) found.push("bag");
  if (/\bpad\b|\bmitt\b/.test(lower)) found.push("pads");
  if (found.length === 0) found.push("bodyweight");
  return found;
}

export function equipmentForExercises(names: string[]): EquipmentChip[] {
  const seen = new Set<EquipmentId>();
  const chips: EquipmentChip[] = [];
  for (const name of names) {
    for (const id of equipmentForExercise(name)) {
      if (seen.has(id)) continue;
      seen.add(id);
      chips.push(EQUIPMENT_CHIPS[id]);
    }
  }
  return chips;
}

export const DEMO_EXERCISE_NAMES = Object.keys(STRENGTH_NAME_EQUIPMENT);

export { plannedSetLine } from "@/lib/exercise-log-mode";

const WORK_SECONDS_PER_SET = 40;
const TRANSITION_SECONDS = 30;

export function estimateSessionMinutes(
  exercises: Array<{ sets: number; restSeconds: number; reps?: string; logMode?: string; name?: string }>,
) {
  if (exercises.length === 0) return 0;
  const seconds = exercises.reduce((total, exercise) => {
    const sets = Math.max(0, exercise.sets);
    const rest = Math.max(0, exercise.restSeconds);
    const timed = isDurationMode(resolveLogMode(exercise));
    const work = isBikeIntervalName(exercise.name ?? "")
      ? bikeWorkSecondsPerSet()
      : timed
        ? parseDurationSeconds(exercise.reps ?? "") ?? WORK_SECONDS_PER_SET
        : WORK_SECONDS_PER_SET;
    return total + sets * (work + rest) + TRANSITION_SECONDS;
  }, 0);
  return Math.max(1, Math.round(seconds / 60));
}

export function sessionKindLabel(input: { title: string; focus: string }) {
  const text = `${input.title} ${input.focus}`.toLowerCase();
  if (
    /bag|clinch|knee|ground-and-pound|guard|sprawl|shot|jab-cross-hook|martial|skill/.test(
      text,
    )
  ) {
    return "Skill";
  }
  if (/condition|interval|cardio|gas tank|assault bike|air bike/.test(text)) return "Conditioning";
  return "Strength";
}

export function exerciseCountLabel(count: number) {
  return `${count} Exercise${count === 1 ? "" : "s"}`;
}

export function restBannerSeconds(seconds: number) {
  return `${seconds}s`;
}

export function previousSetLabel(input: {
  reps: number | null;
  loadValue: number | null;
  loadUnit: string;
  logMode?: string | null;
  durationSeconds?: number | null;
} | null) {
  if (!input) return "—";
  if (input.durationSeconds != null && input.durationSeconds > 0) {
    if (input.loadValue != null) {
      return `${input.durationSeconds}s × ${input.loadValue}${input.loadUnit}`;
    }
    const label =
      input.logMode === "timed_round"
        ? "round"
        : input.logMode === "load_timed"
          ? "carry"
          : "hold";
    return `${input.durationSeconds}s ${label}`;
  }
  if (input.reps != null && input.loadValue != null) {
    return `${input.reps} × ${input.loadValue}${input.loadUnit}`;
  }
  if (input.reps != null) return `${input.reps} reps`;
  if (input.loadValue != null) return `${input.loadValue}${input.loadUnit}`;
  if (input.logMode === "timed_round") return "Done";
  return "—";
}
