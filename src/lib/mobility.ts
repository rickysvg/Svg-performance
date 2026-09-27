/**
 * SVG mobility routines. Instructions are SVG's words.
 * Coaches are credited as the source of an idea, with a link to their own
 * channel or site. Not an SVG reprint of their program, and not an endorsement.
 *
 * Streak hook (do not build badges here): a completed MobilitySession with
 * durationSeconds >= MOBILITY_STREAK_MIN_SECONDS can later count toward the
 * daily streak and a Mobility badge group. See MOBILITY_STREAK_MIN_SECONDS.
 */
import type { CatalogPlanId } from "@/lib/plans";
import { planHasFeature } from "@/lib/plans";
import { mondayOfZoned } from "@/lib/timezone";
import { APP_TIMEZONE } from "@/lib/timezone";
import { COOLDOWN_ID, DAILY_WARMUP_ID } from "@/lib/session-bookends";

export const MOBILITY_STREAK_MIN_SECONDS = 8 * 60;

export const MOBILITY_DISCLAIMER =
  "Exercises inspired by publicly shared work from the coaches credited. SVG Performance is not affiliated with or endorsed by them.";

export type MobilityCredit = {
  coach: string;
  url: string;
  idea: string;
};

export type MobilityTrack = "none" | "depth" | "height";

export type MobilityBlock = {
  key: string;
  name: string;
  cues: string;
  sides: "none" | "each";
  timerSeconds: number;
  repeats: number;
  prescription: string;
  sets: number;
  reps: number | null;
  holdSeconds: number | null;
  track: MobilityTrack;
  advanced: boolean;
};

export type MobilityRoutine = {
  id: string;
  title: string;
  minutesLabel: string;
  summary: string;
  when: string;
  access: "free" | "pro";
  listed: boolean;
  blocks: MobilityBlock[];
  credits: MobilityCredit[];
};

export type PlayStep = {
  id: string;
  blockKey: string;
  name: string;
  cues: string;
  side: "" | "left" | "right";
  sideLabel: string;
  seconds: number;
  prescription: string;
  repeatLabel: string;
  advanced: boolean;
  nextName: string;
};

export type MobilityLogRow = {
  exerciseKey: string;
  name: string;
  side: "" | "left" | "right";
  sideLabel: string;
  prescription: string;
  track: MobilityTrack;
  showHold: boolean;
  showReps: boolean;
  showSets: boolean;
};

type BlockInput = {
  key: string;
  name: string;
  cues: string;
  sides?: "none" | "each";
  timerSeconds: number;
  repeats?: number;
  prescription: string;
  sets?: number;
  reps?: number | null;
  holdSeconds?: number | null;
  track?: MobilityTrack;
  advanced?: boolean;
};

function block(input: BlockInput): MobilityBlock {
  return {
    key: input.key,
    name: input.name,
    cues: input.cues,
    sides: input.sides ?? "none",
    timerSeconds: input.timerSeconds,
    repeats: input.repeats ?? 1,
    prescription: input.prescription,
    sets: input.sets ?? 1,
    reps: input.reps ?? null,
    holdSeconds: input.holdSeconds ?? null,
    track: input.track ?? "none",
    advanced: input.advanced ?? false,
  };
}

const SPINA_CHANNEL = "https://www.youtube.com/user/AndreoSpina";
const KURZ = "https://www.usadojo.com/5-stretch-yourself-right-stretches-for-high-kicks/";
const WALLACE =
  "https://www.blackbeltmag.com/post/bill-superfoot-wallace-s-10-key-strategies-to-become-a-martial-arts-champion";
