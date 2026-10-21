import type { BagRegion, BagSide } from "@/lib/bag-body";

/**
 * Glow anchors on the forward-facing athlete photo (720×1280).
 * x/y are percentages. Anatomical left is the viewer's right (orthodox lead side).
 */
export type BodyGlow = {
  id: string;
  label: string;
  region: BagRegion | null;
  side: "left" | "right" | "mid";
  x: number;
  y: number;
  size: number;
};

const SPOTS: readonly BodyGlow[] = [
  { id: "neck", label: "Neck", region: "neck", side: "mid", x: 50, y: 17, size: 16 },
  { id: "rear-trap", label: "Traps", region: "traps", side: "right", x: 42, y: 21, size: 16 },
  { id: "lead-trap", label: "Traps", region: "traps", side: "left", x: 58, y: 21, size: 16 },
  { id: "rear-shoulder", label: "Shoulders", region: "shoulders", side: "right", x: 33, y: 23, size: 22 },
  { id: "lead-shoulder", label: "Shoulders", region: "shoulders", side: "left", x: 66, y: 23, size: 24 },
  { id: "chest", label: "Chest", region: "chest", side: "mid", x: 50, y: 31, size: 26 },
  { id: "rear-lat", label: "Lats", region: "lats", side: "right", x: 40, y: 36, size: 24 },
  { id: "lead-lat", label: "Lats", region: "lats", side: "left", x: 60, y: 36, size: 24 },
  { id: "rear-arm", label: "Arms", region: "arms", side: "right", x: 31, y: 31, size: 18 },
  { id: "lead-arm", label: "Arms", region: "arms", side: "left", x: 70, y: 31, size: 20 },
  { id: "rear-elbow", label: "Elbows", region: null, side: "right", x: 27.5, y: 36, size: 26 },
  { id: "lead-elbow", label: "Elbows", region: null, side: "left", x: 73.5, y: 36, size: 26 },
  { id: "core", label: "Core", region: "core", side: "mid", x: 50, y: 42, size: 34 },
  { id: "rear-oblique", label: "Obliques", region: "obliques", side: "right", x: 40, y: 48, size: 22 },
  { id: "lead-oblique", label: "Obliques", region: "obliques", side: "left", x: 60, y: 48, size: 22 },
  { id: "rear-hip", label: "Hips", region: "hips", side: "right", x: 40, y: 57, size: 22 },
  { id: "lead-hip", label: "Hips", region: "hips", side: "left", x: 60, y: 57, size: 22 },
  { id: "rear-flexor", label: "Hip flexors", region: "hip-flexors", side: "right", x: 44, y: 59, size: 18 },
  { id: "lead-flexor", label: "Hip flexors", region: "hip-flexors", side: "left", x: 56, y: 59, size: 18 },
  { id: "rear-glute", label: "Glutes", region: "glutes", side: "right", x: 37, y: 60, size: 20 },
  { id: "lead-glute", label: "Glutes", region: "glutes", side: "left", x: 63, y: 60, size: 20 },
  { id: "rear-quad", label: "Quads", region: "legs", side: "right", x: 36, y: 66, size: 24 },
  { id: "lead-quad", label: "Quads", region: "legs", side: "left", x: 65, y: 66, size: 24 },
  { id: "rear-knee", label: "Knees", region: "knees", side: "right", x: 34, y: 74, size: 16 },
  { id: "lead-knee", label: "Knees", region: "knees", side: "left", x: 65, y: 74, size: 16 },
  { id: "rear-shin", label: "Shins", region: "shins", side: "right", x: 33, y: 82, size: 16 },
  { id: "lead-shin", label: "Shins", region: "shins", side: "left", x: 67, y: 82, size: 16 },
  { id: "rear-foot", label: "Feet", region: "feet", side: "right", x: 29, y: 91, size: 16 },
  { id: "lead-foot", label: "Feet", region: "feet", side: "left", x: 69, y: 91, size: 16 },
];

const BY_ID = new Map(SPOTS.map((spot) => [spot.id, spot]));

const REGION_SPOTS: Record<BagRegion, readonly string[]> = {
  neck: ["neck"],
  traps: ["rear-trap", "lead-trap"],
  shoulders: ["rear-shoulder", "lead-shoulder"],
  chest: ["chest"],
  arms: ["rear-arm", "lead-arm", "rear-elbow", "lead-elbow"],
  core: ["core"],
  obliques: ["rear-oblique", "lead-oblique"],
  lats: ["rear-lat", "lead-lat"],
  hips: ["rear-hip", "lead-hip"],
  "hip-flexors": ["rear-flexor", "lead-flexor"],
  glutes: ["rear-glute", "lead-glute"],
  legs: ["rear-quad", "lead-quad"],
  knees: ["rear-knee", "lead-knee"],
  shins: ["rear-shin", "lead-shin"],
  feet: ["rear-foot", "lead-foot"],
};

