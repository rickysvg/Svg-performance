import {
  BAG_REGIONS,
  formatBagRegions,
  parseBagRegions,
  partIsLit,
  type BagRegion,
  type BagSide,
  type FigurePart,
} from "@/lib/bag-body";
import { clampDurationSeconds, clampRounds, type TimerConfig } from "@/lib/round-timer";

export { BAG_REGIONS, formatBagRegions, parseBagRegions, partIsLit };
export type { BagRegion, BagSide };

export const BAGWORK_PRESCRIPTION = "bagwork";

/** Unrated bagwork still counts. 5 is a moderate round, not a max. */
export const BAGWORK_DEFAULT_RPE = 5;

export type BagWorkout = {
  slug: string;
  name: string;
  recommendation: string;
  cues: readonly string[];
  regions: readonly BagRegion[];
  side: BagSide;
  /** Prefill only. The member sets the real rounds, length, and rest. */
  suggested: TimerConfig;
};

const standard = (rounds = 4): TimerConfig => ({
  rounds,
  workSeconds: 180,
  restSeconds: 60,
});

function workout(
  slug: string,
  name: string,
  recommendation: string,
  cues: readonly string[],
  regions: readonly BagRegion[],
  suggested: TimerConfig = standard(),
  side: BagSide = "both",
): BagWorkout {
  return { slug, name, recommendation, cues, regions, side, suggested };
}

