import type { MesoBlock } from "@/lib/mesocycle";

export const SHADOW_EMPTY_NAME = "Shadowbox round 1 — empty hands";
export const SHADOW_WEIGHTED_NAME = "Shadowbox round 2 — hand weights";
export const SHADOW_COOL_NAME = "Easy shadow cool-down";

/** Original SVG copy. Inspired by Bazooka Joe–style unit training, not their scripts. */
export const BAG_THEME_CREDIT =
  "Themed focus rounds in the Bazooka Joe unit-training style. SVG wrote this copy. Not an affiliation or endorsement.";

export type BagTechnique = {
  name: string;
  reps: string;
  loadText: string;
  notes: string;
};

export type BagTheme = {
  label: string;
  theme: string;
  minutesHint: string;
  shadowEmpty: string;
  shadowWeighted: string;
  technique: BagTechnique | null;
  bagName: string;
  rounds: string[];
};

export type BagWeekdayName =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday";

function technique(
  name: string,
  notes: string,
  loadText = "Technical — full shape, no slop",
): BagTechnique {
  return { name, reps: "3:00", loadText, notes };
}

export function formatBagRoundNotes(rounds: readonly string[]) {
  const lines = rounds.map((focus, index) => `R${index + 1} ${focus}`).join(" ");
  return `${lines} ${BAG_THEME_CREDIT}`;
}

/** Split stored bag notes into one line per focus round for the day page and logger. */
export function bagFocusLines(notes: string): { rounds: string[]; credit: boolean } | null {
  if (!/\bR1\s/.test(notes)) return null;
  const body = notes.replace(BAG_THEME_CREDIT, "").trim();
  const rounds = body
    .split(/\s+(?=R\d+\s)/)
    .map((part) => part.trim())
    .filter((part) => /^R\d+\s+\S/.test(part));
  if (rounds.length === 0) return null;
  return { rounds, credit: notes.includes(BAG_THEME_CREDIT) };
}

const A_MON = [
  "Touch jab only. Find the range where the bag moves and the chin stays down.",
  "Double jab. The second jab steps longer. Rear hand stays glued.",
  "Jab the chest line, then a cross only if that jab was clean.",
  "Pawing jab to blind the bag, then a sharp jab behind it.",
  "Body jab, stand tall, head jab. Do not fold at the waist.",
  "Jab, small slip, jab again. Feet reset before the next one.",
  "1-2 only after the jab measures. No arm punches.",
  "Jab on the exit. Punch, step off, jab as you leave.",
  "Up-jab to lift the guard, then a jab downstairs.",
  "Long jab from the outside, then a compact jab once you are in.",
  "Three jabs, three rhythms: patient, patient, snap.",
  "Jab feint, real jab, cross. The feint does not hit.",
  "Every combo starts with the jab and ends with the jab.",
  "Open hands, and the jab still leads. Quality over noise.",
];

const A_TUE = [
  "Lead teep only. Hip behind it. Recover the leg to stance.",
  "Rear teep. Same rule. No punt.",
  "Teep, then a jab. The kick finds the range.",
  "Low kick after the teep. Check your base before the next kick.",
  "Switch step into the teep. Step, do not hop.",
  "Hands 1-2, then a low kick. Guard stays high on the kick.",
  "Teep the bag off you, then step in with a jab.",
  "Inside low kick, then rebuild the stance before you kick again.",
  "Chest teep, then a low kick. High then low on purpose.",
  "Mix teeps and low kicks. No swinging kicks.",
];