const GMB_KICK = "https://gmb.io/muay-thai-mobility-routine/";
const GMB_BJJ = "https://gmb.io/bjj-mobility/";
const THOMPSON = "https://www.youtube.com/watch?v=Cj-exEvpmbI";
const MERRICK_FRONT = "https://www.bodyweightwarrior.co.uk/blog/20-min-front-split-flexibility-routine/";
const MERRICK_MIDDLE = "https://www.youtube.com/watch?v=pq3X3Gl4nzE";
const VAN_DAMME = "https://www.youtube.com/playlist?list=PL3vSFI-d4Fctp7WT9lIrgCjWZU3S35a0p";
const IDO_SQUAT = "https://www.youtube.com/watch?v=xPwG2hqnOx0";
const IDO_HANG = "https://www.idoportal.com/blog/hanging/";
const STARRETT = "https://www.youtube.com/watch?v=ulgAOykAgV4";
const CAVALIERE = "https://www.youtube.com/watch?v=7dT4KHtMM-A";
const VALD = "https://valdperformance.com/news/neck-coupling-strength-in-mma-testing-what-matters";
const NERO = "https://www.youtube.com/watch?v=j9Ap1CIqjgk";
const KYOKUSHIN = "https://jaapkooman.nl/karate/junbi_undo/junbi.html";
const FRC_SITE = "https://functionalanatomyseminars.com/";

