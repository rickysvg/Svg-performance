/**
 * Research Rae's combat swap library (Oct 2026).
 * 203 exercises. Member swaps hide low-confidence clips and long clips that
 * do not already start on the form. The admin Content queue still lists both.
 */
import raw from "@/data/combat-exercise-library.json";
import type { ExerciseCategory, EquipmentAccess, LibraryExercise } from "@/lib/exercise-library";
import type { LogMode } from "@/lib/exercise-log-mode";

export type CombatConfidence = "high" | "medium" | "low";

export type CombatExercise = {
  id: string;
  family: string;
  appCategory: ExerciseCategory;
  name: string;
  equipment: string;
  level: "beginner" | "intermediate" | "advanced";
  benefit: string;
  swapsWith: string[];
  prescription: string;
  cues: string[];
  videoUrl: string;
  videoStart: number;
  videoEnd: number | null;
  durationSec: number;
  channel: string;
  confidence: CombatConfidence;
  videoTitle: string;
};

const CATEGORIES = new Set<ExerciseCategory>([
  "lower",
  "upper_push",
  "upper_pull",
  "rotational",
  "explosive",
  "core",
  "conditioning",
  "mobility",
]);

const LEVELS = new Set<CombatExercise["level"]>(["beginner", "intermediate", "advanced"]);
const CONFIDENCE = new Set<CombatConfidence>(["high", "medium", "low"]);

function asCombat(row: (typeof raw)[number]): CombatExercise {
  const category = CATEGORIES.has(row.appCategory as ExerciseCategory)
    ? (row.appCategory as ExerciseCategory)
    : "conditioning";
  const level = LEVELS.has(row.level as CombatExercise["level"])
    ? (row.level as CombatExercise["level"])
    : "intermediate";
  const confidence = CONFIDENCE.has(row.confidence as CombatConfidence)
    ? (row.confidence as CombatConfidence)
    : "medium";
  return {
    id: row.id,
    family: row.family,
    appCategory: category,
    name: row.name,
    equipment: row.equipment,
    level,
    benefit: row.benefit,
    swapsWith: row.swapsWith,
    prescription: row.prescription,
    cues: row.cues,
    videoUrl: row.videoUrl,
    videoStart: row.videoStart ?? 0,
    videoEnd: row.videoEnd,
    durationSec: row.durationSec,
    channel: row.channel,
    confidence,
    videoTitle: row.videoTitle,
  };
}

export const COMBAT_LIBRARY: CombatExercise[] = raw.map(asCombat);

/** Over 60s and no end trim. A start time alone is not a finished trim. */
export function needsTrim(row: CombatExercise) {
  return row.durationSec > 60 && row.videoEnd == null;
}

export function needsReview(row: CombatExercise) {
  return row.confidence === "low";
}

/**
 * The clip opens on the movement when a researcher set videoStart, or when the
 * whole clip is already a short form demo (60s or under).
 */
export function startsAtForm(row: CombatExercise) {
  if (row.videoStart > 0) return true;
  return row.durationSec <= 60;
}

/** Hidden from the member swap picker until a human clears the flag. */
export function memberSwappable(row: CombatExercise) {
  if (needsReview(row)) return false;
  if (needsTrim(row) && !startsAtForm(row)) return false;
  return true;
}

export function libraryReviewQueue() {
  const review = COMBAT_LIBRARY.filter(needsReview);
  const trim = COMBAT_LIBRARY.filter(needsTrim);
  const held = COMBAT_LIBRARY.filter((row) => !memberSwappable(row));
  const live = COMBAT_LIBRARY.filter(memberSwappable);
  return {
    total: COMBAT_LIBRARY.length,
    live: live.length,
    held: held.length,
    needsReview: review,
    needsTrim: trim,
    /** One row per exercise that still needs a human, even if it has both flags. */
    queueCount: COMBAT_LIBRARY.filter((row) => needsReview(row) || needsTrim(row)).length,
  };
}