const A_WED = [
  "Lead hook only. Pivot the lead foot. Elbow stays near 90 degrees.",
  "Rear hook. Turn the rear heel. Do not arm it.",
  "Jab, then the lead hook. The jab builds the angle.",
  "Pivot off after the hook. Do not stand in the pocket and admire it.",
  "Hook to the body, pivot out, hook upstairs.",
  "1-2-hook. The hook is the exit, not a third arm punch.",
  "Double hook, same side, with a small pivot between them.",
  "Hook, roll the shoulder, hook again. Shoulder stays up.",
  "Step to your left of the bag, lead hook.",
  "Step to your right of the bag, rear hook.",
  "Jab, hook, pivot, jab.",
  "Body hook, head hook, pivot off.",
  "Hooks only after the feet have already moved.",
  "Open boxing. Every hook still earns a pivot.",
];

const A_THU = [
  "Double-collar frame. Posture tall. No knees yet.",
  "Lead knee from the collar. Heel toward the glute. No jump.",
  "Rear knee. Pull the bag down as the hip comes through.",
  "Alternate knees, three total, then reset the posture.",
  "Short elbow, then one knee. The elbow is the setup.",
  "Knee, frame off, step back to a long guard.",
  "Long guard, enter the collar, one knee, exit.",
  "Inside position, knee up the middle. Do not hang.",
  "Knee rhythm with the chest tall. Posture never folds.",
  "Enter, two knees, clean exit. Technical, not a shove.",
];

const A_FRI = [
  "High-guard catches only. See the line, catch, return the hands.",
  "Catch the jab line, fire the cross.",
  "Slip to the outside, return the jab.",
  "Slip to the inside, return the cross.",
  "Roll under, body shot, stand back up.",
  "Parry the lead side, cross behind the parry.",
  "Cover, then 1-2. Do not shell up and freeze.",
  "Small pull back, counter jab, step out.",
  "Slip, 1-2, pivot off the center.",
  "Catch, body jab, cross upstairs.",
  "Roll, hook to the body, hook upstairs.",
  "Parry, step off, 1-2 from the new spot.",
  "One defense, one counter, reset. Do not chase.",
  "Open defense-to-counter. Every shot answers something.",
];

const A_SAT = [
  "Speed jabs. Light and crisp. Optional day — stop if the week is already heavy.",
  "Power 1-2. Full hip, then let the hands rest.",
  "Speed 1-2-3. Snap, do not lean.",
  "One power lead hook with a pivot.",
  "Speed body jab. Stay tall.",
  "Power cross only. Rear heel turns.",
  "Alternate one speed combo and one hard shot.",
  "Jab on the move. Still sharp, still optional.",
  "Power hook, then a jab on the exit.",
  "Easy technical hands. End while the shape is still clean.",
];

const B_MON = [
  "Change level on the jab. Knees bend. The back stays long.",
  "Jab upstairs, dip, jab the body. Stand tall between them.",
  "Level change, then 1-2 upstairs.",
  "Level change, body cross, head jab.",
  "Dip to the outside, body hook, exit.",
  "Fake the level change, throw upstairs.",
  "Real level change right after that fake.",
  "1-2, level change, body jab.",
  "Sit on the lead hook downstairs, come up with the cross.",
  "Three real level changes this round. No bending at the waist.",
  "Jab, change level, cross to the body, stand up.",
  "Exit on a level change, not a lean.",
  "Body, head, body. The level does the work.",
  "Open boxing built on level changes.",
];

const B_TUE = [
  "Switch step with no kick. Just the feet.",
  "Switch into the lead teep.",
  "Switch, teep, jab.",
  "Switch low kick. Land it, then recover the stance.",
  "Jab, switch, low kick.",
  "Teep, switch out, teep again.",
  "Hands first, then the switch kick.",
  "Lift a check, answer with a teep.",
  "Switch knee if you train knees, or a second teep if you do not.",
  "Mix switch teeps and low kicks. The base foot stays quiet.",
];

