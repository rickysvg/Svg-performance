/**
 * Off-season 3-week block. Week doses live in the exercise notes.
 * Block A is the research template. Blocks B and C keep the same order
 * and swap in library lifts that have a form clip.
 */
import { DARU_EXERCISES } from "@/lib/daru-exercises";
import { formatStoredTags, tagsForExercise } from "@/lib/exercise-tags";
import { formVideoFieldsFor } from "@/lib/form-videos";
import {
  FRIDAY_CONDITIONING_LABEL,
  STRENGTH_DAY_BY_BLOCK,
  mesoBlockLabel,
  type MesoBlock,
} from "@/lib/mesocycle";
import { effortLoadText } from "@/lib/rir";
import { clampSetRestSeconds } from "@/lib/set-rest";
import {
  encodeWeekNotes,
  type CatalogSlot,
  type WeekDose,
} from "@/lib/v2-lifts";

function dose(input: {
  sets: number;
  reps: string;
  rir: string;
  note: string;
  percent?: string;
  rest: number;
}): WeekDose {
  return {
    sets: input.sets,
    reps: input.reps,
    loadText: effortLoadText(input.rir, input.note, input.percent),
    restSeconds: clampSetRestSeconds(input.rest),
  };
}

function weeksOf(
  rows: Array<{ sets: number; reps: string; rir: string; note: string; percent?: string }>,
  rest: number,
): [WeekDose, WeekDose, WeekDose] {
  return rows.map((row) => dose({ ...row, rest })) as [WeekDose, WeekDose, WeekDose];
}

function same(
  sets: number,
  reps: string,
  rir: string,
  note: string,
  rest: number,
  percent?: string,
): [WeekDose, WeekDose, WeekDose] {
  return weeksOf([0, 1, 2].map(() => ({ sets, reps, rir, note, percent })), rest);
}

function wave(
  reps: [string, string, string],
  rir: [string, string, string],
  note: string,
  rest: number,
  percent?: [string, string, string],
  sets: [number, number, number] = [4, 4, 4],
): [WeekDose, WeekDose, WeekDose] {
  return weeksOf(
    [0, 1, 2].map((index) => ({
      sets: sets[index],
      reps: reps[index],
      rir: rir[index],
      note,
      percent: percent?.[index],
    })),
    rest,
  );
}

/** Heaviest lift of the block. 78 / 83 / 88% of a 5-rep max. Week 3 is 0–1 RIR. */
function mainWave(reps: [string, string, string], rest: number): [WeekDose, WeekDose, WeekDose] {
  return wave(
    reps,
    ["2-3", "1-2", "0-1"],
    "Move the bar fast. Stop if speed dies.",
    rest,
    ["~78% of a 5-rep max", "~83% of a 5-rep max", "~88% of a 5-rep max"],
  );
}

function daruLine(name: string) {
  const row = DARU_EXERCISES.find((item) => item.name === name);
  if (!row) return "";
  const sentence = row.notes.split(". ")[0] ?? "";
  return sentence.endsWith(".") ? sentence : `${sentence}.`;
}

function lift(input: {
  sortOrder: number;
  name: string;
  intent: string;
  notes?: string;
  weeks: [WeekDose, WeekDose, WeekDose];
  slot: CatalogSlot;
  main?: boolean;
  lift3?: boolean;
}) {
  const visible = input.weeks[0];
  const credit = daruLine(input.name);
  const notes = [`Intent: ${input.intent}.`, input.notes?.trim(), credit, "Written for this week."]
    .filter(Boolean)
    .join(" ");
  return {
    sortOrder: input.sortOrder,
    name: input.name,
    sets: visible.sets,
    reps: visible.reps,
    loadText: visible.loadText,
    restSeconds: visible.restSeconds,
    notes: encodeWeekNotes(notes, input.weeks, {
      slot: input.slot,
      main: input.main,
      lift3: input.lift3,
    }),
    tags: formatStoredTags(tagsForExercise(input.name)),
    ...formVideoFieldsFor(input.name),
  };
}

