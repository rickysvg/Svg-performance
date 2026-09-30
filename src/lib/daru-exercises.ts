import type { ScaleBand } from "@/lib/bike-sessions";
import type { LogMode } from "@/lib/exercise-log-mode";

export const FRIDAY_GPP_DAY_NUMBER = 10;
/** Thursday posterior / unilateral strength day (bike uses 4–9). */
export const THU_STRENGTH_DAY_NUMBER = 11;

export type DaruScale = {
  sets: number;
  reps: string;
  restSeconds: number;
  loadText: string;
};

export type DaruExercise = {
  name: string;
  logMode: LogMode;
  notes: string;
  svgScaling: boolean;
  scale: Record<ScaleBand, DaruScale>;
};

const SVG_STRENGTH_NOTE =
  "Phil Daru / Daru Strong method — not an SVG program, no endorsement. Source did not prescribe weekly sets; this is SVG scaling.";

export const DARU_EXERCISES: DaruExercise[] = [
  {
    name: "Trap-bar deadlift",
    logMode: "load_reps",
    svgScaling: true,
    notes: `${SVG_STRENGTH_NOTE} Simple hinge tester. Log reps and lbs.`,
    scale: {
      beginner: { sets: 3, reps: "5–8", restSeconds: 90, loadText: "0-2 RIR · ~75% of a 5-rep max · honest last reps" },
      intermediate: { sets: 4, reps: "3–6", restSeconds: 90, loadText: "0-2 RIR · ~80% of a 5-rep max · flat back" },
      advanced: { sets: 5, reps: "3", restSeconds: 75, loadText: "0-2 RIR · ~85% of a 5-rep max · high intent" },
    },
  },
  {
    name: "Floor press",
    logMode: "load_reps",
    svgScaling: true,
    notes: `${SVG_STRENGTH_NOTE} Limited-ROM horizontal press. Log reps and lbs.`,
    scale: {
      beginner: { sets: 3, reps: "5–8", restSeconds: 90, loadText: "1-3 RIR · upper arms to the floor" },
      intermediate: { sets: 4, reps: "3–6", restSeconds: 90, loadText: "1-3 RIR · paused on the floor" },
      advanced: { sets: 5, reps: "3", restSeconds: 75, loadText: "1-3 RIR · heavy triples" },
    },
  },
  {
    name: "Landmine press",
    logMode: "load_reps",
    svgScaling: true,
    notes: `${SVG_STRENGTH_NOTE} Elbow-in, anti-extension press. Log reps and lbs.`,
    scale: {
      beginner: { sets: 3, reps: "6–8 / side", restSeconds: 75, loadText: "2-4 RIR · brace hard" },
      intermediate: { sets: 3, reps: "6–10 / side", restSeconds: 75, loadText: "2-4 RIR · clean lockout" },
      advanced: { sets: 4, reps: "5–6 / side", restSeconds: 60, loadText: "2-4 RIR · no back bend" },
    },
  },
  {
    name: "Rotational med-ball throw",
    logMode: "load_reps",
    svgScaling: true,
    notes: `${SVG_STRENGTH_NOTE} Transverse power into a wall. Log throws and ball lbs.`,
    scale: {
      beginner: { sets: 3, reps: "6 / side", restSeconds: 75, loadText: "3-5 RIR · light ball, fast turn" },
      intermediate: { sets: 3, reps: "8 / side", restSeconds: 60, loadText: "3-5 RIR · crisp hip turn" },
      advanced: { sets: 4, reps: "6 / side", restSeconds: 45, loadText: "3-5 RIR · heavier ball, full intent" },
    },
  },
  {
    name: "Med-ball chest pass",
    logMode: "load_reps",
    svgScaling: true,
    notes: "Phil Daru / Daru Strong — filmed as 10 throws. Not an SVG program, no endorsement. Weekly sets are SVG scaling. Log throws and ball lbs.",
    scale: {
      beginner: { sets: 3, reps: "8", restSeconds: 75, loadText: "3-5 RIR · light ball, fast pass" },
      intermediate: { sets: 3, reps: "10", restSeconds: 60, loadText: "3-5 RIR · crisp, no pause" },
      advanced: { sets: 4, reps: "10", restSeconds: 45, loadText: "3-5 RIR · hard throws, still fast" },
    },
  },
  {
    name: "Sled push",
    logMode: "timed",
    svgScaling: true,
    notes: `${SVG_STRENGTH_NOTE} Acceleration / blast-double shin angle. Timed — no reps.`,
    scale: {
      beginner: { sets: 4, reps: "20 sec", restSeconds: 75, loadText: "Timed — no lbs logged as reps" },
      intermediate: { sets: 5, reps: "25 sec", restSeconds: 60, loadText: "Hard drive, stay tall" },
      advanced: { sets: 6, reps: "30 sec", restSeconds: 45, loadText: "Heavy sled, short rest" },
    },
  },
  {
    name: "Sled hamstring drag",
    logMode: "timed",
    svgScaling: false,
    notes:
      "Phil Daru / Daru Strong — about 10–20 min upright pull-steps (not an SVG program, no endorsement). Timed. Load about 0.5–1× bodyweight if you have plates.",
    scale: {
      beginner: { sets: 1, reps: "10:00", restSeconds: 0, loadText: "Easy–moderate drag" },
      intermediate: { sets: 1, reps: "15:00", restSeconds: 0, loadText: "Steady posterior GPP" },
      advanced: { sets: 1, reps: "20:00", restSeconds: 0, loadText: "0.5–1× BW if available" },
    },
  },
  {
    name: "Farmer's carry",
    logMode: "load_timed",
    svgScaling: true,
    notes: `${SVG_STRENGTH_NOTE} Walk tall. Log seconds and lbs — no reps.`,
    scale: {
      beginner: { sets: 3, reps: "30–40 sec", restSeconds: 90, loadText: "2-3 RIR · heavy for you, walk tall" },
      intermediate: { sets: 3, reps: "35–45 sec", restSeconds: 75, loadText: "2-3 RIR · heavy for you, walk tall" },
      advanced: { sets: 4, reps: "40–50 sec", restSeconds: 45, loadText: "2-3 RIR · heavy, walk tall" },
    },
  },
  {
    name: "Banded kettlebell swing",
    logMode: "timed",
    svgScaling: true,
    notes: `${SVG_STRENGTH_NOTE} Posterior power with a band. Friday conditioning is timed — no reps or lbs.`,
    scale: {
      beginner: { sets: 4, reps: "30 sec", restSeconds: 60, loadText: "3-5 RIR · crisp snaps" },
      intermediate: { sets: 5, reps: "35 sec", restSeconds: 45, loadText: "3-5 RIR · hard, still fast" },
      advanced: { sets: 6, reps: "40 sec", restSeconds: 30, loadText: "3-5 RIR · overspeed, stay crisp" },
    },
  },
  {
    name: "Neck extension hold",
    logMode: "timed",
    svgScaling: true,
    notes:
      "Phil Daru / Daru Strong GHR / reverse-plank neck extension (not an SVG program, no endorsement). Source listed 12–20 reps; SVG scaling uses timed holds. Log seconds.",
    scale: {
      beginner: { sets: 3, reps: "20–30 sec", restSeconds: 60, loadText: "Hold — no weight" },
      intermediate: { sets: 3, reps: "30–45 sec", restSeconds: 45, loadText: "Hold — no weight" },
      advanced: { sets: 4, reps: "45–60 sec", restSeconds: 30, loadText: "Hold — no weight" },
    },
  },
  {
    name: "Banded DB front-rack march",
    logMode: "timed",
    svgScaling: false,
    notes:
      "Phil Daru / Daru Strong — 3–4 × 30–60s with a band around the head (not an SVG program, no endorsement). Timed march. Log seconds.",
    scale: {
      beginner: { sets: 3, reps: "30 sec", restSeconds: 60, loadText: "Light DBs, band on head" },
      intermediate: { sets: 3, reps: "45 sec", restSeconds: 45, loadText: "Moderate DBs, stay tall" },
      advanced: { sets: 4, reps: "60 sec", restSeconds: 30, loadText: "Heavier DBs, no lean" },
    },
  },
  {
    name: "Neck isometric matrix",
    logMode: "timed",
    svgScaling: true,
    notes:
      "UFC Performance Institute neck-matrix idea, static phase only — not an SVG program and not an endorsement. Hand or band. Flexion, extension, left, and right. Ramp a gentle push for about 5 seconds. Never a max squeeze on day one. No bridges. Skip after a hard spar, head trauma, or a neck injury. Neck training is not proven to prevent concussion. Log seconds.",
    scale: {
      beginner: {
        sets: 2,
        reps: "5 sec × 4 directions",
        restSeconds: 45,
        loadText: "Gentle ramp — no max effort",
      },
      intermediate: {
        sets: 2,
        reps: "5 sec × 4 directions",
        restSeconds: 45,
        loadText: "Firm, still submax",
      },
      advanced: {
        sets: 3,
        reps: "5 sec × 4 directions",
        restSeconds: 30,
        loadText: "Controlled — still not a max squeeze",
      },
    },
  },
  {
    name: "Bent-over DB shrug",
    logMode: "load_reps",
    svgScaling: false,
    notes:
      "Phil Daru / Daru Strong — 3–4 × 8–12 up-and-back shrugs (not an SVG program, no endorsement). Log reps and lbs.",
    scale: {
      beginner: { sets: 3, reps: "8–12", restSeconds: 60, loadText: "2-4 RIR · up and back" },
      intermediate: { sets: 3, reps: "10", restSeconds: 60, loadText: "2-4 RIR · squeeze, no yank" },
      advanced: { sets: 4, reps: "8–12", restSeconds: 45, loadText: "2-4 RIR · control the lower" },
    },
  },
];

