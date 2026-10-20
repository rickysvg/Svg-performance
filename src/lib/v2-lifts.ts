import { DARU_EXERCISES } from "@/lib/daru-exercises";
import { formatStoredTags, tagsForExercise } from "@/lib/exercise-tags";
import { formVideoFieldsFor } from "@/lib/form-videos";
import {
  STRENGTH_DAY_BY_BLOCK,
  mesoBlockLabel,
  type MesoBlock,
} from "@/lib/mesocycle";
import { effortLoadText } from "@/lib/rir";

/** Trailer so one seeded row can carry week 1–3 loads. Stripped before display. */
export const WEEK_MARKER = "@@weeks";

export type WeekDose = {
  sets: number;
  reps: string;
  loadText: string;
  restSeconds: number;
};

export function encodeWeekNotes(notes: string, weeks: [WeekDose, WeekDose, WeekDose]) {
  return `${notes.trim()}\n${WEEK_MARKER}${JSON.stringify(weeks)}`;
}

export function parseWeekDoses(notes?: string | null): WeekDose[] | null {
  if (!notes) return null;
  const index = notes.indexOf(WEEK_MARKER);
  if (index < 0) return null;
  try {
    const parsed = JSON.parse(notes.slice(index + WEEK_MARKER.length)) as unknown;
    if (!Array.isArray(parsed) || parsed.length < 3) return null;
    return parsed.slice(0, 3) as WeekDose[];
  } catch {
    return null;
  }
}

export function keepWeekTrailer(original: string, next?: string | null) {
  const index = original.indexOf(WEEK_MARKER);
  if (index < 0) return next ?? original;
  if (next == null || next === original) return original;
  const trailer = original.slice(index);
  const body = next.replace(/\n?@@weeks[\s\S]*$/, "").trim();
  if (!body) return trailer;
  if (body.includes(WEEK_MARKER)) return body;
  return `${body}\n${trailer}`;
}

export function stripWeekMarker(notes?: string | null) {
  if (!notes) return notes ?? "";
  const index = notes.indexOf(WEEK_MARKER);
  if (index < 0) return notes.trim();
  return notes.slice(0, index).trim();
}

function effort(rir: string, note: string, percent?: string) {
  return effortLoadText(rir, note, percent);
}

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
    loadText: effort(input.rir, input.note, input.percent),
    restSeconds: input.rest,
  };
}

function weeksOf(
  rows: Array<{ sets: number; reps: string; rir: string; note: string; percent?: string }>,
  rest: number,
): [WeekDose, WeekDose, WeekDose] {
  return rows.map((row) => dose({ ...row, rest })) as [WeekDose, WeekDose, WeekDose];
}

/** Main lift. Week 3 is one heavy top set, then back-off sets. Not four sets at 0-1 RIR. */
function mainWeeks(
  reps: [string, string, string],
  rest: number,
  percents: [string, string, string] = [
    "~78% of a 5-rep max",
    "~83% of a 5-rep max",
    "~88% of a 5-rep max",
  ],
): [WeekDose, WeekDose, WeekDose] {
  return weeksOf(
    [
      {
        sets: 4,
        reps: reps[0],
        rir: "2-3",
        percent: percents[0],
        note: "Leave two reps. Bar speed stays even.",
      },
      {
        sets: 4,
        reps: reps[1],
        rir: "1-2",
        percent: percents[1],
        note: "One or two reps left. Still clean.",
      },
      {
        sets: 4,
        reps: reps[2],
        rir: "0-1",
        percent: percents[2],
        note: "Set 1 is the only heavy top set. Sets 2–4 back off to 2-3 RIR at about 78%.",
      },
    ],
    rest,
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
  notes: string;
  weeks: [WeekDose, WeekDose, WeekDose];
}) {
  const visible = input.weeks[0];
  const credit = daruLine(input.name);
  const notes = [input.notes.trim(), credit].filter(Boolean).join(" ");
  return {
    sortOrder: input.sortOrder,
    name: input.name,
    sets: visible.sets,
    reps: visible.reps,
    loadText: visible.loadText,
    restSeconds: visible.restSeconds,
    notes: encodeWeekNotes(`${notes} Written for this week.`, input.weeks),
    tags: formatStoredTags(tagsForExercise(input.name)),
    ...formVideoFieldsFor(input.name),
  };
}

const MAIN_NAME: Record<MesoBlock, string> = {
  A: "Trap-bar deadlift",
  B: "Pause goblet squat",
  C: "Walking lunge",
};