const B_WED = [
  "Body jab only. Short, from the knees, back long.",
  "Body cross. Rear heel turns. Shoulder stays up.",
  "Head jab, body cross. The jab is the trap.",
  "Body hook, then head hook. Same side.",
  "Level change into the liver-side hook. Technical, not a baseball swing.",
  "1-2 upstairs, body hook, get out.",
  "Body jab, body cross, head jab.",
  "Double body jab, stand up, cross.",
  "Feint the head, attack the body.",
  "Feint the body, attack the head.",
  "Body hook, pivot, jab.",
  "Three body shots, one head shot. Then the reverse.",
  "Do not fold. The bag meets the shoulder, not the forehead.",
  "Open body boxing. Every sequence still has a target line.",
];

const B_THU = [
  "Long 1-2, step into the collar. No knee yet.",
  "1-2, collar, one knee, exit.",
  "Jab, enter, lead knee.",
  "Cross, enter, rear knee.",
  "Body shot, then the clinch. The body shot earns the entry.",
  "Two punches, two knees, frame off.",
  "Miss the entry on purpose and reset the long guard. Do not chase the clinch.",
  "Elbow as you enter, knee once you are settled.",
  "Knees only after the hands have earned the spot.",
  "Punch, clinch, knee, exit. Clean reps.",
];

const B_FRI = [
  "Slip, stay tall, counter jab.",
  "Slip, change level, body cross.",
  "Roll under, body hook, stand into a cross.",
  "Catch, level change, body jab.",
  "Parry, step off, hook.",
  "Pull, counter cross, exit.",
  "Defense, body, head. Three beats.",
  "Imagine a jab, slip, return the 1-2.",
  "Imagine a swing, roll, hook the body.",
  "Cover, 1-2, pivot off.",
  "One defense answer, then the feet move.",
  "Counter the body only this round.",
  "Counter the head only this round.",
  "Open counters. Nothing naked — a defense starts every sequence.",
];

const B_SAT = [
  "Pivot left, jab. Optional day.",
  "Pivot right, cross.",
  "Power hook off the pivot.",
  "Speed hands in place, then one pivot out.",
  "Level change, pivot, jab.",
  "Power 1-2, pivot off.",
  "Hooks only when the feet move.",
  "Body hook, pivot, stand tall.",
  "Switch the pivot side every combo.",
  "Easy hands on the bag. Stop when form drops.",
];

const C_MON = [
  "Body jab as a question. Notice where a guard would drop.",
  "Head jab, then the body jab that was hiding behind it.",
  "Body jab, head cross. Snap the trap. Do not push it.",
  "Double body jab, head jab.",
  "Jab the chest, hook upstairs once the line opens.",
  "Fake the body, real head, real body.",
  "Land the trap, then leave. Do not stand and watch it.",
  "1 to the body, 2 to the head, 3 to the body.",
  "Paw the high line, jab the open line.",
  "Body jab stepping in, head jab on the way out.",
  "Three traps, then one free combo that still starts on purpose.",
  "Same trap, different rhythm.",
  "If the trap misses, the next punch is a jab.",
  "Open hands built from traps, not from random volume.",
];

const C_TUE = [
  "Teep as a counter. Imagine a step-in and push it off.",
  "Check with the leg, answer with a low kick.",
  "Frame, then low kick. The frame is the counter setup.",
  "Jab, low kick as you step the bag.",
  "Teep the body, hook when the foot lands.",
  "Low kick, teep, jab. Kick first.",
  "Switch-kick counter after you exit.",
  "Hands draw the high line, low kick under it.",
  "Counter kicks only. No extra volume.",
  "Mix. Every kick answers a step.",
];

const C_WED = [
  "1-2, step left, jab.",
  "1-2, step right, cross.",
  "1-2-3, pivot off, jab.",
  "Jab, move, jab. Do not lean on the bag.",
  "Four-punch combo, then two steps away before the next one.",
  "Body-head-body while you circle one way.",
  "Reverse the circle. Same combo.",
  "Punch, angle, punch. Never three combos from the same spot.",
  "Five-shot combo, then a full exit to the outside.",
  "Two-shot combo from the new spot.",
  "One idea for the whole round. Not random noise.",
  "Put a level change inside the flow.",
  "Put a pivot inside the flow.",
  "Open flow. If the feet plant and stay, the round is wrong.",
];

