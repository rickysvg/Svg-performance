import raw from "@/data/fighter-exercises.json";
import type { ExerciseCategory, EquipmentAccess, LibraryExercise } from "@/lib/exercise-library";
import type { LogMode } from "@/lib/exercise-log-mode";
import type { FormVideoSeed } from "@/lib/form-videos";
import { clampSetRestSeconds } from "@/lib/set-rest";

export type FighterExercise = {
  name: string;
  category: ExerciseCategory;
  equipment: EquipmentAccess;
  region: string;
  pattern: string;
  gear: string;
  sets: number;
  reps: string;
  loadText: string;
  restSeconds: number;
  logMode: LogMode;
  notes: string;
  videoId: string;
  /** Seconds into the upload where the form demo starts. Zero when the clip opens on the movement. */
  startSeconds: number;
  seconds: number;
  channel: string;
  videoTitle: string;
};

const ROWS = raw as FighterExercise[];

export function fighterExercises() {
  return ROWS;
}

const MOBILITY_FIGURE: Record<string, string> = {
  "hip-opener": "hip-cars",
  thoracic: "child",
  "shoulder-stretch": "shoulder-cars",
  neck: "neck-flex",
  breathing: "child",
  "hamstring-floss": "half-split",
  "ankle-rock": "ankle-cars",
};

export function fighterAsLibraryRows(): LibraryExercise[] {
  return ROWS.map((row) => ({
    name: row.name,
    category: row.category,
    equipment: row.equipment,
    region: row.region,
    pattern: row.pattern,
    gear: row.gear,
    sets: row.sets,
    reps: row.reps,
    loadText: row.loadText,
    restSeconds: clampSetRestSeconds(row.restSeconds),
    logMode: row.logMode,
    notes: row.notes,
    figureKey: row.category === "mobility" ? (MOBILITY_FIGURE[row.pattern] ?? "hip-cars") : undefined,
  }));
}

export function fighterFormVideoSeeds(): Record<string, FormVideoSeed> {
  const seeds: Record<string, FormVideoSeed> = {};
  for (const row of ROWS) {
    if (!row.videoId || !row.videoTitle) continue;
    const start = Number.isFinite(row.startSeconds) ? Math.max(0, Math.round(row.startSeconds)) : 0;
    const window = Math.max(1, row.seconds);
    const url =
      start > 0
        ? `https://www.youtube.com/watch?v=${row.videoId}&t=${start}&end=${start + window}`
        : `https://www.youtube.com/watch?v=${row.videoId}`;
    seeds[row.name] = {
      url,
      pending: false,
      channel: row.channel,
      title: row.videoTitle,
      seconds: window,
    };
  }
  return seeds;
}