export const BAG_WORKOUTS: readonly BagWorkout[] = [
  workout(
    "boxing-combos",
    "Boxing combos",
    "Recommended: 3-6 rounds x 3 min, 1 min rest",
    [
      "Chin tucked, hands home after every punch.",
      "Snap the shot and bring it back. Do not arm-punch.",
      "Mix levels so the bag does not settle.",
      "Step with the punch, then get back to your stance.",
    ],
    ["shoulders", "arms", "core", "hips", "feet"],
  ),
  workout(
    "touch-and-rip",
    "Touch and rip drill",
    "Recommended: 4-8 rounds x 2 min, 30-45 sec rest",
    [
      "Touch to measure distance, then rip the power shot.",
      "The touch is a light lead, not a pause.",
      "Stay long on the touch and short on the rip.",
      "Reset your feet before the next touch.",
    ],
    ["shoulders", "arms", "core", "hips"],
    { rounds: 6, workSeconds: 120, restSeconds: 45 },
  ),
  workout(
    "all-power-punches",
    "All power punches",
    "Recommended: 3-5 rounds x 3 min, 1 min rest",
    [
      "Sit into the hip before the punch.",
      "Exhale on the impact.",
      "Do not chase power with the arm.",
      "Finish balanced, ready for the next shot.",
    ],
    ["shoulders", "obliques", "core", "hips", "feet"],
    standard(4),
  ),
  workout(
    "punch-to-knee",
    "Punch to knee combos",
    "Recommended: 3-6 rounds x 3 min, 1 min rest",
    [
      "Punch to close the distance, then drive the knee.",
      "The knee comes from the hip, not a flick.",
      "Hands stay up as the knee returns.",
      "Land, step off, and rebuild the stance.",
    ],
    ["shoulders", "arms", "core", "hips", "knees"],
  ),
  workout(
    "punch-to-elbow",
    "Punch to elbow combos",
    "Recommended: 3-6 rounds x 3 min, 1 min rest",
    [
      "Enter on the punches, then turn the elbow from the shoulder.",
      "Keep the elbow tight to the line of the body.",
      "Chin stays down through the turn.",
      "Exit after the elbow. Do not hang.",
    ],
    ["shoulders", "arms", "core", "obliques"],
  ),
  workout(
    "punch-to-low-kick",
    "Punch to low kick combos",
    "Recommended: 3-6 rounds x 3 min, 1 min rest",
    [
      "Punch to hide the kick.",
      "Turn the hip over and strike with the shin.",
      "The base foot pivots.",
      "Hands stay up while the kicking leg recovers.",
    ],
    ["shoulders", "arms", "hips", "core", "shins", "legs", "feet"],
  ),
  workout(
    "punch-to-body-kick",
    "Punch to body kick combos",
    "Recommended: 3-6 rounds x 3 min, 1 min rest",
    [
      "Punch first so the kick is the finish.",
      "Turn the hip and hit with the shin through the bag.",
      "Spot the target, then recover the leg fast.",
      "Do not drop the guard on the kick.",
    ],
    ["shoulders", "arms", "hips", "core", "obliques", "shins", "legs"],
  ),
  workout(
    "all-low-kicks",
    "All low kicks",
    "Recommended: 4-6 rounds x 2-3 min, 45-60 sec rest",
    [
      "Shin through the bag, not the foot.",
      "The hip turns over the kick.",
      "The base leg stays bent and pivots.",
      "Switch sides so one leg does not do all the work.",
    ],
    ["hips", "core", "shins", "legs", "feet"],
    { rounds: 5, workSeconds: 150, restSeconds: 60 },
  ),
  workout(
    "all-teeps",
    "All teeps",
    "Recommended: 4-6 rounds x 2-3 min, 45 sec rest",
    [
      "Push the bag with the ball of the foot.",
      "The hips come forward with the kick.",
      "Snap the leg back to stance.",
      "Keep the rear hand up while the teep extends.",
    ],
    ["hip-flexors", "core", "legs"],
    { rounds: 5, workSeconds: 150, restSeconds: 45 },
  ),
  workout(
    "all-body-kicks",
    "All body kicks",
    "Recommended: 3-6 rounds x 3 min, 1 min rest",
    [
      "Turn the hip and hit with the shin.",
      "Spot the bag, then look through the kick.",
      "The base foot pivots fully.",
      "Recover the kicking leg before you throw again.",
    ],
    ["hips", "core", "obliques", "shins", "legs", "feet"],
  ),
  workout(
    "all-hooks",
    "All hooks",
    "Recommended: 3-6 rounds x 3 min, 1 min rest",
    [
      "Turn the hip and shoulder together.",
      "The elbow stays near 90 degrees.",
      "Pivot the back foot.",
      "The core stays tight so the hook does not leak.",
    ],
    ["shoulders", "obliques", "core", "hips", "feet"],
  ),
  workout(
    "all-uppercuts",
    "All uppercuts",
    "Recommended: 3-6 rounds x 3 min, 1 min rest",
    [
      "Bend the knees, then drive up through the shot.",
      "The elbow stays in.",
      "The other hand stays at the chin.",
      "Do not lean back to make room.",
    ],
    ["shoulders", "arms", "core", "legs"],
  ),
  workout(
    "all-body-shots",
    "All body shots",
    "Recommended: 3-6 rounds x 3 min, 1 min rest",
    [
      "Change level with the knees, not a big bend at the waist.",
      "Hands stay tight on the way in and out.",
      "Sit into the shot and exhale.",
      "Come back up to the guard between shots.",
    ],
    ["shoulders", "arms", "core", "obliques", "legs"],
  ),
  workout(
    "all-head-kicks",
    "All head kicks",
    "Recommended: 3-5 rounds x 2-3 min, 1 min rest",
    [
      "Chamber the knee, then turn the hip over.",
      "Strike with the shin on the same line every time.",
      "Hands stay up.",
      "Land balanced and get the leg back.",
    ],
    ["hips", "core", "obliques", "shins", "legs", "feet"],
    standard(4),
  ),
  workout(
    "all-japanese-teeps",
    "All Japanese teeps",
    "Recommended: 4-6 rounds x 2-3 min, 45 sec rest",
    [
      "Thrust from the hip, toes pulled back.",
      "Push through the bag instead of a flick.",
      "The rear hand stays home.",
      "Step the base foot if you need the range.",
    ],
    ["hip-flexors", "core", "legs", "hips"],
    { rounds: 5, workSeconds: 150, restSeconds: 45 },
  ),
  workout(
    "all-straight-punches",
    "All straight punches",
    "Recommended: 3-6 rounds x 3 min, 1 min rest",
    [
      "The fist turns over at the end.",
      "The shoulder covers the chin on the rear hand.",
      "Snap back to the guard.",
      "The feet stay under you.",
    ],
    ["shoulders", "arms", "core", "feet"],
  ),
  workout(
    "straight-1-2s-and-teeps",
    "Straight 1-2s and teeps",
    "Recommended: 4-6 rounds x 3 min, 1 min rest",
    [
      "Jab, cross, then the teep on the same line.",
      "The teep replaces a third punch. It does not chase.",
      "Hands return before the kick.",
      "Reset the stance after every combo.",
    ],
    ["shoulders", "arms", "hip-flexors", "core", "legs", "feet"],
  ),
  workout(
    "clinch-to-knee",
    "Clinch to knee",
    "Recommended: 3-5 rounds x 2-3 min, 45-60 sec rest",
    [
      "Get the neck or the arms before the knee.",
      "Drive the knee up from the hip.",
      "Posture stays tall.",
      "Break and re-enter instead of hanging.",
    ],
    ["neck", "traps", "lats", "arms", "hips", "knees"],
    { rounds: 4, workSeconds: 150, restSeconds: 60 },
  ),
  workout(
    "clinch-to-knee-band",
    "Clinch to knee (resistance band)",
    "Recommended: 3-5 rounds x 2 min, 45 sec rest",
    [
      "The band resists the knee drive, so the hip does the work.",
      "Stay tall in the clinch posture.",
      "Control the neck or the arms first.",
      "Slow the return so the band does not yank the leg.",
    ],
    ["neck", "traps", "lats", "arms", "hips", "knees"],
    { rounds: 4, workSeconds: 120, restSeconds: 45 },
  ),
  workout(
    "clinch-to-elbow-band",
    "Clinch to elbow (resistance band)",
    "Recommended: 3-5 rounds x 2 min, 45 sec rest",
    [
      "The band loads the arm, then the elbow turns from the shoulder.",
      "Keep the clinch frame before you strike.",
      "Short range.",
      "Return the arm under control.",
    ],
    ["neck", "traps", "lats", "arms", "shoulders", "core"],
    { rounds: 4, workSeconds: 120, restSeconds: 45 },
  ),
  workout(
    "all-overhands",
    "All overhands",
    "Recommended: 3-5 rounds x 3 min, 1 min rest",
    [
      "Loop over the top from the shoulder and hip.",
      "The lead hand stays at home.",
      "Do not fall in after the shot.",
      "Land, then get the rear foot back under you.",
    ],
    ["shoulders", "obliques", "core", "hips"],
  ),
  workout(
    "level-change",
    "Level change combos",
    "Recommended: 3-6 rounds x 3 min, 1 min rest",
    [
      "Drop with the legs, not a fold at the waist.",
      "The head stays off the center line.",
      "Come up on a different line than you went down.",
      "The core stays braced through the change.",
    ],
    ["legs", "glutes", "core"],
  ),
  workout(
    "strike-to-bodylock",
    "Strike to bodylock",
    "Recommended: 3-5 rounds x 2-3 min, 45-60 sec rest",
    [
      "Strike to enter, then lock the body.",
      "Hips in, head tight to the side.",
      "Do not reach with the arms and leave the hips back.",
      "Finish the lock, then break and rebuild.",
    ],
    ["arms", "core", "hips", "lats", "legs"],
    { rounds: 4, workSeconds: 150, restSeconds: 60 },
  ),
  workout(
    "full-muay-thai",
    "Full Muay Thai",
    "Recommended: 4-6 rounds x 3 min, 1 min rest",
    [
      "Use punches, kicks, knees, and elbows in the same round.",
      "The guard returns after every weapon.",
      "Mix range so you are not only boxing.",
      "Finish the round on balance, not on one last kick.",
    ],
    ["shoulders", "arms", "hips", "core", "shins", "knees", "feet"],
  ),
  workout(
    "full-mma",
    "Full MMA",
    "Recommended: 3-5 rounds x 3-5 min, 1 min rest",
    [
      "Strike, then change level as if a shot is there.",
      "Hands cover the head on the way in.",
      "Mix kicks and punches before the level change.",
      "Stand back up and reset the guard.",
    ],
    ["shoulders", "arms", "legs", "glutes", "core", "hips"],
    { rounds: 4, workSeconds: 180, restSeconds: 60 },
  ),
  workout(
    "right-side-only",
    "Right side only",
    "Recommended: 3-5 rounds x 2-3 min, 45 sec rest",
    [
      "Every shot comes from the right side.",
      "The left side stays the guard and the base.",
      "Pivot the right foot on punches.",
      "Do not sneak in a left just to feel busy.",
    ],
    ["shoulders", "arms", "obliques", "hips", "core", "legs", "feet"],
    { rounds: 4, workSeconds: 150, restSeconds: 45 },
    "right",
  ),
  workout(
    "left-side-only",
    "Left side only",
    "Recommended: 3-5 rounds x 2-3 min, 45 sec rest",
    [
      "Every shot comes from the left side.",
      "The right side stays the guard and the base.",
      "Pivot the left foot on punches.",
      "Quality on one side beats switching early.",
    ],
    ["shoulders", "arms", "obliques", "hips", "core", "legs", "feet"],
    { rounds: 4, workSeconds: 150, restSeconds: 45 },
    "left",
  ),
];