/** Per-workout focus. These override the stored regions so the glow matches the round. */
const ROUND_FOCUS: Record<string, readonly string[]> = {
  "all-hooks": ["rear-elbow", "lead-elbow", "rear-shoulder", "lead-shoulder", "rear-oblique", "lead-oblique", "rear-hip", "lead-hip"],
  "all-overhands": ["rear-elbow", "lead-elbow", "rear-shoulder", "lead-shoulder", "rear-oblique", "lead-oblique", "rear-hip", "lead-hip"],
  "punch-to-elbow": ["rear-elbow", "lead-elbow", "rear-shoulder", "lead-shoulder", "rear-oblique", "lead-oblique"],
  "clinch-to-elbow-band": ["rear-elbow", "lead-elbow", "rear-shoulder", "lead-shoulder", "neck", "rear-lat", "lead-lat"],
  "all-straight-punches": ["lead-shoulder", "lead-arm", "lead-elbow"],
  "touch-and-rip": ["lead-shoulder", "lead-arm", "lead-elbow"],
  "boxing-combos": ["lead-shoulder", "lead-arm", "lead-elbow", "rear-shoulder", "rear-arm"],
  "all-body-shots": ["core", "rear-lat", "lead-lat"],
  "level-change": ["rear-hip", "lead-hip", "rear-quad", "lead-quad"],
  "all-low-kicks": ["rear-hip", "lead-hip", "rear-shin", "lead-shin"],
  "all-body-kicks": ["rear-hip", "lead-hip", "rear-shin", "lead-shin", "rear-oblique", "lead-oblique"],
  "all-head-kicks": ["rear-hip", "lead-hip", "rear-shin", "lead-shin"],
  "punch-to-low-kick": ["lead-shoulder", "lead-arm", "rear-hip", "lead-hip", "rear-shin", "lead-shin"],
  "punch-to-body-kick": ["lead-arm", "lead-shoulder", "rear-hip", "lead-hip", "rear-shin", "lead-shin", "core"],
  "all-teeps": ["lead-flexor", "rear-flexor", "core", "lead-quad"],
  "all-japanese-teeps": ["lead-flexor", "rear-flexor", "rear-hip", "lead-hip", "lead-quad"],
  "all-uppercuts": ["rear-shoulder", "lead-shoulder", "rear-arm", "lead-arm", "core", "rear-quad", "lead-quad"],
  "all-power-punches": ["rear-shoulder", "lead-shoulder", "rear-oblique", "lead-oblique", "rear-hip", "lead-hip"],
  "punch-to-knee": ["lead-shoulder", "lead-arm", "rear-hip", "lead-hip", "rear-knee", "lead-knee"],
  "clinch-to-knee": ["neck", "rear-trap", "lead-trap", "rear-lat", "lead-lat", "rear-arm", "lead-arm", "rear-hip", "lead-hip", "rear-knee", "lead-knee"],
  "clinch-to-knee-band": ["neck", "rear-trap", "lead-trap", "rear-lat", "lead-lat", "rear-arm", "lead-arm", "rear-hip", "lead-hip", "rear-knee", "lead-knee"],
  "strike-to-bodylock": ["rear-arm", "lead-arm", "core", "rear-lat", "lead-lat", "rear-hip", "lead-hip"],
  "full-muay-thai": ["lead-shoulder", "lead-elbow", "rear-hip", "lead-hip", "lead-shin", "lead-knee", "core"],
  "full-mma": ["lead-shoulder", "lead-arm", "rear-hip", "lead-hip", "rear-quad", "lead-quad", "core"],
  "straight-1-2s-and-teeps": ["lead-shoulder", "lead-arm", "lead-flexor", "lead-quad"],
};

function allows(spot: BodyGlow, side: BagSide) {
  if (side === "both" || spot.side === "mid") return true;
  return spot.side === side;
}

function spotsFor(ids: readonly string[], side: BagSide) {
  const out: BodyGlow[] = [];
  for (const id of ids) {
    const spot = BY_ID.get(id);
    if (!spot || !allows(spot, side) || out.some((item) => item.id === spot.id)) continue;
    out.push(spot);
  }
  return labelForRound(out);
}

function labelForRound(glows: BodyGlow[]) {
  const ids = new Set(glows.map((spot) => spot.id));
  const bothShoulders = ids.has("lead-shoulder") && ids.has("rear-shoulder");
  const bothElbows = ids.has("lead-elbow") && ids.has("rear-elbow");
  const bothArms = ids.has("lead-arm") && ids.has("rear-arm");
  return glows.map((spot) => {
    if (spot.id === "lead-shoulder" && !bothShoulders) return { ...spot, label: "Lead shoulder" };
    if (spot.id === "lead-arm" && !bothArms) return { ...spot, label: "Lead arm" };
    if (spot.id === "lead-elbow" && !bothElbows) return { ...spot, label: "Lead arm" };
    return spot;
  });
}

export function focusGlows(
  workoutKey: string | null | undefined,
  regions: readonly BagRegion[],
  side: BagSide = "both",
): BodyGlow[] {
  const recipe = workoutKey && !workoutKey.startsWith("saved:") ? ROUND_FOCUS[workoutKey] : undefined;
  if (recipe) return spotsFor(recipe, side);
  const ids = regions.flatMap((region) => REGION_SPOTS[region] ?? []);
  return spotsFor(ids, side);
}

export function glowCaption(glows: readonly BodyGlow[]) {
  const labels: string[] = [];
  for (const glow of glows) {
    if (!labels.includes(glow.label)) labels.push(glow.label);
  }
  return labels.join(", ");
}

export function regionTapSpots(side: BagSide = "both") {
  return SPOTS.filter((spot) => spot.region && allows(spot, side));
}