const PERCENT_8 = ["~70% of an 8-rep max", "~75% of an 8-rep max", "~78% of an 8-rep max"] as [
  string,
  string,
  string,
];

function warmup(sortOrder: number, name: string, intent: string) {
  return lift({
    sortOrder,
    name,
    intent,
    slot: "warmup",
    notes: "Complex warm-up, about 8 min. Easy range. Stop if a joint pinches.",
    weeks: same(2, "6 / side", "3-5", "Easy. This is not the workout.", 20),
  });
}

function power(input: {
  sortOrder: number;
  name: string;
  intent: string;
  reps: string;
  rest?: number;
  notes?: string;
}) {
  return lift({
    sortOrder: input.sortOrder,
    name: input.name,
    intent: input.intent,
    slot: "power",
    notes: input.notes ?? "Power. Full intent, leave speed in the tank.",
    weeks: same(4, input.reps, "3-5", "Crisp reps. Stop when the landing gets loud.", input.rest ?? 60),
  });
}

type Menu = {
  main: string;
  mainReps: [string, string, string];
  mainIntent: string;
  press: string;
  pressReps: [string, string, string];
  pressIntent: string;
  pull: string;
  pullReps: string;
  pullIntent: string;
  squat: string;
  squatIntent: string;
  hinge: string;
  hingeIntent: string;
  lunge: string;
  lungeIntent: string;
};

const MENUS: Record<MesoBlock, Menu> = {
  A: {
    main: "Trap-bar deadlift",
    mainReps: ["5", "4", "3"],
    mainIntent: "Push the floor away fast",
    press: "Dumbbell bench press",
    pressReps: ["8", "7", "6"],
    pressIntent: "Press up and in",
    pull: "One-arm row",
    pullReps: "8 / side",
    pullIntent: "Elbow to hip",
    squat: "Goblet squat",
    squatIntent: "Sit between the heels",
    hinge: "Single-leg RDL",
    hingeIntent: "Hips square",
    lunge: "Reverse lunge",
    lungeIntent: "Drive the front heel",
  },
  B: {
    main: "Zercher squat",
    mainReps: ["4", "3", "3"],
    mainIntent: "Elbows tight, chest tall",
    press: "Push press",
    pressReps: ["4", "3", "3"],
    pressIntent: "Drive with the legs, punch the bar up",
    pull: "Pull-up",
    pullReps: "6",
    pullIntent: "Chest to the bar",
    squat: "Goblet squat",
    squatIntent: "Sit between the heels",
    hinge: "Nordic hamstring curl",
    hingeIntent: "Lower as slowly as you can",
    lunge: "Bulgarian split squat",
    lungeIntent: "Front heel drives",
  },
  C: {
    main: "Sandbag front squat",
    mainReps: ["6", "5", "4"],
    mainIntent: "Bear-hug the bag, stay upright",
    press: "Kettlebell push press",
    pressReps: ["6 / side", "5 / side", "4 / side"],
    pressIntent: "Dip, drive, lock out",
    pull: "Neutral-grip pull-up",
    pullReps: "6",
    pullIntent: "Pull to the chest",
    squat: "Goblet squat",
    squatIntent: "Sit between the heels",
    hinge: "Single-leg RDL",
    hingeIntent: "Hips square",
    lunge: "Bulgarian split squat",
    lungeIntent: "Front heel drives",
  },
};