const BY_SLUG = new Map(BAG_WORKOUTS.map((workout) => [workout.slug, workout]));

export function bagWorkoutBySlug(slug: string) {
  return BY_SLUG.get(slug) ?? null;
}

export function bagWorkoutNames() {
  return BAG_WORKOUTS.map((workout) => workout.name);
}

export type BagworkView = {
  key: string;
  name: string;
  description: string;
  recommendation: string;
  cues: readonly string[];
  regions: readonly BagRegion[];
  side: BagSide;
  suggested: TimerConfig;
  custom: boolean;
};

export function viewFromCatalog(workout: BagWorkout): BagworkView {
  return {
    key: workout.slug,
    name: workout.name,
    description: "",
    recommendation: workout.recommendation,
    cues: workout.cues,
    regions: workout.regions,
    side: workout.side,
    suggested: workout.suggested,
    custom: false,
  };
}

export const CUSTOM_BAG_RECOMMENDATION =
  "Recommended: 3-6 rounds x 3 min, 1 min rest. Set your own count.";

export function viewFromCustom(row: {
  id: string;
  name: string;
  description: string;
  regions: string;
}): BagworkView {
  const cues = row.description
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);
  return {
    key: `saved:${row.id}`,
    name: row.name,
    description: row.description,
    recommendation: CUSTOM_BAG_RECOMMENDATION,
    cues: cues.length > 0 ? cues : ["Work the regions you highlighted. Stop while the shots still look like the first round."],
    regions: parseBagRegions(row.regions),
    side: "both",
    suggested: standard(),
    custom: true,
  };
}

