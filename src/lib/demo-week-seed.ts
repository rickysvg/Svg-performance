import {
  BAG_ROUND_COUNTS,
  BAG_ROUND_SECONDS,
  SHADOW_COOL_NAME,
  SHADOW_EMPTY_NAME,
  SHADOW_WEIGHTED_NAME,
  bagFocusFor,
  formatBagRoundNotes,
  type BagWeekday,
} from "@/lib/bag-sessions";
import {
  FRIDAY_GPP_DAY_NUMBER,
  MON_DARU_NAMES,
  THU_STRENGTH_DAY_NUMBER,
  WED_DARU_NAMES,
  FRIDAY_GPP_NAMES,
  daruSeedRow,
} from "@/lib/daru-exercises";
import { formVideoFieldsFor } from "@/lib/form-videos";
import {
  MESO_BLOCKS,
  STRENGTH_DAY_BY_BLOCK,
  mesoBlockLabel,
  type MesoBlock,
} from "@/lib/mesocycle";

const BAG_OR_SHADOW =
  "Heavy bag or pads if you have them. Bodyweight only: shadow the same work at technical speed — no full power.";

const BAG_WEEKDAYS: BagWeekday[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function daruProgramExercise(name: string, sortOrder: number) {
  return {
    ...daruSeedRow(name, sortOrder),
    ...formVideoFieldsFor(name),
  };
}

function bagRoundBlock(input: { name: string; notes: string; sortOrder: number }) {
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

function shadowRounds(emptyNotes: string, weightedNotes: string) {
  return [
    {
      sortOrder: 1,
      name: SHADOW_EMPTY_NAME,
      sets: 1,
      reps: "3:00",
      loadText: "Empty hands — technical pace",
      restSeconds: 30,
      notes: emptyNotes,
      ...formVideoFieldsFor(SHADOW_EMPTY_NAME),
    },
    {
      sortOrder: 2,
      name: SHADOW_WEIGHTED_NAME,
      sets: 1,
      reps: "3:00",
      loadText: "1–3 lb hand weights",
      restSeconds: 45,
      notes: `${weightedNotes} Log seconds and lbs.`,
      ...formVideoFieldsFor(SHADOW_WEIGHTED_NAME),
    },
  ];
}

type SeedExercise = ReturnType<typeof liftExercise>;

function strengthDay(input: {
  dayNumber: number;
  title: string;
  focus: string;
  exercises: SeedExercise[];
}) {
  return {
    dayNumber: input.dayNumber,
    title: input.title,
    focus: input.focus,
    exercises: { create: input.exercises },
  };
}

/** Strength / bike / GPP catalog days for demo-strength-base. One menu per block. */
export function demoStrengthDays() {
  const a = STRENGTH_DAY_BY_BLOCK.A;
  const b = STRENGTH_DAY_BY_BLOCK.B;
  const c = STRENGTH_DAY_BY_BLOCK.C;
  return [
    strengthDay({
      dayNumber: a.monday,
      title: "Day 1 — Lower body strength",
      focus: `Squat and hinge strength · ${mesoBlockLabel("A")}`,
      exercises: [
        liftExercise({
          sortOrder: 1,
          name: "Goblet squat",
          sets: 4,
          reps: "6–8",
          loadText: "Moderate–heavy — honest last reps",
          restSeconds: 90,
          notes: "Hold a dumbbell or kettlebell at your chest. Own the bottom. Add lbs when the last reps stay fast.",
        }),
        liftExercise({
          sortOrder: 2,
          name: "Romanian deadlift",
          sets: 4,
          reps: "6–8",
          loadText: "Heavy hinge — flat back",
          restSeconds: 90,
          notes: "Hinge at the hips. Soft knees. Feel the hamstrings on every rep.",
        }),
        liftExercise({
          sortOrder: 3,
          name: "Reverse lunge",
          sets: 3,
          reps: "8 / leg",
          loadText: "Light dumbbells if you have them",
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
    }),
    strengthDay({
      dayNumber: a.tuesday,
      title: "Day 2 — Upper pull + core",
      focus: `Rows, vertical pull, and trunk · ${mesoBlockLabel("A")}`,
      exercises: [
        liftExercise({
          sortOrder: 1,
          name: "One-arm row",
          sets: 4,
          reps: "8 / side",
          loadText: "Moderate–heavy dumbbell or band",
          restSeconds: 75,
          notes: "Support the free hand. Pull the elbow toward the hip. Last reps should slow.",
        }),
        liftExercise({
          sortOrder: 2,
          name: "Chin-up, band-assist, or lat pulldown",
          sets: 4,
          reps: "5–8",
          loadText: "Full hang to control",
          restSeconds: 90,
          notes: "No bar? Slow inverted row or heavy band pulldown. Stop the set when the chin stops clearing.",
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
    }),
    strengthDay({
      dayNumber: a.wednesday,
      title: "Day 3 — Upper push + rotational power",
      focus: `Press and transverse power · ${mesoBlockLabel("A")}`,
      exercises: [
        liftExercise({
          sortOrder: 1,
          name: "Push-up or dumbbell bench press",
          sets: 4,
          reps: "6–10",
          loadText: "Challenging but clean",
          restSeconds: 75,
          notes: "Elevate the hands if a full push-up is too hard. Last reps should slow before you add a set.",
        }),
        liftExercise({
          sortOrder: 2,
          name: "Overhead press",
          sets: 4,
          reps: "6–8",
          loadText: "Moderate–heavy",
          restSeconds: 90,
          notes: "Dumbbells or a light bar. Landmine if overhead bothers you. No lean-back to finish the rep.",
        }),
        ...WED_DARU_NAMES.map((name, index) => daruProgramExercise(name, 3 + index)),
      ],
    }),
    strengthDay({
      dayNumber: THU_STRENGTH_DAY_NUMBER,
      title: "Day 11 — Posterior chain + unilateral",
      focus: `Hips, single-leg strength, and carries · ${mesoBlockLabel("A")}`,
      exercises: [
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
          loadText: "Light dumbbells if you have them",
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
    }),
    strengthDay({
      dayNumber: FRIDAY_GPP_DAY_NUMBER,
      title: "Day 10 — Friday GPP",
      focus: `Sled, carry, swing, and neck isometrics · ${mesoBlockLabel("A")}`,
      exercises: FRIDAY_GPP_NAMES.map((name, index) => daruProgramExercise(name, index + 1)),
    }),
    strengthDay({
      dayNumber: b.monday,
      title: "Day 12 — Lower body strength",
      focus: `Pause squat and walking lunge · ${mesoBlockLabel("B")}`,
      exercises: [
        liftExercise({
          sortOrder: 1,
          name: "Pause goblet squat",
          sets: 4,
          reps: "5",
          loadText: "Moderate–heavy — pause is the point",
          restSeconds: 90,
          notes: "Three-second pause in the hole. Stand only when the position is quiet.",
        }),
        liftExercise({
          sortOrder: 2,
          name: "Single-leg RDL",
          sets: 4,
          reps: "6 / leg",
          loadText: "Moderate dumbbell",
          restSeconds: 75,
          notes: "Hinge, do not twist. The free leg reaches back. This is the Block B hinge.",
        }),
        liftExercise({
          sortOrder: 3,
          name: "Walking lunge",
          sets: 3,
          reps: "8 / leg",
          loadText: "Dumbbells — last steps slow",
          restSeconds: 75,
          notes: "Long step. Front knee tracks over the toes. Do not bounce out of the bottom.",
        }),
        liftExercise({
          sortOrder: 4,
          name: "Front plank",
          sets: 3,
          reps: "40–50 sec",
          loadText: "Hold — no weight",
          restSeconds: 60,
          notes: "Harder brace than Block A. Log the hold time.",
        }),
        ...MON_DARU_NAMES.map((name, index) => daruProgramExercise(name, 5 + index)),
      ],
    }),
    strengthDay({
      dayNumber: b.tuesday,
      title: "Day 13 — Upper pull + core",
      focus: `Chest-supported row and vertical pull · ${mesoBlockLabel("B")}`,
      exercises: [
        liftExercise({
          sortOrder: 1,
          name: "Chest-supported dumbbell row",
          sets: 4,
          reps: "6–8",
          loadText: "Heavy enough that the last reps slow",
          restSeconds: 75,
          notes: "Chest on a bench. Pull the elbows to the ribs. No yank from the lower back.",
        }),
        liftExercise({
          sortOrder: 2,
          name: "Chin-up, band-assist, or lat pulldown",
          sets: 4,
          reps: "4–6",
          loadText: "Heavier than Block A — fewer reps",
          restSeconds: 90,
          notes: "Full hang. Control the lower. Add a band if the last rep dies halfway.",
        }),
        liftExercise({
          sortOrder: 3,
          name: "Band pull-apart or face pull",
          sets: 3,
          reps: "15",
          loadText: "Moderate band",
          restSeconds: 45,
          notes: "Pause one second with the shoulder blades together.",
        }),
        liftExercise({
          sortOrder: 4,
          name: "Dead bug",
          sets: 3,
          reps: "10 / side",
          loadText: "Bodyweight — slower than Block A",
          restSeconds: 45,
          notes: "Low back stays down. The moving limb is the only thing that moves.",
        }),
        liftExercise({
          sortOrder: 5,
          name: "Side plank",
          sets: 3,
          reps: "25–35 sec / side",
          loadText: "Hold — no weight",
          restSeconds: 45,
          notes: "Hips stacked. Log the hold.",
        }),
      ],
    }),
    strengthDay({
      dayNumber: b.wednesday,
      title: "Day 14 — Upper push + rotational power",
      focus: `Heavier press and single-arm lockout · ${mesoBlockLabel("B")}`,
      exercises: [
        liftExercise({
          sortOrder: 1,
          name: "Push-up or dumbbell bench press",
          sets: 5,
          reps: "5",
          loadText: "Heavy — last rep is slow and clean",
          restSeconds: 90,
          notes: "Block B press is fewer reps and more load than Block A. Chest or incline bench.",
        }),
        liftExercise({
          sortOrder: 2,
          name: "Single-arm overhead press",
          sets: 3,
          reps: "6 / side",
          loadText: "Strict — no lean",
          restSeconds: 75,
          notes: "One dumbbell. Ribs down. The free hand can touch the ribs, not the thigh to cheat.",
        }),
        ...WED_DARU_NAMES.map((name, index) => daruProgramExercise(name, 3 + index)),
      ],
    }),
    strengthDay({
      dayNumber: b.thursday,
      title: "Day 15 — Posterior chain + unilateral",
      focus: `Swing, hinge, and suitcase carry · ${mesoBlockLabel("B")}`,
      exercises: [
        liftExercise({
          sortOrder: 1,
          name: "Kettlebell swing or hip hinge",
          sets: 5,
          reps: "8",
          loadText: "Heavier bell — still crisp",
          restSeconds: 60,
          notes: "Power hinge. Stop the set if the bell turns into a squat.",
        }),
        liftExercise({
          sortOrder: 2,
          name: "Dumbbell Romanian deadlift",
          sets: 4,
          reps: "6",
          loadText: "Heavy hinge — flat back",
          restSeconds: 90,
          notes: "Two dumbbells. Soft knees. Different tool than Monday's trap bar.",
        }),
        liftExercise({
          sortOrder: 3,
          name: "Suitcase carry",
          sets: 3,
          reps: "30–40 sec / side",
          loadText: "Heavy one side — stay tall",
          restSeconds: 75,
          notes: "One bell. Do not lean. Log seconds and lbs.",
        }),
        liftExercise({
          sortOrder: 4,
          name: "Side plank",
          sets: 3,
          reps: "25–35 sec / side",
          loadText: "Hold — no weight",
          restSeconds: 45,
          notes: "Hips stacked. Log the hold.",
        }),
      ],
    }),
    strengthDay({
      dayNumber: b.friday,
      title: "Day 16 — Friday GPP",
      focus: `Repeat efforts after the GPP menu · ${mesoBlockLabel("B")}`,
      exercises: [
        ...FRIDAY_GPP_NAMES.map((name, index) => daruProgramExercise(name, index + 1)),
        liftExercise({
          sortOrder: FRIDAY_GPP_NAMES.length + 1,
          name: "Burpees",
          sets: 4,
          reps: "30 sec",
          loadText: "Hard, repeatable — no lbs",
          restSeconds: 45,
          notes: "Stand-up burpee. Chest to the floor if you can. Stop if the hips pike and the set turns sloppy.",
        }),
      ],
    }),
    strengthDay({
      dayNumber: c.monday,
      title: "Day 17 — Lower body strength",
      focus: `Lunge-led lower day · ${mesoBlockLabel("C")}`,
      exercises: [
        liftExercise({
          sortOrder: 1,
          name: "Walking lunge",
          sets: 4,
          reps: "6 / leg",
          loadText: "Heavier dumbbells than Block B",
          restSeconds: 75,
          notes: "This is the main lift. Long step. Last reps on each leg should slow.",
        }),
        liftExercise({
          sortOrder: 2,
          name: "Single-leg RDL",
          sets: 4,
          reps: "5 / leg",
          loadText: "Moderate–heavy",
          restSeconds: 75,
          notes: "Fewer reps than Block B. Own the balance before you add lbs.",
        }),
        liftExercise({
          sortOrder: 3,
          name: "Goblet squat",
          sets: 3,
          reps: "6",
          loadText: "Controlled descent — two seconds down",
          restSeconds: 90,
          notes: "Squat stays in the day, with a slow lower. Not the same 6–8 grind as Block A.",
        }),
        liftExercise({
          sortOrder: 4,
          name: "Side plank",
          sets: 3,
          reps: "25–35 sec / side",
          loadText: "Hold — no weight",
          restSeconds: 45,
          notes: "Hips stacked. Log the hold.",
        }),
        ...MON_DARU_NAMES.map((name, index) => daruProgramExercise(name, 5 + index)),
      ],
    }),
    strengthDay({
      dayNumber: c.tuesday,
      title: "Day 18 — Upper pull + core",
      focus: `Half-kneeling row and shrug · ${mesoBlockLabel("C")}`,
      exercises: [
        liftExercise({
          sortOrder: 1,
          name: "Half-kneeling one-arm row",
          sets: 4,
          reps: "6 / side",
          loadText: "Heavy dumbbell — torso quiet",
          restSeconds: 75,
          notes: "Half-kneeling so the lower back cannot cheat the pull. Elbow to the hip.",
        }),
        liftExercise({
          sortOrder: 2,
          name: "Chin-up, band-assist, or lat pulldown",
          sets: 4,
          reps: "6–8",
          loadText: "Smooth, full range",
          restSeconds: 90,
          notes: "Block C vertical pull is strict range, not a heavier triple.",
        }),
        liftExercise({
          sortOrder: 3,
          name: "Band pull-apart or face pull",
          sets: 4,
          reps: "12",
          loadText: "Moderate band",
          restSeconds: 45,
          notes: "Extra set versus Block A. Shoulder blades still meet.",
        }),
        liftExercise({
          sortOrder: 4,
          name: "Dead bug",
          sets: 3,
          reps: "8 / side",
          loadText: "Bodyweight — slow",
          restSeconds: 45,
          notes: "Low back stays glued.",
        }),
        ...["Bent-over DB shrug"].map((name, index) => daruProgramExercise(name, 5 + index)),
      ],
    }),
    strengthDay({
      dayNumber: c.wednesday,
      title: "Day 19 — Upper push + rotational power",
      focus: `Paused press and strict overhead · ${mesoBlockLabel("C")}`,
      exercises: [
        liftExercise({
          sortOrder: 1,
          name: "Push-up or dumbbell bench press",
          sets: 4,
          reps: "6",
          loadText: "Pause on the chest — then press",
          restSeconds: 90,
          notes: "One-second pause at the bottom. Block C is a pause, not Block B's heavy five.",
        }),
        liftExercise({
          sortOrder: 2,
          name: "Overhead press",
          sets: 4,
          reps: "5",
          loadText: "Strict — heavier than Block A",
          restSeconds: 90,
          notes: "No leg drive. Stop the set if the ribs flare to finish the lockout.",
        }),
        ...WED_DARU_NAMES.map((name, index) => daruProgramExercise(name, 3 + index)),
      ],
    }),
    strengthDay({
      dayNumber: c.thursday,
      title: "Day 20 — Posterior chain + unilateral",
      focus: `Longer swings and a suitcase carry · ${mesoBlockLabel("C")}`,
      exercises: [
        liftExercise({
          sortOrder: 1,
          name: "Kettlebell swing or hip hinge",
          sets: 4,
          reps: "12",
          loadText: "Repeatable power — do not rush",
          restSeconds: 60,
          notes: "More reps than Block B. Hips still snap. Quality dies, the set ends.",
        }),
        liftExercise({
          sortOrder: 2,
          name: "Single-leg RDL",
          sets: 3,
          reps: "8 / leg",
          loadText: "Moderate",
          restSeconds: 75,
          notes: "Higher reps than Block B. Balance first.",
        }),
        liftExercise({
          sortOrder: 3,
          name: "Suitcase carry",
          sets: 4,
          reps: "30 sec / side",
          loadText: "Heavy one side — stay tall",
          restSeconds: 60,
          notes: "One more set than Block B. Log seconds and lbs. Do not lean.",
        }),
        liftExercise({
          sortOrder: 4,
          name: "Side plank",
          sets: 3,
          reps: "30 sec / side",
          loadText: "Hold — no weight",
          restSeconds: 45,
          notes: "Hips stacked. Log the hold.",
        }),
      ],
    }),
    strengthDay({
      dayNumber: c.friday,
      title: "Day 21 — Friday GPP",
      focus: `GPP plus a jump-rope engine piece · ${mesoBlockLabel("C")}`,
      exercises: [
        ...FRIDAY_GPP_NAMES.map((name, index) => daruProgramExercise(name, index + 1)),
        liftExercise({
          sortOrder: FRIDAY_GPP_NAMES.length + 1,
          name: "Jump rope or easy bike intervals",
          sets: 6,
          reps: "30 sec on / 30 sec easy",
          loadText: "Smooth — no lbs",
          restSeconds: 0,
          notes: "After the GPP menu. Stay tall on the rope or easy on the bike. This is the Block C finisher, not a second sled.",
        }),
      ],
    }),
  ];
}

function bagSkillDay(block: MesoBlock, weekday: BagWeekday) {
  const plan = bagFocusFor(weekday, block);
  const technique = plan.technique;
  const exercises = [
    ...shadowRounds(plan.shadowEmpty, plan.shadowWeighted),
    ...(technique
      ? [
          {
            sortOrder: 3,
            name: technique.name,
            sets: 3,
            reps: technique.reps,
            loadText: technique.loadText,
            restSeconds: 45,
            notes: `${technique.notes} ${BAG_OR_SHADOW}`,
            ...formVideoFieldsFor(technique.name),
          },
        ]
      : []),
    bagRoundBlock({
      sortOrder: technique ? 4 : 3,
      name: plan.bagName,
      notes: formatBagRoundNotes(plan.rounds),
    }),
    {
      sortOrder: technique ? 5 : 4,
      name: SHADOW_COOL_NAME,
      sets: 1,
      reps: "2:00",
      loadText: "Breathe — no power",
      restSeconds: 0,
      notes:
        weekday === "Saturday"
          ? "Walk it down. Optional Saturday — skip if you need the rest."
          : "Hands up, loose shoulders. Soft technical shadow — no power.",
      ...formVideoFieldsFor(SHADOW_COOL_NAME),
    },
  ];
  return {
    dayNumber: plan.dayNumber,
    title: plan.label,
    focus: `${plan.theme} · ${mesoBlockLabel(block)}`,
    exercises: { create: exercises },
  };
}

/** Bag / combat skill catalog days for demo-combat-skills. Three blocks, same weekdays. */
export function demoBagSkillDays() {
  return MESO_BLOCKS.flatMap((block) => BAG_WEEKDAYS.map((weekday) => bagSkillDay(block, weekday)));
}
