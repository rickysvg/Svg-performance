import { BAG_ROUND_COUNTS, BAG_ROUND_SECONDS } from "@/lib/bag-sessions";
import {
  FRIDAY_GPP_DAY_NUMBER,
  MON_DARU_NAMES,
  THU_STRENGTH_DAY_NUMBER,
  WED_DARU_NAMES,
  FRIDAY_GPP_NAMES,
  daruSeedRow,
} from "@/lib/daru-exercises";
import { formVideoFieldsFor } from "@/lib/form-videos";

const BAG_OR_SHADOW =
  "Heavy bag or pads if you have them. Bodyweight only: shadow the same work at technical speed — no full power.";

function daruProgramExercise(name: string, sortOrder: number) {
  return {
    ...daruSeedRow(name, sortOrder),
    ...formVideoFieldsFor(name),
  };
}

function bagRoundBlock(input: {
  name: string;
  notes: string;
  sortOrder: number;
}) {
  const seconds = BAG_ROUND_SECONDS.intermediate;
  const rounds = BAG_ROUND_COUNTS.intermediate;
  return {
    sortOrder: input.sortOrder,
    name: input.name,
    sets: rounds,
    reps: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
    loadText: "Round clock — fight pace you can repeat",
    restSeconds: 60,
    notes: `${input.notes} ${BAG_OR_SHADOW}`,
    ...formVideoFieldsFor(input.name),
  };
}

function liftExercise(input: {
  sortOrder: number;
  name: string;
  sets: number;
  reps: string;
  loadText: string;
  restSeconds: number;
  notes: string;
}) {
  return {
    ...input,
    ...formVideoFieldsFor(input.name),
  };
}