const BY_NAME = Object.fromEntries(DARU_EXERCISES.map((row) => [row.name, row]));

export function daruExerciseForName(name: string): DaruExercise | null {
  return BY_NAME[name] ?? null;
}

export function scaleDaruExercise(name: string, band: ScaleBand): DaruScale | null {
  return BY_NAME[name]?.scale[band] ?? null;
}

/** Monday lower-day hinge credit (Daru Strong). */
export const MON_DARU_NAMES = ["Trap-bar deadlift"] as const;

/** Wednesday upper-push + rotational power credits (Daru Strong). */
export const WED_DARU_NAMES = [
  "Floor press",
  "Landmine press",
  "Rotational med-ball throw",
  "Med-ball chest pass",
] as const;

export const LIFT_FINISHER_NAMES = [
  "Neck extension hold",
  "Banded DB front-rack march",
  "Bent-over DB shrug",
] as const;

export const FRIDAY_GPP_NAMES = [
  "Sled push",
  "Sled hamstring drag",
  "Farmer's carry",
  "Banded kettlebell swing",
  "Neck isometric matrix",
] as const;

/** @deprecated Prefer MON_DARU_NAMES / WED_DARU_NAMES — kept for older tests. */
export const MON_WED_LIFT_NAMES = [
  "Trap-bar deadlift",
  "Floor press",
  "Landmine press",
] as const;

/** @deprecated Prefer WED_DARU_NAMES — kept for older tests. */
export const MON_WED_POWER_NAMES = [
  "Rotational med-ball throw",
  "Med-ball chest pass",
] as const;

/** @deprecated Prefer day-specific lists — kept for older tests. */
export const MON_WED_DARU_NAMES = [
  ...MON_WED_POWER_NAMES,
  ...MON_WED_LIFT_NAMES,
  ...LIFT_FINISHER_NAMES,
] as const;

export function daruSeedRow(name: string, sortOrder: number) {
  const exercise = BY_NAME[name];
  if (!exercise) {
    throw new Error(`Unknown Daru exercise: ${name}`);
  }
  const beginner = exercise.scale.beginner;
  return {
    sortOrder,
    name: exercise.name,
    sets: beginner.sets,
    reps: beginner.reps,
    loadText: beginner.loadText,
    restSeconds: beginner.restSeconds,
    notes: exercise.notes,
  };
}
