import type { BagRegion, BagSide } from "@/lib/bag-body";

/**
 * Backlit halos on the forward-facing athlete cutout (720×1280).
 * Points are photo pixels. The stroke sits behind the silhouette, so the
 * body covers the middle and the neon reads as a rim.
 * Anatomical left is the viewer's right (orthodox lead side).
 */
export type BodyGlow = {
  id: string;
  label: string;
  region: BagRegion | null;
  side: "left" | "right" | "mid";
  points: readonly (readonly [number, number])[];
  width: number;
};

export type BodyTap = {
  id: string;
  region: BagRegion;
  side: "left" | "right" | "mid";
  x: number;
  y: number;
  size: number;
};

const SHAPES: readonly BodyGlow[] = [
  { id: "neck", label: "Neck", region: "neck", side: "mid", width: 54, points: [[360, 200], [360, 250]] },
  { id: "rear-trap", label: "Traps", region: "traps", side: "right", width: 50, points: [[300, 250], [330, 290]] },
  { id: "lead-trap", label: "Traps", region: "traps", side: "left", width: 50, points: [[420, 250], [390, 290]] },
  { id: "chest", label: "Chest", region: "chest", side: "mid", width: 120, points: [[360, 340], [360, 430]] },
  { id: "core", label: "Core", region: "core", side: "mid", width: 130, points: [[360, 430], [360, 620]] },
  { id: "rear-lat", label: "Lats", region: "lats", side: "right", width: 72, points: [[300, 440], [312, 580]] },
  { id: "lead-lat", label: "Lats", region: "lats", side: "left", width: 72, points: [[420, 440], [408, 580]] },
  {
    id: "rear-arm",
    label: "Arms",
    region: "arms",
    side: "right",
    width: 100,
    points: [[238, 294], [209, 384], [194, 461], [185, 538], [179, 614], [184, 670]],
  },
  {
    id: "lead-arm",
    label: "Arms",
    region: "arms",
    side: "left",
    width: 100,
    points: [[482, 294], [512, 384], [529, 461], [540, 538], [540, 614], [526, 670]],
  },
  { id: "rear-oblique", label: "Obliques", region: "obliques", side: "right", width: 70, points: [[292, 560], [304, 680]] },
  { id: "lead-oblique", label: "Obliques", region: "obliques", side: "left", width: 70, points: [[428, 560], [416, 680]] },
  { id: "rear-hip", label: "Hips", region: "hips", side: "right", width: 78, points: [[276, 700], [292, 790]] },
  { id: "lead-hip", label: "Hips", region: "hips", side: "left", width: 78, points: [[444, 700], [428, 790]] },
  { id: "rear-flexor", label: "Hip flexors", region: "hip-flexors", side: "right", width: 56, points: [[320, 720], [330, 800]] },
  { id: "lead-flexor", label: "Hip flexors", region: "hip-flexors", side: "left", width: 56, points: [[400, 720], [390, 800]] },
  { id: "rear-glute", label: "Glutes", region: "glutes", side: "right", width: 70, points: [[270, 740], [290, 820]] },
  { id: "lead-glute", label: "Glutes", region: "glutes", side: "left", width: 70, points: [[450, 740], [430, 820]] },
  { id: "rear-quad", label: "Quads", region: "legs", side: "right", width: 72, points: [[268, 830], [250, 960]] },
  { id: "lead-quad", label: "Quads", region: "legs", side: "left", width: 72, points: [[460, 830], [478, 960]] },
  { id: "rear-knee", label: "Knees", region: "knees", side: "right", width: 52, points: [[248, 940], [244, 1000]] },
  { id: "lead-knee", label: "Knees", region: "knees", side: "left", width: 52, points: [[470, 940], [478, 1000]] },
  { id: "rear-shin", label: "Shins", region: "shins", side: "right", width: 48, points: [[240, 1000], [230, 1120]] },
  { id: "lead-shin", label: "Shins", region: "shins", side: "left", width: 48, points: [[480, 1000], [492, 1120]] },
  { id: "rear-foot", label: "Feet", region: "feet", side: "right", width: 56, points: [[210, 1140], [230, 1180]] },
  { id: "lead-foot", label: "Feet", region: "feet", side: "left", width: 56, points: [[500, 1140], [530, 1180]] },
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

/** Per-workout focus. Strokes run the length of the area and render behind the figure. */
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
  const ys = glow.points.map((point) => point[1]);
  return { top: Math.min(...ys), bottom: Math.max(...ys), points: glow.points.length };
}