/** Strength / bike / GPP catalog days for demo-strength-base. */
export function demoStrengthDays() {
  return [
    {
      dayNumber: 1,
      title: "Day 1 — Lower body strength",
      focus: "Squat and hinge strength",
      exercises: {
        create: [
          liftExercise({
            sortOrder: 1,
            name: "Goblet squat",
            sets: 4,
            reps: "6–8",
            loadText: "Moderate–heavy — honest last reps",
            restSeconds: 90,
            notes: "Hold a dumbbell or kettlebell at your chest. Own the bottom.",
          }),
          liftExercise({
            sortOrder: 2,
            name: "Romanian deadlift",
            sets: 4,
            reps: "6–8",
            loadText: "Heavy hinge — flat back",
            restSeconds: 90,
            notes: "Hinge at the hips. Soft knees. Feel the hamstrings.",
          }),
          liftExercise({
            sortOrder: 3,
            name: "Reverse lunge",
            sets: 3,
            reps: "8 / leg",
            loadText: "Bodyweight or light dumbbells",
            restSeconds: 75,
            notes: "Step back, keep the front knee tracking over the toes.",
          }),
          liftExercise({
            sortOrder: 4,
            name: "Front plank",
            sets: 3,
            reps: "30–45 sec",
            loadText: "Hold — no weight",
            restSeconds: 60,
            notes: "Brace. Log the hold time, not pounds.",
          }),
          ...MON_DARU_NAMES.map((name, index) => daruProgramExercise(name, 5 + index)),
        ],
      },
    },
    {
      dayNumber: 2,
      title: "Day 2 — Upper pull + core",
      focus: "Rows, vertical pull, and trunk",
      exercises: {
        create: [
          liftExercise({
            sortOrder: 1,
            name: "One-arm row",
            sets: 4,
            reps: "8 / side",
            loadText: "Moderate–heavy dumbbell or band",
            restSeconds: 75,
            notes: "Support the free hand. Pull the elbow toward the hip.",
          }),
          liftExercise({
            sortOrder: 2,
            name: "Chin-up, band-assist, or lat pulldown",
            sets: 3,
            reps: "5–8",
            loadText: "Full hang to control",
            restSeconds: 90,
            notes: "No bar? Slow inverted row or heavy band pulldown.",
          }),
          liftExercise({
            sortOrder: 3,
            name: "Band pull-apart or face pull",
            sets: 3,
            reps: "12–15",
            loadText: "Light–moderate band",
            restSeconds: 60,
            notes: "Squeeze the shoulder blades. Healthy shoulders for class.",
          }),
          liftExercise({
            sortOrder: 4,
            name: "Dead bug",
            sets: 3,
            reps: "8 / side",
            loadText: "Bodyweight — slow",
            restSeconds: 45,
            notes: "Low back stays glued. Exhale as the limb extends.",
          }),
          liftExercise({
            sortOrder: 5,
            name: "Side plank",
            sets: 3,
            reps: "20–30 sec / side",
            loadText: "Hold — no weight",
            restSeconds: 45,
            notes: "Hips stacked. Log the hold time.",
          }),
        ],
      },
    },
    {
      dayNumber: 3,
      title: "Day 3 — Upper push + rotational power",
      focus: "Press and transverse power",
      exercises: {
        create: [
          liftExercise({
            sortOrder: 1,
            name: "Push-up or dumbbell bench press",
            sets: 4,
            reps: "6–10",
            loadText: "Challenging but clean",
            restSeconds: 75,
            notes: "Elevate the hands if a full push-up is too hard.",
          }),
          liftExercise({
            sortOrder: 2,
            name: "Overhead press",
            sets: 3,
            reps: "6–8",
            loadText: "Moderate",
            restSeconds: 90,
            notes: "Dumbbells or a light bar. Landmine if overhead bothers you.",
          }),
          ...WED_DARU_NAMES.map((name, index) => daruProgramExercise(name, 3 + index)),
        ],
      },
    },
    {
      dayNumber: THU_STRENGTH_DAY_NUMBER,
      title: "Day 11 — Posterior chain + unilateral",
      focus: "Hips, single-leg strength, and carries",
      exercises: {
        create: [
          liftExercise({
            sortOrder: 1,
            name: "Kettlebell swing or hip hinge",
            sets: 4,
            reps: "10",
            loadText: "Crisp, not sloppy",
            restSeconds: 60,
            notes: "Snap the hips. Do not squat the bell.",
          }),
          liftExercise({
            sortOrder: 2,
            name: "Single-leg RDL",
            sets: 3,
            reps: "6–8 / leg",
            loadText: "Light–moderate",
            restSeconds: 75,
            notes: "Soft knee on the stance leg. Reach long with the free leg.",
          }),
          liftExercise({
            sortOrder: 3,
            name: "Reverse lunge",
            sets: 3,
            reps: "8 / leg",
            loadText: "Bodyweight or light dumbbells",
            restSeconds: 75,
            notes: "Controlled step-back. Front knee tracks over the toes.",
          }),
          liftExercise({
            sortOrder: 4,
            name: "Farmer carry",
            sets: 3,
            reps: "30–40 sec",
            loadText: "Heavy for you, walk tall",
            restSeconds: 90,
            notes: "Walk for the seconds — log lbs and time, not reps.",
          }),
          liftExercise({
            sortOrder: 5,
            name: "Side plank",
            sets: 3,
            reps: "20–30 sec / side",
            loadText: "Hold — no weight",
            restSeconds: 45,
            notes: "Hips stacked. Log the hold time.",
          }),
        ],
      },
    },
    {
      dayNumber: FRIDAY_GPP_DAY_NUMBER,
      title: "Day 10 — Friday GPP",
      focus: "Sled, carry, swing, and neck isometrics",
      exercises: {
        create: FRIDAY_GPP_NAMES.map((name, index) => daruProgramExercise(name, index + 1)),
      },
    },
  ];
}