function monday(block: MesoBlock) {
  const menu = MENUS[block];
  const days = STRENGTH_DAY_BY_BLOCK[block];
  return {
    dayNumber: days.monday,
    title: "Lift 1 — Full body",
    focus: `Lower strength. Warm-up, power, strength, then an 8-min density block. ${mesoBlockLabel(block)}`,
    exercises: {
      create: [
        warmup(1, "90/90 hip switches", "Loose hips, tall chest"),
        power({ sortOrder: 2, name: "Squat jump", intent: "Jump tall, land quiet", reps: "3" }),
        lift({
          sortOrder: 3,
          name: menu.main,
          intent: menu.mainIntent,
          slot: "strength",
          main: true,
          notes: "Main lift. Pair it with the jump. Week 3 is the heavy week.",
          weeks: mainWave(menu.mainReps, 90),
        }),
        lift({
          sortOrder: 4,
          name: "Broad jump",
          intent: "Stick it",
          slot: "contrast",
          notes: "Contrast for intermediate and advanced. Rest with the main lift, 90s.",
          weeks: same(4, "2", "3-5", "Bodyweight. Stick the landing.", 60),
        }),
        lift({
          sortOrder: 5,
          name: "Trap-bar jump",
          intent: "Light bar, snap and land quiet",
          slot: "french",
          notes: "French contrast, advanced and off-season only. Loaded jump between the heavy pull and the broad jump.",
          weeks: same(4, "3", "3-5", "About 30% of the deadlift. Speed, not a grind.", 60, "~30% of a 5-rep max"),
        }),
        lift({
          sortOrder: 6,
          name: "Dumbbell bench press",
          intent: "Press up and in",
          slot: "strength",
          notes: "Upper press. Beginners log the floor version. Intermediate and advanced stay on the bench.",
          weeks: wave(["8", "7", "6"], ["2-3", "2", "1-2"], "Press up and in.", 90, PERCENT_8),
        }),
        lift({
          sortOrder: 7,
          name: menu.pull,
          intent: menu.pullIntent,
          slot: "strength",
          notes: "Upper pull. Same effort as the press.",
          weeks: wave(
            [menu.pullReps, menu.pullReps, menu.pullReps],
            ["2-3", "2", "1-2"],
            menu.pullIntent,
            60,
            PERCENT_8,
          ),
        }),
        lift({
          sortOrder: 8,
          name: "Farmer carry",
          intent: "Tall, packed",
          slot: "density",
          notes: "8-min density block with the neck matrix. Add a round in week 2 and week 3 if the walk stays tall.",
          weeks: wave(
            ["30 m", "30 m", "30 m"],
            ["2-3", "2-3", "2-3"],
            "Heavy. Short quick steps.",
            45,
            ["~50% of bodyweight per hand", "~55% of bodyweight per hand", "~60% of bodyweight per hand"],
            [4, 5, 6],
          ),
        }),
        lift({
          sortOrder: 9,
          name: "Neck isometric matrix",
          intent: "No movement",
          slot: "density",
          notes: "Same 8-min block as the carry. Four directions, light. Never a max squeeze.",
          weeks: same(4, "10 sec × 4 directions", "3-5", "30–50% effort. Hand on the head.", 30),
        }),
      ],
    },
  };
}