const ROW_NAME: Record<MesoBlock, string> = {
  A: "One-arm row",
  B: "Chest-supported dumbbell row",
  C: "Half-kneeling one-arm row",
};

const PRESS_NAME: Record<MesoBlock, string> = {
  A: "Overhead press",
  B: "Single-arm overhead press",
  C: "Overhead press",
};

const HINGE_NAME: Record<MesoBlock, string> = {
  A: "Single-leg RDL",
  B: "Dumbbell Romanian deadlift",
  C: "Single-leg RDL",
};

function perSide(block: MesoBlock, kind: "row" | "press" | "hinge") {
  if (kind === "row") return block !== "B";
  if (kind === "press") return block === "B";
  return block !== "B";
}

function monday(block: MesoBlock) {
  const days = STRENGTH_DAY_BY_BLOCK[block];
  const rowSide = perSide(block, "row") ? " / side" : "";
  return {
    dayNumber: days.monday,
    title: "Lift 1 — Full body",
    focus: `Lower-strength emphasis · about 45 min · ${mesoBlockLabel(block)}`,
    exercises: {
      create: [
        lift({
          sortOrder: 1,
          name: "Squat jump",
          notes:
            "Explosive primer. The reason for 5 sets is low-rep speed at full intent. Quiet landing. Stop if the knees cave.",
          weeks: weeksOf(
            [1, 2, 3].map(() => ({
              sets: 5,
              reps: "3",
              rir: "3-5",
              note: "Bodyweight. Crisp landings. Leave speed in the tank.",
            })),
            60,
          ),
        }),
        lift({
          sortOrder: 2,
          name: MAIN_NAME[block],
          notes:
            "Main lift. Week 3 is one heavy top set, then back-off sets. Do not grind four sets at 0-1 RIR.",
          weeks: mainWeeks(["5", "4", "3"], 150),
        }),
        lift({
          sortOrder: 3,
          name: "Dumbbell bench press",
          notes:
            "Two dumbbells. Shoulder blades pinned. This is the only bench press on this day.",
          weeks: weeksOf(
            [
              { sets: 4, reps: "6", rir: "2-3", percent: "~70% of a 5-rep max", note: "Press up and in." },
              { sets: 4, reps: "6", rir: "2", percent: "~75% of a 5-rep max", note: "Same bar speed." },
              { sets: 4, reps: "5", rir: "1-2", percent: "~78% of a 5-rep max", note: "Last rep slow and clean." },
            ],
            120,
          ),
        }),
        lift({
          sortOrder: 4,
          name: ROW_NAME[block],
          notes: "Upper pull. Flat back. Pull the elbow toward the hip.",
          weeks: weeksOf(
            [
              {
                sets: 4,
                reps: `8${rowSide}`,
                rir: "2-3",
                percent: "~70% of an 8-rep max",
                note: "Full range. No yank from the low back.",
              },
              {
                sets: 4,
                reps: `8${rowSide}`,
                rir: "2",
                percent: "~75% of an 8-rep max",
                note: "Same setup.",
              },
              {
                sets: 4,
                reps: `6${rowSide}`,
                rir: "1-2",
                percent: "~78% of an 8-rep max",
                note: "Stop when the torso starts to twist.",
              },
            ],
            90,
          ),
        }),
        lift({
          sortOrder: 5,
          name: "Cable woodchop",
          notes: "Rotation slot. Hips turn, spine stays quiet.",
          weeks: weeksOf(
            [
              { sets: 4, reps: "8 / side", rir: "2-3", percent: "~65% of a 10-rep max", note: "Arms stay long." },
              { sets: 4, reps: "8 / side", rir: "2", percent: "~65% of a 10-rep max", note: "Same chop." },
              { sets: 4, reps: "8 / side", rir: "2", percent: "~65% of a 10-rep max", note: "Do not rush the return." },
            ],
            60,
          ),
        }),
        lift({
          sortOrder: 6,
          name: "Neck extension hold",
          notes:
            "Light finisher. 3 sets. Neutral chin, gentle hold, no weight on the neck. Stop if it hurts.",
          weeks: weeksOf(
            [
              { sets: 3, reps: "20 sec", rir: "3", note: "Light band or harness." },
              { sets: 3, reps: "25 sec", rir: "3", note: "Light band or harness." },
              { sets: 3, reps: "30 sec", rir: "3", note: "Light band or harness." },
            ],
            45,
          ),
        }),
      ],
    },
  };
}