/** Bag / combat skill catalog days for demo-combat-skills. */
export function demoBagSkillDays() {
  return [
    {
      dayNumber: 1,
      title: "Bag — boxing combos",
      focus: "Hands-first combinations · Mon theme",
      exercises: {
        create: [
          {
            sortOrder: 1,
            name: "Shadowbox warm-up",
            sets: 1,
            reps: "3:00",
            loadText: "Easy technical pace",
            restSeconds: 30,
            notes: `Footwork + jab only. ${BAG_OR_SHADOW}`,
            ...formVideoFieldsFor("Shadowbox warm-up"),
          },
          {
            sortOrder: 2,
            name: "Jab–cross (1–2)",
            sets: 3,
            reps: "8",
            loadText: "Technical, snap the hands home",
            restSeconds: 45,
            notes: `Measure with the jab, turn the rear heel on the cross. ${BAG_OR_SHADOW}`,
            ...formVideoFieldsFor("Jab–cross (1–2)"),
          },
          bagRoundBlock({
            sortOrder: 3,
            name: "Bag rounds — boxing combos",
            notes:
              "Round focus rotates: R1–2 jab-cross, R3–4 1-2-3, R5–6 body jab then 1-2, R7–8 hooks/uppercuts, R9–10 defense then counter, R11–12 power combinations, R13–14 freestyle boxing. Hands home after every combo. Advanced Mon/Wed/Fri run the full ~60 min block.",
          }),
          {
            sortOrder: 4,
            name: "Easy shadow cool-down",
            sets: 1,
            reps: "2:00",
            loadText: "Breathe — no power",
            restSeconds: 0,
            notes: "Hands up, loose shoulders. Worldwide gym cool-down — not a fight camp.",
            ...formVideoFieldsFor("Easy shadow cool-down"),
          },
        ],
      },
    },
    {
      dayNumber: 2,
      title: "Bag — kicks & teeps",
      focus: "Teeps and low kicks · Tue theme",
      exercises: {
        create: [
          {
            sortOrder: 1,
            name: "Shadowbox warm-up",
            sets: 1,
            reps: "3:00",
            loadText: "Easy technical pace",
            restSeconds: 30,
            notes: `Hands + light teep chamber. ${BAG_OR_SHADOW}`,
            ...formVideoFieldsFor("Shadowbox warm-up"),
          },
          {
            sortOrder: 2,
            name: "Teep (push kick)",
            sets: 3,
            reps: "6 / side",
            loadText: "Push, do not punt",
            restSeconds: 45,
            notes: `Chamber the knee, hips behind the kick, recover to stance. ${BAG_OR_SHADOW}`,
            ...formVideoFieldsFor("Teep (push kick)"),
          },
          bagRoundBlock({
            sortOrder: 3,
            name: "Bag rounds — kicks & teeps",
            notes:
              "Round focus rotates: R1–2 teeps, R3–4 low kicks, R5–6 hands then low kick, R7–8 switch-kick entries. Guard stays high.",
          }),
          {
            sortOrder: 4,
            name: "Easy shadow cool-down",
            sets: 1,
            reps: "2:00",
            loadText: "Breathe — no power",
            restSeconds: 0,
            notes: "Shake the legs out. Soft teep chambers only.",
            ...formVideoFieldsFor("Easy shadow cool-down"),
          },
        ],
      },
    },
    {
      dayNumber: 3,
      title: "Bag — body shots",
      focus: "Liver lines and body boxing · Wed theme",
      exercises: {
        create: [
          {
            sortOrder: 1,
            name: "Shadowbox warm-up",
            sets: 1,
            reps: "3:00",
            loadText: "Easy technical pace",
            restSeconds: 30,
            notes: `Level-change to the body without dropping the hands. ${BAG_OR_SHADOW}`,
            ...formVideoFieldsFor("Shadowbox warm-up"),
          },
          {
            sortOrder: 2,
            name: "Lead hook",
            sets: 3,
            reps: "8",
            loadText: "90° elbow — body height",
            restSeconds: 45,
            notes: `Throw to the body line after a jab. ${BAG_OR_SHADOW}`,
            ...formVideoFieldsFor("Lead hook"),
          },
          bagRoundBlock({
            sortOrder: 3,
            name: "Bag rounds — body shots",
            notes:
              "Round focus rotates: R1–2 jab to body, R3–4 1-2 to the ribs, R5–6 liver hook entries, R7–8 head-body-head, R9–10 left-right body hooks, R11–12 level-change then 1-2 upstairs, R13–14 freestyle body boxing. Do not fold at the waist. Advanced Mon/Wed/Fri run the full ~60 min block.",
          }),
          {
            sortOrder: 4,
            name: "Easy shadow cool-down",
            sets: 1,
            reps: "2:00",
            loadText: "Breathe — no power",
            restSeconds: 0,
            notes: "Upright posture. Soft body feints only.",
            ...formVideoFieldsFor("Easy shadow cool-down"),
          },
        ],
      },
    },
    {
      dayNumber: 4,
      title: "Bag — clinch knees & elbows",
      focus: "Short-range clinch work · Thu theme",
      exercises: {
        create: [
          {
            sortOrder: 1,
            name: "Shadowbox warm-up",
            sets: 1,
            reps: "3:00",
            loadText: "Easy technical pace",
            restSeconds: 30,
            notes: `Posture drills into a collar clinch on the bag. ${BAG_OR_SHADOW}`,
            ...formVideoFieldsFor("Shadowbox warm-up"),
          },
          {
            sortOrder: 2,
            name: "Straight knee (clinch)",
            sets: 3,
            reps: "8 / side",
            loadText: "Hip through, heel to glute",
            restSeconds: 45,
            notes: `Pull the bag down as the hip comes forward. No jumping knees. ${BAG_OR_SHADOW}`,
            ...formVideoFieldsFor("Straight knee (clinch)"),
          },
          bagRoundBlock({
            sortOrder: 3,
            name: "Bag rounds — clinch knees",
            notes:
              "Round focus rotates: R1–2 double-collar posture, R3–4 alternate knees, R5–6 short elbows then knee, R7–8 exit the clinch and reset. Technical — not a shove contest.",
          }),
          {
            sortOrder: 4,
            name: "Easy shadow cool-down",
            sets: 1,
            reps: "2:00",
            loadText: "Breathe — no power",
            restSeconds: 0,
            notes: "Loose neck and shoulders after the clinch work.",
            ...formVideoFieldsFor("Easy shadow cool-down"),
          },
        ],
      },
    },
    {
      dayNumber: 5,
      title: "Bag — defense & counters",
      focus: "Slip, cover, fire back · Fri theme",
      exercises: {
        create: [
          {
            sortOrder: 1,
            name: "Shadowbox warm-up",
            sets: 1,
            reps: "3:00",
            loadText: "Easy technical pace",
            restSeconds: 30,
            notes: `Slip and roll without throwing yet. ${BAG_OR_SHADOW}`,
            ...formVideoFieldsFor("Shadowbox warm-up"),
          },
          {
            sortOrder: 2,
            name: "Jab–cross (1–2)",
            sets: 3,
            reps: "8",
            loadText: "Counter tempo — wait, then fire",
            restSeconds: 45,
            notes: `Imagine a jab, slip, then return the 1-2. ${BAG_OR_SHADOW}`,
            ...formVideoFieldsFor("Jab–cross (1–2)"),
          },
          bagRoundBlock({
            sortOrder: 3,
            name: "Bag rounds — defense & counters",
            notes:
              "Round focus rotates: R1–2 high guard + catch, R3–4 slip then 1-2, R5–6 roll under then body shot, R7–8 parry then cross, R9–10 cover then 1-2-3, R11–12 pivot off the center line, R13–14 freestyle defense-to-counter. Never chase — reset the feet. Advanced Mon/Wed/Fri run the full ~60 min block.",
          }),
          {
            sortOrder: 4,
            name: "Easy shadow cool-down",
            sets: 1,
            reps: "2:00",
            loadText: "Breathe — no power",
            restSeconds: 0,
            notes: "Soft footwork. Hands stay home.",
            ...formVideoFieldsFor("Easy shadow cool-down"),
          },
        ],
      },
    },
    {
      dayNumber: 6,
      title: "Bag — power & speed (optional)",
      focus: "Optional Saturday power / speed bag",
      exercises: {
        create: [
          {
            sortOrder: 1,
            name: "Shadowbox warm-up",
            sets: 1,
            reps: "2:00",
            loadText: "Easy technical pace",
            restSeconds: 30,
            notes: `Short warm-up only — this day is optional. ${BAG_OR_SHADOW}`,
            ...formVideoFieldsFor("Shadowbox warm-up"),
          },
          bagRoundBlock({
            sortOrder: 2,
            name: "Bag rounds — power & speed",
            notes:
              "Optional day. Round focus rotates: odd rounds speed hands, even rounds power 1-2s. Stop early if you are sore from the week.",
          }),
          {
            sortOrder: 3,
            name: "Easy shadow cool-down",
            sets: 1,
            reps: "2:00",
            loadText: "Breathe — no power",
            restSeconds: 0,
            notes: "Walk it down. Optional Saturday — skip if you need the rest.",
            ...formVideoFieldsFor("Easy shadow cool-down"),
          },
        ],
      },
    },
  ];
}