function tuesday(block: MesoBlock) {
  const menu = MENUS[block];
  const days = STRENGTH_DAY_BY_BLOCK[block];
  const pressIsMain = block !== "A";
  return {
    dayNumber: days.tuesday,
    title: "Lift 2 — Full body",
    focus: `Upper strength and rotational power. Shadow and themed bag rounds sit on the skill day. ${mesoBlockLabel(block)}`,
    exercises: {
      create: [
        warmup(1, "Shoulder circles", "Slow big circles"),
        power({
          sortOrder: 2,
          name: "Rotational med-ball throw",
          intent: "Hips first, throw through the wall",
          reps: "4 / side",
          notes: "3–4 kg ball. 3–5 RIR. Speed, not a grind.",
        }),
        power({
          sortOrder: 3,
          name: "Med-ball chest pass",
          intent: "Step and punch it",
          reps: "4",
          notes: "3–5 RIR. No pause at the chest.",
        }),
        lift({
          sortOrder: 4,
          name: block === "A" ? "Landmine press" : menu.press,
          intent: block === "A" ? "Reach through, ribs down" : menu.pressIntent,
          slot: "strength",
          main: true,
          notes: pressIsMain
            ? "Main press this block. Week 3 stays off 0 RIR on the single-arm variation."
            : "Main press. Half-kneeling is fine. Week 3 is 1 RIR, not a miss.",
          weeks:
            block === "A"
              ? wave(
                  ["6 / side", "5 / side", "4 / side"],
                  ["2-3", "1-2", "1"],
                  "Reach through, ribs down.",
                  120,
                  ["~75% of a 6-rep max", "~80% of a 6-rep max", "~85% of a 6-rep max"],
                )
              : mainWave(menu.pressReps, 90),
        }),
        lift({
          sortOrder: 5,
          name: menu.squat,
          intent: menu.squatIntent,
          slot: "strength",
          notes: "Lighter lower-body slot so the day stays full body.",
          weeks: wave(["8", "8", "8"], ["2-3", "2", "1-2"], menu.squatIntent, 90, PERCENT_8),
        }),
        lift({
          sortOrder: 6,
          name: block === "C" ? menu.pull : "Chest-supported dumbbell row",
          intent: block === "C" ? menu.pullIntent : "Squeeze, pause",
          slot: "strength",
          notes: "Upper pull. Chest stays on the pad when it is a row.",
          weeks: same(4, block === "C" ? menu.pullReps : "10", "2", "Squeeze, pause.", 60, "~70% of an 8-rep max"),
        }),
        lift({
          sortOrder: 7,
          name: "Landmine rotation",
          intent: "Turn from hips",
          slot: "density",
          notes: "8-min density block with the Pallof. Anti-rotation pair.",
          weeks: same(4, "6 / side", "2-3", "Arms long. Pivot the feet.", 45),
        }),
        lift({
          sortOrder: 8,
          name: "Cable Pallof press",
          intent: "Don't let it turn you",
          slot: "density",
          notes: "Same 8-min block. Press out and hold.",
          weeks: same(4, "10 sec / side", "2-3", "Ribs quiet.", 45),
        }),
      ],
    },
  };
}

function thursday(block: MesoBlock) {
  const menu = MENUS[block];
  const days = STRENGTH_DAY_BY_BLOCK[block];
  return {
    dayNumber: days.thursday,
    title: "Lift 3 — Light full body",
    focus: `Unilateral and anti-rotation. No 0 RIR set. Protect Saturday sparring. ${mesoBlockLabel(block)}`,
    exercises: {
      create: [
        warmup(1, "Ankle circles", "Slow full circles"),
        power({
          sortOrder: 2,
          name: "Lateral bound",
          intent: "Push sideways, hold",
          reps: "3 / side",
          notes: "Footwork. Stick 1 second. 3–5 RIR.",
        }),
        lift({
          sortOrder: 3,
          name: menu.hinge,
          intent: menu.hingeIntent,
          slot: "strength",
          main: true,
          lift3: true,
          notes: "Main hinge. Stay at the RIR on the line. Never a 0 RIR set on this day.",
          weeks: wave(
            ["6 / side", "6 / side", "6 / side"],
            ["3", "2", "2"],
            "Stay at the RIR on the line.",
            90,
            PERCENT_8,
          ),
        }),
        lift({
          sortOrder: 4,
          name: menu.lunge,
          intent: menu.lungeIntent,
          slot: "strength",
          lift3: true,
          notes: "Unilateral. No grind.",
          weeks: wave(
            ["6 / side", "6 / side", "6 / side"],
            ["3", "2", "2"],
            menu.lungeIntent,
            90,
            PERCENT_8,
          ),
        }),
        lift({
          sortOrder: 5,
          name: "Single-arm overhead press",
          intent: "No side lean",
          slot: "strength",
          lift3: true,
          notes: "One bell. Ribs stacked.",
          weeks: wave(
            ["6 / side", "6 / side", "6 / side"],
            ["2-3", "2", "2"],
            "No side lean.",
            75,
            ["~70% of an 8-rep max", "~70% of an 8-rep max", "~70% of an 8-rep max"],
          ),
        }),
        lift({
          sortOrder: 6,
          name: "Half-kneeling one-arm row",
          intent: "Row to the hip",
          slot: "strength",
          lift3: true,
          weeks: same(4, "10 / side", "2", "Tall half-kneel.", 60, "~70% of an 8-rep max"),
        }),
        lift({
          sortOrder: 7,
          name: "Suitcase carry",
          intent: "Don't lean",
          slot: "density",
          notes: "8-min density block with the side plank and face pull.",
          weeks: wave(
            ["20 m / side", "20 m / side", "20 m / side"],
            ["2-3", "2-3", "2"],
            "One side loaded.",
            45,
            undefined,
            [4, 5, 6],
          ),
        }),
        lift({
          sortOrder: 8,
          name: "Side plank",
          intent: "Hips high",
          slot: "density",
          weeks: same(4, "20 sec / side", "2-3", "Stack the shoulders.", 30),
        }),
        lift({
          sortOrder: 9,
          name: "Face pull",
          intent: "Thumbs back",
          slot: "density",
          weeks: same(4, "12", "2-3", "Pull to the face.", 30),
        }),
      ],
    },
  };
}

