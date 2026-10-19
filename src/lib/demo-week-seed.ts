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
import { formVideoFieldsFor } from "@/lib/form-videos";
import { MESO_BLOCKS, mesoBlockLabel, type MesoBlock } from "@/lib/mesocycle";
import { formatStoredTags, tagsForExercise } from "@/lib/exercise-tags";
import { v2StrengthDays } from "@/lib/v2-lifts";

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
    tags: formatStoredTags(tagsForExercise(input.name)),
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
      tags: formatStoredTags(tagsForExercise(SHADOW_EMPTY_NAME)),
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
      tags: formatStoredTags(tagsForExercise(SHADOW_WEIGHTED_NAME)),
      ...formVideoFieldsFor(SHADOW_WEIGHTED_NAME),
    },
  ];
}

/** Strength catalog for demo-strength-base. Three full-body days per block. */
export function demoStrengthDays() {
  return v2StrengthDays();
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
            tags: formatStoredTags(tagsForExercise(technique.name)),
            ...formVideoFieldsFor(technique.name),
          },
        ]
      : []),
    bagRoundBlock({
      sortOrder: technique ? 4 : 3,
      name: plan.bagName,
      notes: formatBagRoundNotes(plan.rounds, plan.credit),
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
      tags: formatStoredTags(tagsForExercise(SHADOW_COOL_NAME)),
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
