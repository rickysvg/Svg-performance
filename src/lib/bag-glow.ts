import type { BagRegion, BagSide } from "@/lib/bag-body";

/**
 * Backlit halos on the forward-facing athlete cutout (720×1280).
 * Each id is a pre-rendered #CBF805 layer: a blurred, dilated copy of that
 * body region's alpha, drawn behind the cutout so only the rim shows.
 * Anatomical left is the viewer's right (orthodox lead side).
 * Bounds are photo pixels of the masked region.
 */
export const GLOW_COLOR = "#CBF805";

export type BodyGlow = {
  id: string;
  label: string;
  region: BagRegion | null;
  side: "left" | "right" | "mid";
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export function glowSrc(id: string) {
  return `/bagwork/glow/${id}.webp`;
}

export type BodyTap = {
  id: string;
  region: BagRegion;
  side: "left" | "right" | "mid";
  x: number;
  y: number;
  size: number;
};

const SHAPES: readonly BodyGlow[] = [
  { id: "neck", label: "Neck", region: "neck", side: "mid", top: 180, bottom: 259, left: 288, right: 431 },
  { id: "rear-trap", label: "Traps", region: "traps", side: "right", top: 220, bottom: 309, left: 197, right: 345 },
  { id: "lead-trap", label: "Traps", region: "traps", side: "left", top: 220, bottom: 309, left: 375, right: 525 },
  { id: "chest", label: "Chest", region: "chest", side: "mid", top: 300, bottom: 429, left: 288, right: 431 },
  { id: "core", label: "Core", region: "core", side: "mid", top: 420, bottom: 689, left: 202, right: 559 },
  { id: "rear-lat", label: "Lats", region: "lats", side: "right", top: 440, bottom: 599, left: 235, right: 298 },
  { id: "lead-lat", label: "Lats", region: "lats", side: "left", top: 440, bottom: 599, left: 421, right: 479 },
  { id: "rear-arm", label: "Arms", region: "arms", side: "right", top: 241, bottom: 720, left: 157, right: 342 },
  { id: "lead-arm", label: "Arms", region: "arms", side: "left", top: 241, bottom: 704, left: 401, right: 562 },
  { id: "rear-oblique", label: "Obliques", region: "obliques", side: "right", top: 540, bottom: 699, left: 202, right: 290 },
  { id: "lead-oblique", label: "Obliques", region: "obliques", side: "left", top: 540, bottom: 699, left: 426, right: 559 },
  { id: "rear-hip", label: "Hips", region: "hips", side: "right", top: 680, bottom: 829, left: 203, right: 397 },
  { id: "lead-hip", label: "Hips", region: "hips", side: "left", top: 680, bottom: 829, left: 452, right: 529 },
  { id: "rear-flexor", label: "Hip flexors", region: "hip-flexors", side: "right", top: 720, bottom: 879, left: 255, right: 349 },
  { id: "lead-flexor", label: "Hip flexors", region: "hip-flexors", side: "left", top: 720, bottom: 879, left: 362, right: 457 },
  { id: "rear-glute", label: "Glutes", region: "glutes", side: "right", top: 700, bottom: 839, left: 192, right: 262 },
  { id: "lead-glute", label: "Glutes", region: "glutes", side: "left", top: 700, bottom: 839, left: 452, right: 525 },
  { id: "rear-quad", label: "Quads", region: "legs", side: "right", top: 800, bottom: 999, left: 207, right: 312 },
  { id: "lead-quad", label: "Quads", region: "legs", side: "left", top: 800, bottom: 999, left: 400, right: 508 },
  { id: "rear-knee", label: "Knees", region: "knees", side: "right", top: 930, bottom: 1039, left: 207, right: 285 },
  { id: "lead-knee", label: "Knees", region: "knees", side: "left", top: 930, bottom: 1039, left: 430, right: 508 },
  { id: "rear-shin", label: "Shins", region: "shins", side: "right", top: 1000, bottom: 1159, left: 171, right: 269 },
  { id: "lead-shin", label: "Shins", region: "shins", side: "left", top: 1000, bottom: 1159, left: 445, right: 536 },
  { id: "rear-foot", label: "Feet", region: "feet", side: "right", top: 1120, bottom: 1191, left: 159, right: 256 },
  { id: "lead-foot", label: "Feet", region: "feet", side: "left", top: 1120, bottom: 1194, left: 458, right: 547 },
];

const TAPS: readonly BodyTap[] = [
  { id: "neck", region: "neck", side: "mid", x: 50, y: 17, size: 16 },
  { id: "rear-trap", region: "traps", side: "right", x: 42, y: 21, size: 16 },
  { id: "lead-trap", region: "traps", side: "left", x: 58, y: 21, size: 16 },
  { id: "rear-shoulder", region: "shoulders", side: "right", x: 33, y: 23, size: 18 },
  { id: "lead-shoulder", region: "shoulders", side: "left", x: 67, y: 23, size: 18 },
  { id: "chest", region: "chest", side: "mid", x: 50, y: 31, size: 20 },
  { id: "rear-lat", region: "lats", side: "right", x: 42, y: 36, size: 16 },
  { id: "lead-lat", region: "lats", side: "left", x: 58, y: 36, size: 16 },
  { id: "rear-arm", region: "arms", side: "right", x: 28, y: 40, size: 18 },
  { id: "lead-arm", region: "arms", side: "left", x: 73, y: 40, size: 18 },
  { id: "core", region: "core", side: "mid", x: 50, y: 42, size: 22 },
  { id: "rear-oblique", region: "obliques", side: "right", x: 40, y: 48, size: 16 },
  { id: "lead-oblique", region: "obliques", side: "left", x: 60, y: 48, size: 16 },
  { id: "rear-hip", region: "hips", side: "right", x: 40, y: 57, size: 16 },
  { id: "lead-hip", region: "hips", side: "left", x: 60, y: 57, size: 16 },
  { id: "rear-flexor", region: "hip-flexors", side: "right", x: 44, y: 59, size: 14 },
  { id: "lead-flexor", region: "hip-flexors", side: "left", x: 56, y: 59, size: 14 },
  { id: "rear-glute", region: "glutes", side: "right", x: 37, y: 60, size: 16 },
  { id: "lead-glute", region: "glutes", side: "left", x: 63, y: 60, size: 16 },
  { id: "rear-quad", region: "legs", side: "right", x: 36, y: 68, size: 16 },
  { id: "lead-quad", region: "legs", side: "left", x: 65, y: 68, size: 16 },
  { id: "rear-knee", region: "knees", side: "right", x: 34, y: 74, size: 14 },
  { id: "lead-knee", region: "knees", side: "left", x: 65, y: 74, size: 14 },
  { id: "rear-shin", region: "shins", side: "right", x: 33, y: 82, size: 14 },
  { id: "lead-shin", region: "shins", side: "left", x: 67, y: 82, size: 14 },
  { id: "rear-foot", region: "feet", side: "right", x: 29, y: 91, size: 14 },
  { id: "lead-foot", region: "feet", side: "left", x: 69, y: 91, size: 14 },
];

const BY_ID = new Map(SHAPES.map((shape) => [shape.id, shape]));

const REGION_SHAPES: Record<BagRegion, readonly string[]> = {
  neck: ["neck"],
  traps: ["rear-trap", "lead-trap"],
  shoulders: ["rear-arm", "lead-arm"],
  chest: ["chest"],
  arms: ["rear-arm", "lead-arm"],
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

/** Per-workout focus. Each id is a soft rim rendered behind the figure. */
const ROUND_FOCUS: Record<string, readonly string[]> = {
  "all-hooks": ["rear-arm", "lead-arm", "rear-oblique", "lead-oblique", "rear-hip", "lead-hip"],
  "all-overhands": ["rear-arm", "lead-arm", "rear-oblique", "lead-oblique", "rear-hip", "lead-hip"],
  "punch-to-elbow": ["rear-arm", "lead-arm", "rear-oblique", "lead-oblique"],
  "clinch-to-elbow-band": ["rear-arm", "lead-arm", "neck", "rear-lat", "lead-lat"],
  "all-straight-punches": ["lead-arm"],
  "touch-and-rip": ["lead-arm"],
  "boxing-combos": ["lead-arm", "rear-arm"],
  "all-body-shots": ["core", "rear-lat", "lead-lat"],
  "level-change": ["rear-hip", "lead-hip", "rear-quad", "lead-quad"],
  "all-low-kicks": ["rear-hip", "lead-hip", "rear-shin", "lead-shin"],
  "all-body-kicks": ["rear-hip", "lead-hip", "rear-shin", "lead-shin", "rear-oblique", "lead-oblique"],
  "all-head-kicks": ["rear-hip", "lead-hip", "rear-shin", "lead-shin"],
  "punch-to-low-kick": ["lead-arm", "rear-hip", "lead-hip", "rear-shin", "lead-shin"],
  "punch-to-body-kick": ["lead-arm", "rear-hip", "lead-hip", "rear-shin", "lead-shin", "core"],
  "all-teeps": ["lead-flexor", "rear-flexor", "core", "lead-quad"],
  "all-japanese-teeps": ["lead-flexor", "rear-flexor", "rear-hip", "lead-hip", "lead-quad"],
  "all-uppercuts": ["rear-arm", "lead-arm", "core", "rear-quad", "lead-quad"],
  "all-power-punches": ["rear-arm", "lead-arm", "rear-oblique", "lead-oblique", "rear-hip", "lead-hip"],
  "punch-to-knee": ["lead-arm", "rear-hip", "lead-hip", "rear-knee", "lead-knee"],
  "clinch-to-knee": ["neck", "rear-trap", "lead-trap", "rear-lat", "lead-lat", "rear-arm", "lead-arm", "rear-hip", "lead-hip", "rear-knee", "lead-knee"],
  "clinch-to-knee-band": ["neck", "rear-trap", "lead-trap", "rear-lat", "lead-lat", "rear-arm", "lead-arm", "rear-hip", "lead-hip", "rear-knee", "lead-knee"],
  "strike-to-bodylock": ["rear-arm", "lead-arm", "core", "rear-lat", "lead-lat", "rear-hip", "lead-hip"],
  "full-muay-thai": ["lead-arm", "rear-hip", "lead-hip", "lead-shin", "lead-knee", "core"],
  "full-mma": ["lead-arm", "rear-hip", "lead-hip", "rear-quad", "lead-quad", "core"],
  "straight-1-2s-and-teeps": ["lead-arm", "lead-flexor", "lead-quad"],
};

function allows(side: "left" | "right" | "mid", filter: BagSide) {
  if (filter === "both" || side === "mid") return true;
  return side === filter;
}

function shapesFor(ids: readonly string[], side: BagSide) {
  const out: BodyGlow[] = [];
  for (const id of ids) {
    const shape = BY_ID.get(id);
    if (!shape || !allows(shape.side, side) || out.some((item) => item.id === shape.id)) continue;
    out.push(shape);
  }
  return labelForRound(out);
}

function labelForRound(glows: BodyGlow[]) {
  const ids = new Set(glows.map((shape) => shape.id));
  const bothArms = ids.has("lead-arm") && ids.has("rear-arm");
  return glows.map((shape) => {
    if (shape.id === "lead-arm" && !bothArms) return { ...shape, label: "Lead shoulder and arm" };
    return shape;
  });
}

export function focusGlows(
  workoutKey: string | null | undefined,
  regions: readonly BagRegion[],
  side: BagSide = "both",
): BodyGlow[] {
  const recipe = workoutKey && !workoutKey.startsWith("saved:") ? ROUND_FOCUS[workoutKey] : undefined;
  if (recipe) return shapesFor(recipe, side);
  const ids = regions.flatMap((region) => REGION_SHAPES[region] ?? []);
  return shapesFor(ids, side);
}

export function glowCaption(glows: readonly BodyGlow[]) {
  const labels: string[] = [];
  for (const glow of glows) {
    if (!labels.includes(glow.label)) labels.push(glow.label);
  }
  return labels.join(", ");
}

export function regionTapSpots(side: BagSide = "both") {
  return TAPS.filter((spot) => allows(spot.side, side));
}

/** Shoulder-to-hand span. A hook round lights the whole arm, not an elbow dot. */
export function armSpan(glow: BodyGlow) {
  const reach = glow.bottom - glow.top;
  return { top: glow.top, bottom: glow.bottom, points: reach > 360 ? 6 : 2 };
}