export const MOBILITY_ROUTINES: MobilityRoutine[] = [
  {
    id: "kickers-hips",
    title: "Kicker's Hips",
    minutesLabel: "about 10 min",
    summary: "Dynamic hip work for kick height. Lift the leg. Do not throw it.",
    when: "Morning or before training",
    access: "free",
    listed: true,
    credits: [
      { coach: "Andreo Spina (FRC)", url: SPINA_CHANNEL, idea: "hip circles you control" },
      { coach: "Thomas Kurz", url: KURZ, idea: "lifted leg raises" },
      { coach: "GMB Fitness", url: GMB_KICK, idea: "knee-to-chest and lunge to knee" },
      { coach: "Bill Wallace", url: WALLACE, idea: "slow kicks with a chair, and opening the hip" },
      { coach: "Stephen Thompson", url: THOMPSON, idea: "pivot the base foot" },
      { coach: "Nermin “Nero” Mehmedagić (@neromma)", url: NERO, idea: "hip mobility for kicks" },
    ],
    blocks: [
      block({
        key: "hip-cars",
        name: "Hip circles",
        sides: "each",
        timerSeconds: 40,
        prescription: "3 slow reps each direction",
        sets: 1,
        reps: 3,
        cues: "Stand on one leg and brace. Draw the biggest slow circle you can with the knee: lift, open out, reach back, then turn in. Keep the chest quiet.",
      }),
      block({
        key: "front-raise",
        name: "Front leg raise",
        sides: "each",
        timerSeconds: 40,
        prescription: "2 sets × 12",
        sets: 2,
        reps: 12,
        track: "height",
        cues: "Stand tall and lift the leg. Straight knee. Start low and only go as high as you can still control. Stop the set when the height drops.",
      }),
      block({
        key: "side-raise",
        name: "Side leg raise",
        sides: "each",
        timerSeconds: 40,
        prescription: "2 sets × 12",
        sets: 2,
        reps: 12,
        track: "height",
        cues: "Lift the leg out to the side. Toes can turn up a little. Do not lean away to cheat the height.",
      }),
      block({
        key: "back-raise",
        name: "Back leg raise",
        sides: "each",
        timerSeconds: 35,
        prescription: "2 sets × 12",
        sets: 2,
        reps: 12,
        cues: "Hinge slightly and lift the leg behind you. Think long, not a high throw.",
      }),
      block({
        key: "knee-chest",
        name: "Standing knee to chest",
        sides: "each",
        timerSeconds: 30,
        prescription: "5 reps",
        sets: 1,
        reps: 5,
        cues: "Pull the knee high and let the hips come forward. Pause at the top. Put the foot down with control.",
      }),
      block({
        key: "lunge-knee",
        name: "Lunge to knee strike",
        sides: "each",
        timerSeconds: 30,
        prescription: "5 reps",
        sets: 1,
        reps: 5,
        cues: "From a short lunge, rise into a controlled knee. Hands up. This is a smooth rise, not a sparring knee.",
      }),
      block({
        key: "chair-round",
        name: "Chair-supported slow roundhouse",
        sides: "each",
        timerSeconds: 40,
        prescription: "10 reps",
        sets: 1,
        reps: 10,
        cues: "Hold a chair. Chamber slow and extend a slow roundhouse. Turn the standing heel toward the target so the hip can open.",
      }),
      block({
        key: "chair-side",
        name: "Chair-supported slow side kick",
        sides: "each",
        timerSeconds: 40,
        prescription: "10 reps",
        sets: 1,
        reps: 10,
        cues: "Same chair. Lift the knee, then press the heel out slowly. Bring it home before the next one.",
      }),
      block({
        key: "pivot-shadow",
        name: "Pivot-and-open shadow kicks",
        sides: "each",
        timerSeconds: 30,
        repeats: 2,
        prescription: "2 rounds × 30 s",
        sets: 2,
        cues: "Shadow a slow kick and pivot the base foot. Stay tall. Speed stays low until the range is easy.",
      }),
    ],
  },
  {
    id: "split-builder",
    title: "Hamstring & Split Builder",
    minutesLabel: "about 12 min",
    summary: "Longer holds after you are warm. Build the split. Do not force the knee.",
    when: "After training or in the evening",
    access: "pro",
    listed: true,
    credits: [
      { coach: "Jean-Claude Van Damme", url: VAN_DAMME, idea: "a short wall hang for the back line" },
      { coach: "GMB Fitness", url: GMB_KICK, idea: "foot-on-support hamstring work" },
      { coach: "Tom Merrick", url: MERRICK_FRONT, idea: "front-split building blocks" },
      { coach: "Tom Merrick", url: MERRICK_MIDDLE, idea: "middle-split follow-along" },
      { coach: "Andreo Spina (FRC)", url: FRC_SITE, idea: "end-range push and pull" },
    ],
    blocks: [
      block({
        key: "wall-hang",
        name: "Wall hang",
        timerSeconds: 15,
        repeats: 3,
        prescription: "3 holds × 8–15 s",
        sets: 3,
        holdSeconds: 12,
        cues: "Hands on a wall, walk the feet back, flat back, head between the arms. Soft knees if the low back rounds. Breathe out as you lengthen.",
      }),
      block({
        key: "foot-support",
        name: "Foot-on-support hamstring",
        sides: "each",
        timerSeconds: 45,
        prescription: "8 rocks, then a 30 s hold",
        sets: 1,
        reps: 8,
        holdSeconds: 30,
        cues: "Heel on a low support. Rock the hips in and out eight times, then hold about 30 seconds. Keep the standing knee soft.",
      }),
      block({
        key: "half-split",
        name: "Half split",
        sides: "each",
        timerSeconds: 45,
        repeats: 2,
        prescription: "2 holds × 45 s",
        sets: 2,
        holdSeconds: 45,
        track: "depth",
        cues: "Front leg long, back knee down. Hips square. Fold only as far as the front knee stays straight without locking hard.",
      }),
      block({
        key: "frog-rocks",
        name: "Frog rocks",
        timerSeconds: 40,
        prescription: "10 reps",
        sets: 1,
        reps: 10,
        cues: "Knees wide, hips back toward the heels, then shift forward a little. Stay on the knees, not the neck.",
      }),
      block({
        key: "straddle-lean",
        name: "Straddle lean",
        timerSeconds: 60,
        prescription: "1 hold × 60 s",
        sets: 1,
        holdSeconds: 60,
        track: "depth",
        cues: "Seated straddle. Lean the chest forward with a long spine. Note how far the hips sit from the floor if you want a number.",
      }),
      block({
        key: "pails-rails",
        name: "Straddle push and pull",
        timerSeconds: 150,
        prescription: "1 set: 2 min hold, 15 s push, 15 s pull",
        sets: 1,
        holdSeconds: 120,
        cues: "Hold the straddle you already have for about 2 minutes. Press the inner thighs down into the floor and build that push over about 15 seconds. Then use the outer hip to pull a little deeper for about 15 seconds. Skip this on back-to-back days.",
      }),
    ],
  },
  {
    id: "ankle-knee",
    title: "Ankle & Knee",
    minutesLabel: "about 8 min",
    summary: "Ankles, a deep squat, and a quiet single-leg balance.",
    when: "Any easy day",
    access: "pro",
    listed: true,
    credits: [
      { coach: "Andreo Spina (FRC)", url: SPINA_CHANNEL, idea: "ankle circles" },
      { coach: "Ido Portal", url: IDO_SQUAT, idea: "time in a deep resting squat" },
      { coach: "Stephen Thompson", url: THOMPSON, idea: "a standing scale for balance" },
    ],
    blocks: [
      block({
        key: "ankle-cars",
        name: "Ankle circles",
        sides: "each",
        timerSeconds: 35,
        prescription: "3 each direction",
        sets: 1,
        reps: 3,
        cues: "Draw a slow full circle with the foot. Keep the knee still. Both directions.",
      }),
      block({
        key: "knee-wall",
        name: "Knee-to-wall rocks",
        sides: "each",
        timerSeconds: 40,
        prescription: "2 sets × 10",
        sets: 2,
        reps: 10,
        track: "depth",
        cues: "Toes a few centimeters from the wall. Bend the knee toward the wall without the heel lifting. If the knee cannot touch, move the foot closer. Log the toe-to-wall distance if you measure it.",
      }),
      block({
        key: "deep-squat",
        name: "Deep squat hold",
        timerSeconds: 150,
        prescription: "Accumulate 2–3 min",
        sets: 1,
        holdSeconds: 150,
        cues: "Sit in the bottom of a squat. Heels down if you can. Shift weight knee to knee. Hold a post if the heels pop up. Stand up if the knees pinch.",
      }),
      block({
        key: "standing-scale",
        name: "Standing scale",
        sides: "each",
        timerSeconds: 20,
        repeats: 2,
        prescription: "2 holds × 20 s",
        sets: 2,
        holdSeconds: 20,
        cues: "Stand on one leg and hinge until the free leg reaches back. Quiet standing foot. Use a fingertip on the wall if you need it.",
      }),
    ],
  },
  {
    id: "upper-back",
    title: "Upper Back & Shoulders",
    minutesLabel: "about 8 min",
    summary: "Shoulder circles, upper-back rotation, and an easy hang.",
    when: "After pads or on a recovery day",
    access: "pro",
    listed: true,
    credits: [
      { coach: "Andreo Spina (FRC)", url: SPINA_CHANNEL, idea: "shoulder circles with the ribs quiet" },
      { coach: "GMB Fitness", url: GMB_BJJ, idea: "upper-back rotation and a front-shoulder stretch" },
      { coach: "Ido Portal", url: IDO_HANG, idea: "accumulated hanging" },
    ],
    blocks: [
      block({
        key: "shoulder-cars",
        name: "Shoulder circles",
        sides: "each",
        timerSeconds: 40,
        prescription: "3 each direction",
        sets: 1,
        reps: 3,
        cues: "Arm makes the biggest slow circle you can while the ribs stay down. Do not arch to fake the range.",
      }),
      block({
        key: "tspine",
        name: "Quadruped upper-back rotation",
        sides: "each",
        timerSeconds: 40,
        prescription: "2 sets × 8",
        sets: 2,
        reps: 8,
        cues: "Hands and knees. One hand behind the head. Rotate the chest open, then thread the elbow toward the opposite wrist. Move the upper back, not the low back.",
      }),
      block({
        key: "lounge-chair",
        name: "Lounge-chair stretch",
        sides: "each",
        timerSeconds: 50,
        prescription: "10 contractions, then a 30 s hold",
        sets: 1,
        reps: 10,
        holdSeconds: 30,
        cues: "Kneel beside a bench or couch. Elbow up on the support so the front of the shoulder opens. Gently press the hand down ten times, then hold about 30 seconds.",
      }),
      block({
        key: "hang",
        name: "Hang",
        timerSeconds: 75,
        prescription: "Accumulate 60–90 s",
        sets: 1,
        holdSeconds: 75,
        cues: "Dead hang from a bar if you have one. Shoulders can start relaxed. Step down before the grip slips. No bar: hold a doorway and let the chest sink.",
      }),
    ],
  },
  {
    id: "grapplers-neck-hips",
    title: "Grappler's Neck & Hips",
    minutesLabel: "about 10 min",
    summary: "Gentle neck isometrics plus hip switches. No bridges for beginners.",
    when: "Away from hard sparring",
    access: "pro",
    listed: true,
    credits: [
      { coach: "UFC Performance Institute (Gavin Pratt)", url: VALD, idea: "staged neck isometrics, static phase" },
      { coach: "GMB Fitness", url: GMB_BJJ, idea: "sit-throughs and a lunge-to-squat flow" },
      { coach: "Jeff Cavaliere", url: CAVALIERE, idea: "90/90 hip switches" },
    ],
    blocks: [
      block({
        key: "neck-flex",
        name: "Neck isometric — flexion",
        timerSeconds: 20,
        prescription: "2 holds × 5 s",
        sets: 2,
        holdSeconds: 5,
        cues: "Palm on the forehead. Chin tucks slightly as you ramp a small push into the hand for about 5 seconds. Stop well short of a max squeeze.",
      }),
      block({
        key: "neck-ext",
        name: "Neck isometric — extension",
        timerSeconds: 20,
        prescription: "2 holds × 5 s",
        sets: 2,
        holdSeconds: 5,
        cues: "Hand on the back of the head. Press back gently. Keep the neck long. Skip this after a hard spar or any head impact.",
      }),
      block({
        key: "neck-left",
        name: "Neck isometric — left",
        timerSeconds: 20,
        prescription: "2 holds × 5 s",
        sets: 2,
        holdSeconds: 5,
        cues: "Hand on the left side of the head. Press sideways into the hand without shrugging the shoulder to the ear.",
      }),
      block({
        key: "neck-right",
        name: "Neck isometric — right",
        timerSeconds: 20,
        prescription: "2 holds × 5 s",
        sets: 2,
        holdSeconds: 5,
        cues: "Same on the right. This does not prevent concussion. If it pinches, stop.",
      }),
      block({
        key: "sit-frog",
        name: "Sit-through to frog",
        timerSeconds: 70,
        prescription: "6 reps, then a 15 s hold",
        sets: 1,
        reps: 6,
        holdSeconds: 15,
        cues: "From hands and knees, step one foot through and sit the hip down, then back to a wide frog. Finish with a short frog hold. Weight stays on the hands and knees.",
      }),
      block({
        key: "hip-switch",
        name: "90/90 hip switches",
        timerSeconds: 40,
        repeats: 2,
        prescription: "2 sets × 5 / side",
        sets: 2,
        reps: 5,
        cues: "Both knees bent about 90 degrees. Switch sides with the hips, then lean over the front shin if that is easy. Hands can stay down.",
      }),
      block({
        key: "lunge-pigeon",
        name: "Lunge to pigeon to squat",
        sides: "each",
        timerSeconds: 50,
        prescription: "1 round",
        sets: 1,
        cues: "Half-kneeling lunge, then a modified pigeon on that side, then stand into a squat. One smooth round. Skip pigeon if the knee complains.",
      }),
      block({
        key: "plow",
        name: "Quadruped twist to plow",
        timerSeconds: 15,
        repeats: 3,
        prescription: "3 holds × 15 s",
        sets: 3,
        holdSeconds: 15,
        advanced: true,
        cues: "Advanced only. From all fours, roll toward the shoulders so the weight sits on the upper back, never the skull. Skip this if you are new, have a neck injury, or sparred hard today.",
      }),
    ],
  },
  {
    id: COOLDOWN_ID,
    title: "Cooldown",
    minutesLabel: "about 8 min",
    summary: "Easy static holds after training. Skip it if you are out of time.",
    when: "End of a session",
    access: "free",
    listed: true,
    credits: [
      { coach: "Kelly Starrett", url: STARRETT, idea: "a couch stretch for the hip flexors" },
      { coach: "Kyokushin junbi undō tradition", url: KYOKUSHIN, idea: "seated straddle and butterfly after training" },
    ],
    blocks: [
      block({
        key: "couch",
        name: "Couch stretch",
        sides: "each",
        timerSeconds: 75,
        prescription: "1 hold × 60–90 s",
        sets: 1,
        holdSeconds: 75,
        cues: "Back knee close to the wall or couch, shin vertical, front foot planted. Squeeze the glute and stay tall. Use a pad under the knee.",
      }),
      block({
        key: "pigeon",
        name: "Pigeon",
        sides: "each",
        timerSeconds: 60,
        prescription: "1 hold × 60 s",
        sets: 1,
        holdSeconds: 60,
        cues: "Front shin across the body as much as the hip allows. Back leg long. Keep the front knee happy — do not twist it to force the position.",
      }),
      block({
        key: "butterfly",
        name: "Butterfly",
        timerSeconds: 60,
        prescription: "1 hold × 60 s",
        sets: 1,
        holdSeconds: 60,
        cues: "Soles together, knees open. Tall spine. A small lean is enough.",
      }),
      block({
        key: "child",
        name: "Child's pose with a lat reach",
        timerSeconds: 60,
        prescription: "1 hold × 60 s",
        sets: 1,
        holdSeconds: 60,
        cues: "Hips toward the heels, arms long. Walk both hands a little to one side, then the other, if the sides want it.",
      }),
      block({
        key: "breath",
        name: "Slow nasal breathing",
        timerSeconds: 60,
        prescription: "1 min",
        sets: 1,
        holdSeconds: 60,
        cues: "Sit or lie down. In through the nose, out through the nose. Nothing else to do.",
      }),
    ],
  },
  {
    id: DAILY_WARMUP_ID,
    title: "Daily warm-up",
    minutesLabel: "3–4 min",
    summary: "Easy joint circles and leg swings before a Train session.",
    when: "Start of every Train session",
    access: "free",
    listed: false,
    credits: [
      { coach: "Thomas Kurz", url: KURZ, idea: "dynamic work before explosive training" },
      {
        coach: "Jonathan Chaimberg",
        url: "https://www.grapplearts.com/gsps-original-mma-conditioning-coach-jon-chaimberg/",
        idea: "a dynamic warm-up",
      },
    ],
    blocks: [
      block({
        key: "joint-circles",
        name: "Head-to-toe joint circles",
        timerSeconds: 60,
        prescription: "1 round × 60 s",
        sets: 1,
        cues: "Neck, shoulders, hips, knees, and ankles. Small circles. Easy pace. This is temperature, not a stretch contest.",
      }),
      block({
        key: "front-swing",
        name: "Front leg swings",
        sides: "each",
        timerSeconds: 30,
        prescription: "30 s",
        sets: 1,
        cues: "Hold a wall. Swing the leg forward and back under control. Stay tall. The height can grow, the throw does not.",
      }),
      block({
        key: "side-swing",
        name: "Side leg swings",
        sides: "each",
        timerSeconds: 30,
        prescription: "30 s",
        sets: 1,
        cues: "Swing across the body and out to the side. Toes light. Do not lean to make it bigger.",
      }),
      block({
        key: "hip-open",
        name: "Hip openers",
        timerSeconds: 40,
        prescription: "40 s",
        sets: 1,
        reps: 6,
        cues: "A few slow knee hugs and open-the-gate steps. Then you are ready to train. Save long holds for the cooldown.",
      }),
    ],
  },
];