export function litParts(
  parts: readonly FigurePart[],
  regions: readonly BagRegion[],
  side: BagSide,
) {
  return parts.filter((part) => partIsLit(part, regions, side));
}

export function parseSessionRpe(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) return null;
  return parsed;
}

/**
 * Session load for bagwork: completed rounds × round minutes × RPE.
 * A skipped RPE uses 5 so the session still counts.
 */
export function bagworkTrainingLoad(rounds: number, roundSeconds: number, rpe: number | null) {
  const count = Math.max(0, Math.round(rounds));
  const minutes = Math.max(0, roundSeconds) / 60;
  if (count === 0 || minutes === 0) return 0;
  const effort = rpe == null ? BAGWORK_DEFAULT_RPE : Math.min(10, Math.max(1, Math.round(rpe)));
  return Math.round(count * minutes * effort);
}

export function bagworkRoundsFromSets(
  sets: ReadonlyArray<{
    prescriptionKey?: string | null;
    durationSeconds?: number | null;
    completed?: boolean | null;
  }>,
) {
  return sets.filter(
    (set) =>
      set.prescriptionKey === BAGWORK_PRESCRIPTION &&
      set.completed !== false &&
      (set.durationSeconds ?? 0) > 0,
  );
}

export function bagworkTrainingLoadFromSession(session: {
  sessionRpe?: number | null;
  sets: ReadonlyArray<{
    prescriptionKey?: string | null;
    durationSeconds?: number | null;
    completed?: boolean | null;
  }>;
}) {
  const rounds = bagworkRoundsFromSets(session.sets);
  if (rounds.length === 0) return 0;
  return bagworkTrainingLoad(rounds.length, rounds[0]?.durationSeconds ?? 0, session.sessionRpe ?? null);
}

export function bagworkHistoryLine(session: {
  sessionRpe?: number | null;
  notes?: string | null;
  sets: ReadonlyArray<{
    prescriptionKey?: string | null;
    durationSeconds?: number | null;
    completed?: boolean | null;
  }>;
}) {
  const rounds = bagworkRoundsFromSets(session.sets);
  if (rounds.length === 0) return null;
  const minutes = Math.max(1, Math.round((rounds[0]?.durationSeconds ?? 0) / 60));
  const rpe = session.sessionRpe;
  const parts = [
    `${rounds.length} round${rounds.length === 1 ? "" : "s"}`,
    `${minutes} min`,
  ];
  if (rpe != null) parts.push(`RPE ${rpe}`);
  return parts.join(" · ");
}

export type BagworkQuery = {
  bagwork?: string;
  rounds?: string;
  work?: string;
  rest?: string;
  workMin?: string;
  restMin?: string;
};

export function bagworkTimerConfig(query: BagworkQuery, fallback: TimerConfig): TimerConfig {
  const rounds = clampRounds(Number(query.rounds) || fallback.rounds);
  const workSeconds = query.work
    ? clampDurationSeconds(Number(query.work))
    : query.workMin
      ? clampDurationSeconds(Number(query.workMin) * 60)
      : fallback.workSeconds;
  const restSeconds = query.rest
    ? clampDurationSeconds(Number(query.rest))
    : query.restMin
      ? clampDurationSeconds(Number(query.restMin) * 60)
      : fallback.restSeconds;
  return { rounds, workSeconds, restSeconds };
}

export function bagworkBackHref(key: string) {
  if (key.startsWith("saved:")) return `/bagwork/saved/${key.slice("saved:".length)}`;
  return `/bagwork/${key}`;
}

export function customIdFromKey(key: string) {
  return key.startsWith("saved:") ? key.slice("saved:".length) : null;
}