export function combatByName(name: string) {
  return COMBAT_LIBRARY.find((row) => row.name === name) ?? null;
}

/** Long clips used in the template. t=0 marks that the demo is the whole file until a human trims it. */
const TEMPLATE_LONG_NAMES = new Set(["Zercher squat", "Pull-up"]);

export function combatWatchUrl(row: CombatExercise, forceStart = false) {
  const url = new URL(row.videoUrl);
  const start = forceStart ? 0 : row.videoStart;
  if (start > 0 || forceStart) url.searchParams.set("t", String(start));
  if (row.videoEnd != null) url.searchParams.set("end", String(row.videoEnd));
  return url.toString();
}

export type CombatFormSeed = {
  url: string;
  pending: boolean;
  channel: string;
  title: string;
  seconds: number;
};

/** Form clips safe to embed, plus the two long template lifts marked t=0. */
export function combatFormVideoSeeds(): Record<string, CombatFormSeed> {
  const seeds: Record<string, CombatFormSeed> = {};
  for (const row of COMBAT_LIBRARY) {
    const forced = TEMPLATE_LONG_NAMES.has(row.name);
    if (!memberSwappable(row) && !forced) continue;
    const seconds = row.videoEnd != null && row.videoStart >= 0 ? row.videoEnd - row.videoStart : row.durationSec;
    seeds[row.name] = {
      url: combatWatchUrl(row, forced && row.videoStart <= 0),
      pending: false,
      channel: row.channel,
      title: row.videoTitle,
      seconds: Math.max(1, seconds),
    };
  }
  return seeds;
}

function parsePrescription(text: string) {
  const sets = Number(text.match(/^(\d+)\s*x/i)?.[1] ?? 3);
  const reps = (text.match(/x\s*([^@,]+)/i)?.[1] ?? "8").trim().replace(/(\d+)\s*\/\s*/g, "$1 / ");
  const rir = text.match(/(\d+\s*-\s*\d+|\d+)\s*RIR/i)?.[1]?.replace(/\s+/g, "");
  const rest = Number(text.match(/(\d+)\s*s\b/i)?.[1] ?? 60);
  return { sets: Number.isFinite(sets) ? sets : 3, reps, rir, restSeconds: Number.isFinite(rest) ? rest : 60 };
}

function equipmentAccess(equipment: string): EquipmentAccess {
  const text = equipment.toLowerCase();
  if (text === "bodyweight" || text.startsWith("bodyweight")) return "both";
  return "gym";
}

function logModeFor(row: CombatExercise, reps: string): LogMode {
  if (/\b(sec|min|climb|hold)\b/i.test(reps) || /\bhold\b/i.test(row.name)) {
    if (/\b(carry|farmer|suitcase|yoke|sandbag)\b/i.test(row.name)) return "load_timed";
    return "timed";
  }
  if (equipmentAccess(row.equipment) === "both" && !/\b(dumbbell|barbell|kettlebell|cable|sandbag|band)\b/i.test(row.equipment)) {
    return "reps_only";
  }
  return "load_reps";
}

export function combatAsLibraryRows(): Array<LibraryExercise & { memberHidden?: boolean; swapsWith?: string[] }> {
  return COMBAT_LIBRARY.map((row) => {
    const dose = parsePrescription(row.prescription);
    const intent = row.cues[0] ?? row.benefit;
    const loadText = dose.rir
      ? `${dose.rir} RIR · ${intent}`
      : intent;
    return {
      name: row.name,
      category: row.appCategory,
      equipment: equipmentAccess(row.equipment),
      sets: dose.sets,
      reps: dose.reps,
      loadText,
      restSeconds: dose.restSeconds,
      logMode: logModeFor(row, dose.reps),
      notes: `Intent: ${intent}. ${row.benefit}`,
      memberHidden: !memberSwappable(row),
      swapsWith: row.swapsWith,
    };
  });
}