const C_THU = [
  "Long-guard frame. Elbows in. No strikes yet.",
  "Horizontal elbow, then pull the bag back to tall posture.",
  "One elbow, one knee.",
  "Elbow, knee, elbow. Short. Then exit.",
  "Knee, frame, step out to jab range.",
  "Enter on a jab, elbow once you are close, knee, leave.",
  "Both knees, then a jab as you separate.",
  "Three seconds in the clinch, then out. Do not hang.",
  "Elbow on the high line, knee on the mid line. Posture stays.",
  "Full sequence: enter, elbow, knee, exit, jab.",
];

const C_FRI = [
  "Parry, cross, step off.",
  "Slip, jab, step off.",
  "Roll, body shot, pivot off.",
  "Catch, 1-2, circle out.",
  "One counter, then a stiff jab or a teep to keep the range.",
  "Two counters maximum, then you must move.",
  "Shell, then exit with no punch. Practice the leave.",
  "One clean counter, then you are done with that sequence.",
  "Body counter, head counter, exit.",
  "Head counter, body counter, exit.",
  "Pivot off the center after every answer.",
  "Counter with the jab only.",
  "Counter with the cross only.",
  "Open counters with an exit on every sequence.",
];

const C_SAT = [
  "Jab IQ — one sharp idea from Block A. Optional day.",
  "Level change — one idea from Block B.",
  "A trap: body, then head.",
  "A pivot hook.",
  "A teep or a low-kick counter.",
  "Punch, then a knee if you clinch, or a jab exit if you do not.",
  "Defense, one counter, leave.",
  "Combo flow: punch, step off, punch.",
  "Repeat your best idea from the week. Stay technical.",
  "Easy hands. Stop when the shape breaks.",
];