export const LISTED_ROUTINES = MOBILITY_ROUTINES.filter((routine) => routine.listed);

export const FREE_ROUTINE_IDS = MOBILITY_ROUTINES.filter((routine) => routine.access === "free").map(
  (routine) => routine.id,
);

export function getMobilityRoutine(id: string) {
  return MOBILITY_ROUTINES.find((routine) => routine.id === id) ?? null;
}

export function routineIsPro(id: string) {
  return getMobilityRoutine(id)?.access === "pro";
}

export function canUseMobilityPro(planId: CatalogPlanId) {
  return planHasFeature(planId, "mobility_pro");
}

export function prescribedSeconds(routine: MobilityRoutine) {
  return expandPlaySteps(routine).reduce((total, step) => total + step.seconds, 0);
}

function sideLabel(side: "" | "left" | "right") {
  if (side === "left") return "Left";
  if (side === "right") return "Right";
  return "";
}

export function expandPlaySteps(routine: MobilityRoutine): PlayStep[] {
  const draft: Omit<PlayStep, "nextName">[] = [];
  for (const item of routine.blocks) {
    const sides: Array<"" | "left" | "right"> = item.sides === "each" ? ["left", "right"] : [""];
    const repeats = Math.max(1, item.repeats);
    for (let repeat = 0; repeat < repeats; repeat += 1) {
      for (const side of sides) {
        draft.push({
          id: `${item.key}-${side || "both"}-${repeat + 1}`,
          blockKey: item.key,
          name: item.name,
          cues: item.cues,
          side,
          sideLabel: sideLabel(side),
          seconds: item.timerSeconds,
          prescription: item.prescription,
          repeatLabel: repeats > 1 ? `${repeat + 1} of ${repeats}` : "",
          advanced: item.advanced,
        });
      }
    }
  }
  return draft.map((step, index) => {
    const upcoming = draft[index + 1];
    const nextName = upcoming
      ? [upcoming.name, upcoming.sideLabel, upcoming.repeatLabel].filter(Boolean).join(" · ")
      : "Log this routine";
    return { ...step, nextName };
  });
}

