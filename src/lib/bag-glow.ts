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
  { id: "rear-trap", label: "Traps", region: "traps", side: "right", top: 220, bottom: 309, left: 196, right: 345 },
  { id: "lead-trap", label: "Traps", region: "traps", side: "left", top: 220, bottom: 309, left: 372, right: 524 },
  { id: "chest", label: "Chest", region: "chest", side: "mid", top: 300, bottom: 429, left: 288, right: 431 },
  { id: "core", label: "Core", region: "core", side: "mid", top: 420, bottom: 689, left: 200, right: 557 },
  { id: "rear-lat", label: "Lats", region: "lats", side: "right", top: 440, bottom: 599, left: 230, right: 300 },
  { id: "lead-lat", label: "Lats", region: "lats", side: "left", top: 440, bottom: 599, left: 414, right: 482 },
  { id: "rear-arm", label: "Arms", region: "arms", side: "right", top: 242, bottom: 720, left: 156, right: 338 },
  { id: "lead-arm", label: "Arms", region: "arms", side: "left", top: 242, bottom: 705, left: 399, right: 562 },
  { id: "rear-elbow", label: "Elbows", region: null, side: "right", top: 433, bottom: 677, left: 118, right: 267 },
  { id: "lead-elbow", label: "Elbows", region: null, side: "left", top: 433, bottom: 677, left: 452, right: 601 },
  { id: "rear-oblique", label: "Obliques", region: "obliques", side: "right", top: 540, bottom: 699, left: 200, right: 289 },
  { id: "lead-oblique", label: "Obliques", region: "obliques", side: "left", top: 540, bottom: 699, left: 424, right: 557 },
  { id: "rear-hip", label: "Hips", region: "hips", side: "right", top: 680, bottom: 829, left: 201, right: 396 },
  { id: "lead-hip", label: "Hips", region: "hips", side: "left", top: 680, bottom: 829, left: 451, right: 530 },
  { id: "rear-flexor", label: "Hip flexors", region: "hip-flexors", side: "right", top: 720, bottom: 879, left: 255, right: 349 },
  { id: "lead-flexor", label: "Hip flexors", region: "hip-flexors", side: "left", top: 720, bottom: 879, left: 361, right: 455 },
  { id: "rear-glute", label: "Glutes", region: "glutes", side: "right", top: 700, bottom: 839, left: 201, right: 396 },
  { id: "lead-glute", label: "Glutes", region: "glutes", side: "left", top: 700, bottom: 839, left: 451, right: 526 },
  { id: "rear-quad", label: "Quads", region: "legs", side: "right", top: 800, bottom: 999, left: 206, right: 312 },
  { id: "lead-quad", label: "Quads", region: "legs", side: "left", top: 800, bottom: 999, left: 398, right: 507 },
  { id: "rear-knee", label: "Knees", region: "knees", side: "right", top: 930, bottom: 1039, left: 206, right: 284 },
  { id: "lead-knee", label: "Knees", region: "knees", side: "left", top: 930, bottom: 1039, left: 429, right: 507 },
  { id: "rear-shin", label: "Shins", region: "shins", side: "right", top: 1000, bottom: 1159, left: 172, right: 268 },
  { id: "lead-shin", label: "Shins", region: "shins", side: "left", top: 1000, bottom: 1159, left: 443, right: 532 },
  { id: "rear-foot", label: "Feet", region: "feet", side: "right", top: 1120, bottom: 1193, left: 158, right: 255 },
  { id: "lead-foot", label: "Feet", region: "feet", side: "left", top: 1120, bottom: 1195, left: 457, right: 545 },
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

/**
 * Only the surface that hits the bag. Muscle groups (core, hips, lats, obliques)
 * stay off the figure even when a workout lists them as the engine of the shot.
 */
const REGION_SHAPES: Record<BagRegion, readonly string[]> = {
  neck: [],
  traps: [],
  shoulders: ["rear-arm", "lead-arm"],
  chest: [],
  arms: ["rear-arm", "lead-arm"],
  core: [],
  obliques: [],
  lats: [],
  hips: [],
  "hip-flexors": [],
  glutes: [],
  legs: ["rear-shin", "lead-shin"],
  knees: ["rear-knee", "lead-knee"],
  shins: ["rear-shin", "lead-shin"],
  feet: ["rear-foot", "lead-foot"],
};

/** Striking surfaces only. Each id is a soft rim rendered behind the figure. */
const ROUND_FOCUS: Record<string, readonly string[]> = {
  "all-hooks": ["rear-arm", "lead-arm"],
  "all-overhands": ["rear-arm", "lead-arm"],
  "all-uppercuts": ["rear-arm", "lead-arm"],
  "all-power-punches": ["rear-arm", "lead-arm"],
  "all-body-shots": ["rear-arm", "lead-arm"],
  "boxing-combos": ["lead-arm", "rear-arm"],
  "touch-and-rip": ["lead-arm", "rear-arm"],
  "all-straight-punches": ["lead-arm"],
  "level-change": ["lead-arm", "rear-arm"],
  "punch-to-elbow": ["lead-arm", "rear-arm", "lead-elbow", "rear-elbow"],
  "clinch-to-elbow-band": ["lead-elbow", "rear-elbow"],
  "punch-to-knee": ["lead-arm", "rear-arm", "lead-knee", "rear-knee"],
  "clinch-to-knee": ["lead-knee", "rear-knee"],
  "clinch-to-knee-band": ["lead-knee", "rear-knee"],
  "punch-to-low-kick": ["lead-arm", "rear-arm", "lead-shin", "rear-shin"],
  "punch-to-body-kick": ["lead-arm", "rear-arm", "lead-shin", "rear-shin"],
  "all-low-kicks": ["lead-shin", "rear-shin"],
  "all-body-kicks": ["lead-shin", "rear-shin"],
  "all-head-kicks": ["lead-shin", "rear-shin"],
  "all-teeps": ["lead-foot", "rear-foot"],
  "all-japanese-teeps": ["lead-foot", "rear-foot"],
  "straight-1-2s-and-teeps": ["lead-arm", "rear-arm", "lead-foot"],
  "strike-to-bodylock": ["lead-arm", "rear-arm"],
  "full-muay-thai": ["lead-arm", "rear-arm", "lead-elbow", "rear-elbow", "lead-knee", "rear-knee", "lead-shin", "rear-shin"],
  "full-mma": ["lead-arm", "rear-arm", "lead-shin", "rear-shin"],
  "right-side-only": ["rear-arm"],
  "left-side-only": ["lead-arm"],
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
    if (shape.id === "lead-arm" && !bothArms) return { ...shape, label: "Lead arm" };
    if (shape.id === "rear-arm" && !bothArms) return { ...shape, label: "Rear arm" };
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