function tuesday(block: MesoBlock) {
  const days = STRENGTH_DAY_BY_BLOCK[block];
  const pressSide = perSide(block, "press") ? " / side" : "";
  const pressWeeks =
    block === "C"
      ? mainWeeks(["5", "4", "3"], 120, [
          "~85% of a 5-rep max",
          "~85% of a 5-rep max",
          "~85% of a 5-rep max",
        ])
      : mainWeeks([`5${pressSide}`, `4${pressSide}`, `3${pressSide}`], 120);
  return {
    dayNumber: days.tuesday,
    title: "Lift 2 — Full body",
    focus: `Upper strength and rotational power · about 45 min · ${mesoBlockLabel(block)}`,
    exercises: {
      create: [
        lift({
          sortOrder: 1,
          name: "Rotational med-ball throw",
          notes:
            "Done first, while you are fresh. The reason for 5 sets is low-rep power. Load the back hip and throw hard.",
          weeks: weeksOf(
            [1, 2, 3].map(() => ({
              sets: 5,
              reps: "3 / side",
              rir: "3-5",
              note: "3–4 kg ball. Speed, not a grind.",
            })),
            60,
          ),
        }),
        lift({
          sortOrder: 2,
          name: PRESS_NAME[block],
          notes:
            block === "C"
              ? "Main press. About 85% of a 5-rep max all three weeks. Week 3 is still one heavy top set, then back-offs."
              : "Main press. Week 3 is one heavy top set, then back-off sets.",
          weeks: pressWeeks,
        }),
        lift({
          sortOrder: 3,
          name: "Lat pulldown",
          notes: "Vertical pull. Chest up. Bar to the upper chest.",
          weeks: weeksOf(
            [
              { sets: 4, reps: "8", rir: "2-3", percent: "~70% of an 8-rep max", note: "Control the return." },
              { sets: 4, reps: "6", rir: "2", percent: "~75% of an 8-rep max", note: "Same path." },
              { sets: 4, reps: "5", rir: "1-2", percent: "~80% of an 8-rep max", note: "No lean-back to finish." },
            ],
            90,
          ),
        }),
        lift({
          sortOrder: 4,
          name: "Goblet squat",
          notes: "Lighter lower-body slot so this day stays full body.",
          weeks: weeksOf(
            [
              { sets: 4, reps: "8", rir: "3", percent: "~65% of an 8-rep max", note: "Elbows inside the knees." },
              { sets: 4, reps: "8", rir: "2-3", percent: "~70% of an 8-rep max", note: "Own the bottom." },
              { sets: 4, reps: "8", rir: "2", percent: "~72% of an 8-rep max", note: "Still smooth." },
            ],
            90,
          ),
        }),
        lift({
          sortOrder: 5,
          name: "Landmine rotation",
          notes: "Arms long. Turn from the hips. Pivot the feet.",
          weeks: weeksOf(
            [
              { sets: 4, reps: "6 / side", rir: "2-3", percent: "~70% of an 8-rep max", note: "No yank from the low back." },
              { sets: 4, reps: "6 / side", rir: "2", percent: "~70% of an 8-rep max", note: "Same turn." },
              { sets: 4, reps: "6 / side", rir: "2", percent: "~70% of an 8-rep max", note: "Stay tall." },
            ],
            60,
          ),
        }),
        lift({
          sortOrder: 6,
          name: "Farmer carry",
          notes: "Grip finisher. 3 sets. Tall, shoulders packed, short quick steps.",
          weeks: weeksOf(
            [
              { sets: 3, reps: "40 sec", rir: "2-3", percent: "~50% of bodyweight per hand", note: "Walk tall." },
              { sets: 3, reps: "40 sec", rir: "2-3", percent: "~55% of bodyweight per hand", note: "Walk tall." },
              { sets: 3, reps: "40 sec", rir: "2-3", percent: "~60% of bodyweight per hand", note: "Walk tall." },
            ],
            75,
          ),
        }),
      ],
    },
  };
}