export function logRowsFor(routine: MobilityRoutine): MobilityLogRow[] {
  const rows: MobilityLogRow[] = [];
  for (const item of routine.blocks) {
    const sides: Array<"" | "left" | "right"> = item.sides === "each" ? ["left", "right"] : [""];
    for (const side of sides) {
      rows.push({
        exerciseKey: item.key,
        name: item.name,
        side,
        sideLabel: sideLabel(side),
        prescription: item.prescription,
        track: item.track,
        showHold: true,
        showReps: true,
        showSets: true,
      });
    }
  }
  return rows;
}

export const SAFETY_NOTES = [
  "Warm up first: 3–5 minutes easy, plus joint circles, before any long hold.",
  "No long static holds right before explosive work, sparring, or lifting. Dynamic work first. Static work after.",
  "No bouncing for beginners. Leg raises are lifted and controlled. Speed comes only after the full range is easy.",
  "Sharp, pinching, or nerve pain is a stop signal. Stretch tension is okay. If pain keeps showing up, see a professional.",
  "End-range pushes (the straddle push-and-pull) are demanding: at most 2–3 times a week for an area, not on back-to-back days, and not in the 48 hours before a fight.",
  "Neck: gentle ramps only. No bridges or plows for beginners, after a neck injury, or after a hard spar or head impact. Neck work is not proven to prevent concussion.",
  "Never force a partner stretch. Pressure stays slow and agreed.",
  "Pivot the base foot on kicks. Do not twist a knee to force a split.",
  "If you have an ACL or hip history, get a professional's clearance before split work.",
  "When readiness is low, choose Mobility or Aerobic Base. The plan does not change itself.",
  "No weight-cut, dehydration, or fat-loss guidance here.",
] as const;