export const BAG_THEMES: Record<MesoBlock, Record<BagWeekdayName, BagTheme>> = {
  A: {
    Monday: {
      label: "Bag — intelligent jab",
      theme: "Intelligent jab",
      minutesHint: "Jab IQ rounds",
      shadowEmpty: "Round 1, empty hands. Jab range only: step in, step out, hands home.",
      shadowWeighted: "Round 2, same jab ideas with light hand weights. Log the clock and the lbs.",
      technique: technique(
        "Jab — step and snap",
        "Step with the jab, snap it back, chin stays down. Rear hand does not drop.",
      ),
      bagName: "Bag rounds — intelligent jab",
      rounds: A_MON,
    },
    Tuesday: {
      label: "Bag — teeps and low kicks",
      theme: "Teeps and low kicks",
      minutesHint: "Range kicks",
      shadowEmpty: "Round 1, empty hands plus a light teep chamber. No power yet.",
      shadowWeighted: "Round 2, hand weights on the punches between teep chambers. Log lbs.",
      technique: technique(
        "Teep (push kick)",
        "Chamber the knee, hips behind the kick, recover to stance. Push, do not punt.",
        "Push, do not punt",
      ),
      bagName: "Bag rounds — teeps and low kicks",
      rounds: A_TUE,
    },
    Wednesday: {
      label: "Bag — hooks and pivot",
      theme: "Hooks with a pivot",
      minutesHint: "Hook and pivot rounds",
      shadowEmpty: "Round 1, empty hands. Hook shape and a pivot, no power.",
      shadowWeighted: "Round 2, hand weights. The pivot still happens. Log lbs.",
      technique: technique(
        "Lead hook",
        "Lead hook with a pivot. Elbow near 90 degrees. Do not swing the arm.",
        "90° elbow — pivot the foot",
      ),
      bagName: "Bag rounds — hooks and pivot",
      rounds: A_WED,
    },
    Thursday: {
      label: "Bag — clinch knees",
      theme: "Clinch knees",
      minutesHint: "Short-range knees",
      shadowEmpty: "Round 1, empty hands into a tall collar frame. No jumping knees.",
      shadowWeighted: "Round 2, hand weights on the entry punches, then the frame. Log lbs.",
      technique: technique(
        "Straight knee (clinch)",
        "Pull the bag down as the hip comes forward. Heel toward the glute. No jumping knees.",
        "Hip through, heel to glute",
      ),
      bagName: "Bag rounds — clinch knees",
      rounds: A_THU,
    },
    Friday: {
      label: "Bag — defense and counters",
      theme: "Defense and counters",
      minutesHint: "Slip, cover, answer",
      shadowEmpty: "Round 1, empty hands. Slip and roll with no punches yet.",
      shadowWeighted: "Round 2, hand weights on the counter only. Log lbs.",
      technique: technique(
        "Slip then jab–cross",
        "Imagine the jab, slip, then return the 1-2. Wait, then fire.",
        "Counter tempo — wait, then fire",
      ),
      bagName: "Bag rounds — defense counters",
      rounds: A_FRI,
    },
    Saturday: {
      label: "Bag — speed and power (optional)",
      theme: "Speed and power",
      minutesHint: "Optional speed and power",
      shadowEmpty: "Round 1, empty hands. Short optional warm-up.",
      shadowWeighted: "Round 2, light hand weights. Optional — skip the weights if you are cooked. Log lbs if you use them.",
      technique: null,
      bagName: "Bag rounds — speed and power",
      rounds: A_SAT,
    },
  },
  B: {
    Monday: {
      label: "Bag — level changes",
      theme: "Level changes",
      minutesHint: "Change levels, stay long",
      shadowEmpty: "Round 1, empty hands. Change levels without folding at the waist.",
      shadowWeighted: "Round 2, hand weights. Levels stay in the knees. Log lbs.",
      technique: technique(
        "Level change into the jab",
        "Bend the knees, keep the back long, jab on the way through. Stand tall after it.",
      ),
      bagName: "Bag rounds — level changes",
      rounds: B_MON,
    },
    Tuesday: {
      label: "Bag — switch entries",
      theme: "Switch entries",
      minutesHint: "Switch teep and kick",
      shadowEmpty: "Round 1, empty hands. Switch step, then a light teep chamber.",
      shadowWeighted: "Round 2, hand weights on the punches around the switch. Log lbs.",
      technique: technique(
        "Switch-step teep",
        "Switch the feet, then teep. The step is quiet. The kick pushes.",
      ),
      bagName: "Bag rounds — switch entries",
      rounds: B_TUE,
    },
    Wednesday: {
      label: "Bag — body hooks",
      theme: "Body hooks",
      minutesHint: "Body line after a level change",
      shadowEmpty: "Round 1, empty hands. Body hook shape, elbow stays bent.",
      shadowWeighted: "Round 2, hand weights on the body line. Log lbs.",
      technique: technique(
        "Body hook",
        "Lead hook to the body after a level change. Pivot. Do not sling the arm.",
      ),
      bagName: "Bag rounds — body hooks",
      rounds: B_WED,
    },
    Thursday: {
      label: "Bag — boxing to knees",
      theme: "Boxing into knees",
      minutesHint: "Hands earn the knee",
      shadowEmpty: "Round 1, empty hands. 1-2, then a frame. No knee power yet.",
      shadowWeighted: "Round 2, hand weights on the punches that earn the clinch. Log lbs.",
      technique: technique(
        "Punch into the clinch knee",
        "1-2, step into the collar, one straight knee, exit. The punches earn the spot.",
      ),
      bagName: "Bag rounds — boxing to knees",
      rounds: B_THU,
    },
    Friday: {
      label: "Bag — counters off the level change",
      theme: "Counters off the level change",
      minutesHint: "Defend, change level, answer",
      shadowEmpty: "Round 1, empty hands. Slip, then a level change, no power.",
      shadowWeighted: "Round 2, hand weights on the counter. Log lbs.",
      technique: technique(
        "Roll under then body hook",
        "Roll under an imaginary swing, hook the body, stand into a cross.",
      ),
      bagName: "Bag rounds — level counters",
      rounds: B_FRI,
    },
    Saturday: {
      label: "Bag — pivot power (optional)",
      theme: "Pivot power",
      minutesHint: "Optional pivot power",
      shadowEmpty: "Round 1, empty hands. Pivot off the line.",
      shadowWeighted: "Round 2, light hand weights while you pivot. Log lbs if you use them.",
      technique: null,
      bagName: "Bag rounds — pivot power",
      rounds: B_SAT,
    },
  },
  C: {
    Monday: {
      label: "Bag — body jab traps",
      theme: "Body jab traps",
      minutesHint: "Trap with the jab",
      shadowEmpty: "Round 1, empty hands. Body jab, then the head jab it sets up.",
      shadowWeighted: "Round 2, hand weights. Same trap. Log lbs.",
      technique: technique(
        "Body jab trap",
        "Jab the body to move the guard, then jab or cross upstairs. Snap both.",
      ),
      bagName: "Bag rounds — body jab traps",
      rounds: C_MON,
    },
    Tuesday: {
      label: "Bag — kick counters",
      theme: "Kick counters",
      minutesHint: "Answer with the legs",
      shadowEmpty: "Round 1, empty hands. Check, then a teep shape.",
      shadowWeighted: "Round 2, hand weights on the punches between kicks. Log lbs.",
      technique: technique(
        "Check and answer kick",
        "Lift the check, put the foot down, answer with a low kick or a teep.",
      ),
      bagName: "Bag rounds — kick counters",
      rounds: C_TUE,
    },
    Wednesday: {
      label: "Bag — combo flow",
      theme: "Combo flow with movement",
      minutesHint: "Punch, move, punch",
      shadowEmpty: "Round 1, empty hands. A combo, then a step off, then another jab.",
      shadowWeighted: "Round 2, hand weights. Feet still move between combos. Log lbs.",
      technique: technique(
        "Boxing step-off combo",
        "1-2-3, step off the line, jab from the new spot. Do not plant and unload.",
      ),
      bagName: "Bag rounds — combo flow",
      rounds: C_WED,
    },
    Thursday: {
      label: "Bag — elbows and knees",
      theme: "Elbows, knees, and the exit",
      minutesHint: "Short strikes, then leave",
      shadowEmpty: "Round 1, empty hands. Frame, elbow shape, tall posture.",
      shadowWeighted: "Round 2, hand weights on the entry. Log lbs.",
      technique: technique(
        "Elbow then knee",
        "Short elbow, then a straight knee, then a frame off the bag.",
      ),
      bagName: "Bag rounds — elbow and knee",
      rounds: C_THU,
    },
    Friday: {
      label: "Bag — counter then exit",
      theme: "Counter, then leave",
      minutesHint: "Answer once, then move",
      shadowEmpty: "Round 1, empty hands. Parry, then show the exit step.",
      shadowWeighted: "Round 2, hand weights on the counter punch. Log lbs.",
      technique: technique(
        "Parry and cross",
        "Parry the lead side, cross, step off. The counter includes the exit.",
      ),
      bagName: "Bag rounds — counter then exit",
      rounds: C_FRI,
    },
    Saturday: {
      label: "Bag — three-block review (optional)",
      theme: "Review the three blocks",
      minutesHint: "Optional review",
      shadowEmpty: "Round 1, empty hands. Touch the jab, a level change, and an exit.",
      shadowWeighted: "Round 2, light hand weights. Optional. Log lbs if you use them.",
      technique: null,
      bagName: "Bag rounds — theme review",
      rounds: C_SAT,
    },
  },
};