function friday(block: MesoBlock) {
  const days = STRENGTH_DAY_BY_BLOCK[block];
  return {
    dayNumber: days.friday,
    title: FRIDAY_CONDITIONING_LABEL,
    focus: `General prep. 2–3 RIR, nothing to failure. Off-season. ${mesoBlockLabel(block)}`,
    exercises: {
      create: [
        lift({
          sortOrder: 1,
          name: "Kettlebell swing",
          intent: "Hinge, snap the hips",
          slot: "gpp",
          notes: "Week 3 uses a heavier bell if the hinge stays sharp.",
          weeks: wave(["12", "15", "15"], ["2-3", "2-3", "2-3"], "The bell floats. Do not squat it.", 60),
        }),
        lift({
          sortOrder: 2,
          name: "Walking lunge",
          intent: "Long step, torso tall",
          slot: "gpp",
          weeks: same(4, "10 / side", "2-3", "Back knee kisses the floor.", 60),
        }),
        lift({
          sortOrder: 3,
          name: "Dumbbell high pull",
          intent: "Hips drive, elbows high",
          slot: "gpp",
          weeks: same(4, "8", "3", "Fast. Not an upright-row grind.", 60),
        }),
        lift({
          sortOrder: 4,
          name: "Cable woodchop",
          intent: "Rotate the torso, arms stay long",
          slot: "gpp",
          weeks: same(4, "8 / side", "2-3", "Hips turn. Spine stays quiet.", 45),
        }),
        lift({
          sortOrder: 5,
          name: "Dead bug",
          intent: "Low back pressed down",
          slot: "gpp",
          weeks: same(4, "8 / side", "2-3", "Move slowly.", 30),
        }),
        lift({
          sortOrder: 6,
          name: "Jump rope",
          intent: "Small bounces, wrists turn the rope",
          slot: "gpp",
          notes: "Work 2 min, easy 1 min. Week 3 adds a round.",
          weeks: wave(["2:00", "2:00", "2:00"], ["3-5", "3-5", "3-5"], "Smooth. Misses mean slow down.", 60, undefined, [4, 4, 5]),
        }),
        lift({
          sortOrder: 7,
          name: "Bent-over DB shrug",
          intent: "Shrug up and back",
          slot: "gpp",
          weeks: same(4, "12", "2-3", "Hinge. No arm bend.", 45),
        }),
        lift({
          sortOrder: 8,
          name: "Neck extension hold",
          intent: "Neutral chin, gentle hold",
          slot: "gpp",
          notes: "No weight on the neck. Skip it if the neck is sore from class.",
          weeks: same(4, "15 sec", "3-5", "Gentle. No weight.", 30),
        }),
      ],
    },
  };
}

export function catalogStrengthDays() {
  const blocks: MesoBlock[] = ["A", "B", "C"];
  return blocks.flatMap((block) => [monday(block), tuesday(block), thursday(block), friday(block)]);
}