export const FLEX_WEEKS: Array<{
  week: number;
  name: string;
  detail: string;
}> = [
  {
    week: 1,
    name: "Foundation",
    detail:
      "Kicker's Hips most days. Split Builder three times this week if it is open on your plan, with holds around 30–45 seconds. Do the baseline check-in.",
  },
  {
    week: 2,
    name: "Foundation",
    detail:
      "Same as week 1. Keep the leg raises lifted, not thrown. Note left and right instead of chasing a perfect split.",
  },
  {
    week: 3,
    name: "Active range",
    detail:
      "Holds can grow toward 60 seconds. Add the straddle push-and-pull twice this week, not on back-to-back days. Last few leg-raise reps can be a little quicker if the height holds.",
  },
  {
    week: 4,
    name: "Active range",
    detail:
      "Add a short end-range lift: hold the top of a front or side leg raise for a breath. Kick endurance can be 10 raised kicks if the hip is calm.",
  },
  {
    week: 5,
    name: "Load",
    detail:
      "Slightly deeper split, or a small lift under the front foot. Kick endurance 15–20 if week 4 was clean. After the warm-up, 2 rounds of slow-to-faster head-height kicks only if you already get there with control.",
  },
  {
    week: 6,
    name: "Retest",
    detail:
      "Cut the volume by about 30 percent, then repeat the check-in. Full splits often take longer than one cycle. The score is the change, not pass or fail.",
  },
];