function thursday(block: MesoBlock) {
  const days = STRENGTH_DAY_BY_BLOCK[block];
  const hingeSide = perSide(block, "hinge") ? " / leg" : "";
  const neck = DARU_EXERCISES.find((item) => item.name === "Neck isometric matrix");
  return {
    dayNumber: days.thursday,
    title: "Lift 3 — Light full body",
    focus: `Unilateral, footwork, anti-rotation · about 40 min · no near-max set · ${mesoBlockLabel(block)}`,
    exercises: {
      create: [
        lift({
          sortOrder: 1,
          name: "Lateral bound",
          notes: "Footwork primer. Stick each landing. Stop if the knee caves.",
          weeks: weeksOf(
            [1, 2, 3].map(() => ({
              sets: 4,
              reps: "4 / side",
              rir: "4-5",
              note: "Bodyweight. Stick each landing.",
            })),
            60,
          ),
        }),
        lift({
          sortOrder: 2,
          name: HINGE_NAME[block],
          notes: "Hinge. Stay at the RIR on the line so the legs are fresh for Saturday.",
          weeks: weeksOf(
            [
              {
                sets: 4,
                reps: `6${hingeSide}`,
                rir: "3",
                percent: "~65% of an 8-rep max",
                note: "Hips square.",
              },
              {
                sets: 4,
                reps: `6${hingeSide}`,
                rir: "2-3",
                percent: "~70% of an 8-rep max",
                note: "Soft knee.",
              },
              {
                sets: 4,
                reps: `5${hingeSide}`,
                rir: "2",
                percent: "~75% of an 8-rep max",
                note: "No near-max set on Thursday.",
              },
            ],
            75,
          ),
        }),
        lift({
          sortOrder: 3,
          name: "Dumbbell step-up",
          notes: "Whole foot on the box. Drive the top leg. Do not push off the bottom foot.",
          weeks: weeksOf(
            [
              { sets: 4, reps: "6 / leg", rir: "3", percent: "~65% of an 8-rep max", note: "Control the way down." },
              { sets: 4, reps: "6 / leg", rir: "2-3", percent: "~70% of an 8-rep max", note: "Same box." },
              { sets: 4, reps: "6 / leg", rir: "2", percent: "~72% of an 8-rep max", note: "Stay tall." },
            ],
            75,
          ),
        }),
        lift({
          sortOrder: 4,
          name: "Landmine press",
          notes: "One arm at a time. Elbow in, no back bend. Press up and forward.",
          weeks: weeksOf(
            [
              { sets: 4, reps: "6 / side", rir: "3", percent: "~70% of an 8-rep max", note: "Half-kneeling is fine." },
              { sets: 4, reps: "6 / side", rir: "2-3", percent: "~70% of an 8-rep max", note: "Same angle." },
              { sets: 4, reps: "6 / side", rir: "2", percent: "~70% of an 8-rep max", note: "No near-max set." },
            ],
            75,
          ),
        }),
        lift({
          sortOrder: 5,
          name: "Cable Pallof press",
          notes: "Anti-rotation. Press out and hold about 3 seconds. Resist the twist.",
          weeks: weeksOf(
            [1, 2, 3].map(() => ({
              sets: 4,
              reps: "10 / side",
              rir: "2-3",
              percent: "~60% of a 10-rep max",
              note: "3 second hold. Ribs quiet.",
            })),
            45,
          ),
        }),
        lift({
          sortOrder: 6,
          name: "Suitcase carry",
          notes: "Grip and anti-lateral-flexion finisher. 3 sets. One side loaded. Do not lean.",
          weeks: weeksOf(
            [
              { sets: 3, reps: "30 meters / side", rir: "2-3", percent: "~40% of bodyweight", note: "Stay tall." },
              { sets: 3, reps: "30 meters / side", rir: "2-3", percent: "~45% of bodyweight", note: "Stay tall." },
              { sets: 3, reps: "30 meters / side", rir: "2-3", percent: "~50% of bodyweight", note: "Stay tall." },
            ],
            75,
          ),
        }),
        lift({
          sortOrder: 7,
          name: "Neck isometric matrix",
          notes: `${neck?.notes ?? "Hand resistance. Never a max squeeze."} Optional finisher. 2 sets. Daru's 5-second ramp in four directions stays — not a 10-second hold.`,
          weeks: weeksOf(
            [1, 2, 3].map(() => ({
              sets: 2,
              reps: "5 sec × 4 directions",
              rir: "3",
              note: "Hand resistance. Gentle ramp. Never a max squeeze.",
            })),
            30,
          ),
        }),
      ],
    },
  };
}

/** Three full-body days × three blocks. No Wednesday lift and no Friday GPP. */
export function v2StrengthDays() {
  const blocks: MesoBlock[] = ["A", "B", "C"];
  return blocks.flatMap((block) => [monday(block), tuesday(block), thursday(block)]);
}