export function flexibilityWeekNumber(anchor: Date, date: Date, timeZone = APP_TIMEZONE) {
  const start = mondayOfZoned(anchor, timeZone).getTime();
  const current = mondayOfZoned(date, timeZone).getTime();
  const days = Math.round((current - start) / 86_400_000);
  const weeks = Math.floor(days / 7);
  const safe = weeks < 0 ? 0 : weeks;
  return (safe % 6) + 1;
}

export function flexWeekCopy(week: number) {
  return FLEX_WEEKS.find((row) => row.week === week) ?? FLEX_WEEKS[0];
}

export const KICK_MARKS = ["belt", "chest", "shoulder", "head"] as const;
export type KickMark = (typeof KICK_MARKS)[number];

const KICK_RANK: Record<string, number> = { belt: 1, chest: 2, shoulder: 3, head: 4 };

export function isKickMark(value: string): value is KickMark {
  return (KICK_MARKS as readonly string[]).includes(value);
}

export function sideGapOver10(left: number | null | undefined, right: number | null | undefined) {
  if (left == null || right == null) return false;
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  const denom = Math.max(Math.abs(left), Math.abs(right));
  if (denom === 0) return false;
  return Math.abs(left - right) / denom > 0.1;
}

export function kickGapOver10(left: string, right: string) {
  const l = KICK_RANK[left];
  const r = KICK_RANK[right];
  if (!l || !r) return false;
  return sideGapOver10(l, r);
}

export function splitProgressCm(previousCm: number | null, currentCm: number | null) {
  if (previousCm == null || currentCm == null) return null;
  return Math.round((previousCm - currentCm) * 10) / 10;
}

export const SIT_REACH_LEVELS = ["knees", "shins", "toes", "past"] as const;

export function mobilityLogKey(exerciseKey: string, side: string) {
  return `${exerciseKey}|${side}`;
}

export function collectCreditUrls() {
  const urls = new Set<string>();
  for (const routine of MOBILITY_ROUTINES) {
    for (const credit of routine.credits) urls.add(credit.url);
  }
  return [...urls];
}
