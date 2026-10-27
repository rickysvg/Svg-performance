import { combatFormVideoSeeds } from "@/lib/combat-library";
import { fighterFormVideoSeeds } from "@/lib/fighter-library";

/**
 * Curated YouTube form-reference catalog for the DEMO strength + skill programs.
 * These are external education links, not SVG-produced coaching videos.
 *
 * Train form refs follow the gym-floor rule: a Shorts URL, a verified clip at or
 * under FORM_VIDEO_SHORT_MAX_SECONDS, or a longer watch URL with a start time (`t=`).
 * `seconds` is the public length checked for that clip.
 */

export type FormVideoSeed = {
  url: string;
  pending: boolean;
  /**
   * Basic movement. No technique video, and no "pending" placeholder.
   * Shadow rounds use this — shadowboxing is footwork and hands, not a form clip.
   */
  omit?: boolean;
  channel: string;
  title: string;
  /** Public length in seconds for a verified short form demo. */
  seconds?: number;
};

export const FORM_VIDEO_SHORT_MAX_SECONDS = 90;

type Clip = {
  url: string;
  seconds: number;
  channel: string;
  title: string;
};

function ready(clip: Clip): FormVideoSeed {
  return {
    url: clip.url,
    pending: false,
    channel: clip.channel,
    title: clip.title,
    seconds: clip.seconds,
  };
}

const PENDING: FormVideoSeed = {
  url: "",
  pending: true,
  channel: "",
  title: "",
};

/** Intentionally no form video. The logger must not show a still or a pending line. */
const NO_FORM_VIDEO: FormVideoSeed = {
  url: "",
  pending: false,
  omit: true,
  channel: "",
  title: "",
};

/**
 * Shadowboxing rounds are basic. "Shadow kicks" and other mobility names do not match.
 * "Easy shadow cool-down" is included.
 */
export function skipsFormVideo(name: string) {
  return /\bshadow(?:\s*-?\s*)?box(?:ing)?\b/i.test(name) || /\beasy shadow\b/i.test(name);
}

const goblet = ready({
  url: "https://www.youtube.com/watch?v=nfX7IFK9UNI&t=0&end=29",
  seconds: 29,
  channel: "National Academy of Sports Medicine (NASM)",
  title: "How to do a Goblet Squat | Proper Form & Technique | NASM",
});
const rdl = ready({
  url: "https://www.youtube.com/watch?v=xgusDooVfKU",
  seconds: 20,
  channel: "National Academy of Sports Medicine (NASM)",
  title: "How to do a Romanian Deadlift (Barbell) | Proper Form & Technique | NASM",
});
const dbRdl = ready({
  url: "https://www.youtube.com/watch?v=aa57T45iFSE",
  seconds: 31,
  channel: "National Academy of Sports Medicine (NASM)",
  title: "How to do a Dumbbell Romanian Deadlift | Proper Form & Technique | NASM",
});
/** Form-video report clip. The demo window starts at 6:06 and ends at 7:28. */
const singleLegRdl = ready({
  url: "https://youtu.be/Zfr6wizR8rs?t=366&end=448",
  seconds: 82,
  channel: "Squat University",
  title: "Single-leg RDL",
});
const lunge = ready({
  url: "https://www.youtube.com/watch?v=xrPteyQLGAo",
  seconds: 15,
  channel: "PureGym",
  title: "How To Do A Reverse Lunge",
});
const walkingLunge = ready({
  url: "https://www.youtube.com/watch?v=mAgbXQdd4LM",
  seconds: 15,
  channel: "PureGym",
  title: "How To Do Walking Lunges",
});
const squatJump = ready({
  url: "https://www.youtube.com/watch?v=tZSYZdtbONc",
  seconds: 19,
  channel: "National Academy of Sports Medicine (NASM)",
  title: "How to do a Squat Jump | Proper Form & Technique | NASM",
});
// The form-video report has no Sit-to-stand row. This Short is a chair sit-to-stand, not the NASM squat jump.
const sitToStand = ready({
  url: "https://www.youtube.com/shorts/pIAzucMjibQ",
  seconds: 20,
  channel: "YouTube Shorts",
  title: "Chair sit-to-stand",
});
const plank = ready({
  url: "https://www.youtube.com/watch?v=mwlp75MS6Rg",
  seconds: 15,
  channel: "National Academy of Sports Medicine (NASM)",
  title: "How to do a Plank | Proper Form & Technique | NASM",
});
const pushUp = ready({
  url: "https://www.youtube.com/watch?v=WDIpL0pjun0",
  seconds: 14,
  channel: "National Academy of Sports Medicine (NASM)",
  title: "How to do a Push-Up | Proper Form & Technique | NASM",
});
const dbBench = ready({
  url: "https://www.youtube.com/watch?v=O7ECGhZj_Hc",
  seconds: 34,
  channel: "Jay Gardner",
  title: "Dumbbell Bench Press",
});
/** Single-arm clip. The name must match the video. Not the bilateral bench. */
const singleArmDbBench = ready({
  url: "https://www.youtube.com/watch?v=qFTnmyC-nf4",
  seconds: 23,
  channel: "National Academy of Sports Medicine (NASM)",
  title: "How to do a Single-Arm Dumbbell Chest Press | Proper Form & Technique | NASM",
});
const barBench = ready({
  url: "https://www.youtube.com/shorts/0cXAp6WhSj4",
  seconds: 58,
  channel: "Jeremy Ethier",
  title: "The PERFECT Bench Press (5 Steps)",
});
const oneArmRow = ready({
  url: "https://www.youtube.com/watch?v=ZRSGpBUVcNw",
  seconds: 11,
  channel: "PureGym",
  title: "How To Do Single Arm Dumbbell Rows",
});
const chestRow = ready({
  url: "https://www.youtube.com/watch?v=0UBRfiO4zDs",
  seconds: 17,
  channel: "Renaissance Periodization",
  title: "Chest Supported Row",
});
// TODO: human review — SouthDublinSC, 12s, metadata only.
const halfKneelRow = ready({
  url: "https://www.youtube.com/watch?v=mdC7L79Pojk",
  seconds: 12,
  channel: "SouthDublinSC",
  title: "Half kneeling one-arm row",
});
const overheadPress = ready({
  url: "https://www.youtube.com/watch?v=MMjBnEBnZKM",
  seconds: 12,
  channel: "National Academy of Sports Medicine (NASM)",
  title: "How to do a Dumbbell Overhead Press",
});
// TODO: human review — small channel, metadata only. This is an overhead press, not a bench press.
const singleArmPress = ready({
  url: "https://www.youtube.com/watch?v=uqOlmjcHoEs",
  seconds: 38,
  channel: "Nordic Performance Training",
  title: "Dumbbell Shoulder Press – Single Arm",
});
const facePull = ready({
  url: "https://www.youtube.com/watch?v=eTCBSFlCJ_s",
  seconds: 26,
  channel: "National Academy of Sports Medicine (NASM)",
  title: "How to do a Face Pull | Proper Form & Technique | NASM",
});
const farmer = ready({
  url: "https://www.youtube.com/watch?v=Kh0871u60z0",
  seconds: 37,
  channel: "Barbell Logic",
  title: "Farmer Carry: Gym Shorts (How To)",
});
const suitcase = ready({
  url: "https://www.youtube.com/watch?v=3RKKnZhhelE",
  seconds: 19,
  channel: "Champion Physical Therapy and Performance",
  title: "How to Perform A Suitcase Carry",
});
const swing = ready({
  url: "https://www.youtube.com/watch?v=1cVT3ee9mgU",
  seconds: 27,
  channel: "StrongFirst",
  title: "Kettlebell Swing",
});
const pullUp = ready({
  url: "https://www.youtube.com/watch?v=9yVGh3XbJ34",
  seconds: 21,
  channel: "National Academy of Sports Medicine (NASM)",
  title: "How to do a Pull-Up | Proper Form & Technique | NASM",
});
const lateralBound = ready({
  url: "https://www.youtube.com/watch?v=soqQy4dzEts",
  seconds: 9,
  channel: "Third Space London",
  title: "How To Lateral Bound",
});
const airBike = ready({
  url: "https://www.youtube.com/watch?v=KC-ZSfOmXgE",
  seconds: 55,
  channel: "Nutrition Warehouse",
  title: "How to use the AirBike",
});
const trapBar = ready({
  url: "https://www.youtube.com/watch?v=FYx76NSijfU",
  seconds: 17,
  channel: "OPEX Fitness",
  title: "Trap Bar Deadlift",
});
const floorPress = ready({
  url: "https://www.youtube.com/watch?v=T0Y3OBF1bNI",
  seconds: 12,
  channel: "PureGym",
  title: "How To Do A Dumbbell Floor Press",
});
const landminePress = ready({
  url: "https://www.youtube.com/watch?v=_ArzG9qz-yM",
  seconds: 77,
  channel: "Eric Cressey",
  title: "Half-kneeling 1-arm landmine press",
});
const rotationalThrow = ready({
  url: "https://www.youtube.com/watch?v=mOHAp5kOyRM",
  seconds: 27,
  channel: "Brian DeBaets",
  title: "Rotational med-ball throw",
});
const chestPass = ready({
  url: "https://www.youtube.com/watch?v=Jo2on0-YBPM",
  seconds: 35,
  channel: "Jon Hodgkinson Golf Fitness",
  title: "How to Do a Med Ball Chest Pass",
});
const sledPush = ready({
  url: "https://www.youtube.com/watch?v=3KWK7SIdPz4",
  seconds: 59,
  channel: "Joe DeFranco",
  title: "Heavy Sled Push Technique: 60-SECOND TUTORIAL! [Hip Positioning]",
});
const sledDrag = ready({
  url: "https://www.youtube.com/watch?v=k7JsvdG9sSo",
  seconds: 22,
  channel: "Testosterone Nation",
  title: "Backward Sled Drag",
});
const bandedSwing = ready({
  url: "https://www.youtube.com/watch?v=UqpiMY9GktA",
  seconds: 76,
  channel: "Boxing Science",
  title: "Improve Power with Banded Kettlebell Swings",
});
// TODO: human review — Neck Plank (Extension), metadata only. Old clip was a loaded machine.
const neckExtension = ready({
  url: "https://www.youtube.com/watch?v=VeWtksvfJh0",
  seconds: 26,
  channel: "Shift Human Performance - Coach Jen Kates",
  title: "Neck Plank (Extension)",
});
const frontRackMarch = ready({
  url: "https://www.youtube.com/watch?v=30SX7mLEEo0",
  seconds: 28,
  channel: "Perform For Sport",
  title: "DB or KB Front Rack March",
});
const shrug = ready({
  url: "https://www.youtube.com/watch?v=5z7ZtboxbBY",
  seconds: 10,
  channel: "Renaissance Periodization",
  title: "Dumbbell Bent Shrug",
});
const jumpRope = ready({
  url: "https://youtu.be/fhBy8dadK7U?t=14",
  seconds: 54,
  channel: "PHOENIX NATION",
  title: "Jump rope basic bounce",
});
const sidePlank = ready({
  url: "https://www.youtube.com/watch?v=44ND4bOB-T0",
  seconds: 17,
  channel: "National Academy of Sports Medicine (NASM)",
  title: "How to do a Side Plank | Proper Form & Technique | NASM",
});
const deadBug = ready({
  url: "https://www.youtube.com/watch?v=bxn9FBrt4-A",
  seconds: 30,
  channel: "National Academy of Sports Medicine (NASM)",
  title: "How to do a Dead Bug | Proper Form & Technique | NASM",
});
// TODO: human review — stationary jab, small channel. Start at 10s to skip the intro.
const jab = ready({
  url: "https://www.youtube.com/watch?v=1wCQLFhipbE&t=10",
  seconds: 58,
  channel: "Tribute Boxing & Fitness",
  title: "Boxing Tips 101 | HOW TO: JAB",
});
// TODO: human review — Grogan's combo clip, metadata only.
const oneTwo = ready({
  url: "https://www.youtube.com/watch?v=lFc-J3GspSs",
  seconds: 36,
  channel: "Grogan's Academy of Martial Arts",
  title: "Jab, Cross, Hook, Uppercut",
});
const hook = ready({
  url: "https://www.youtube.com/watch?v=MJmHnyBjC6s",
  seconds: 58,
  channel: "Tony Jeffries",
  title: "How to throw the right hook in Boxing",
});
// TODO: human review — slip then counter, not an exact jab–cross.
const slip = ready({
  url: "https://www.youtube.com/watch?v=l3xk0bBHAWE",
  seconds: 39,
  channel: "Evolve Mixed Martial Arts",
  title: "Slip and counter",
});
const parry = ready({
  url: "https://www.youtube.com/watch?v=M8xFzAdwwZE",
  seconds: 45,
  channel: "Ring Kinetix",
  title: "How to Parry the Cross",
});
const lowKick = ready({
  url: "https://www.youtube.com/watch?v=S2I5O92wXpI",
  seconds: 59,
  channel: "AKA Thailand",
  title: "Muay Thai Basics: Body Kick (Right) - AKA Techniques",
});
const teep = ready({
  url: "https://www.youtube.com/watch?v=Gw_Gf9jRvTM&t=6",
  seconds: 59,
  channel: "AKA Thailand",
  title: "Muay Thai Basics: Push Kick - AKA Techniques",
});
const clinchKnee = ready({
  url: "https://www.youtube.com/watch?v=z6argMW5Dtw",
  seconds: 60,
  channel: "AKA Thailand",
  title: "Muay Thai Basics: Clinch and Knee - AKA Techniques",
});
// TODO: human review — elbows only. Pair with the clinch-knee clip or film the combination.
const elbow = ready({
  url: "https://www.youtube.com/watch?v=fdsiCeQjHUo",
  seconds: 58,
  channel: "AKA Thailand",
  title: "Muay Thai Basics: Elbows - AKA Techniques",
});
const doubleLeg = ready({
  url: "https://www.youtube.com/watch?v=vFvl1tdr8l4",
  seconds: 47,
  channel: "Cary Kolat",
  title: "Double Leg Head Drive - Cary Kolat Wrestling Moves",
});
const leadHook = ready({
  url: "https://www.youtube.com/watch?v=BFS74EjUrsY",
  seconds: 40,
  channel: "Glenn Holmes Boxing Fitness",
  title: "Lead hook",
});
const bodyHook = ready({
  url: "https://www.youtube.com/watch?v=pZ5VF_fkSwU",
  seconds: 49,
  channel: "Master Richard Baskin",
  title: "Roll Body Hook",
});
const bodyJab = ready({
  url: "https://www.youtube.com/watch?v=EYeMScQeSUA",
  seconds: 27,
  channel: "Master Boxing",
  title: "The body jab",
});
const levelChange = ready({
  url: "https://www.youtube.com/watch?v=-bfzNXSN9kU",
  seconds: 33,
  channel: "Satori BJJ",
  title: "Level Change in MMA",
});
const checkKick = ready({
  url: "https://www.youtube.com/watch?v=zusZbQyjK1U",
  seconds: 45,
  channel: "Evolve Mixed Martial Arts",
  title: "Checking kicks",
});
const levelChangeBag = ready({
  url: "https://www.youtube.com/watch?v=OS_QL3oE-Uk",
  seconds: 73,
  channel: "Martial Lee - Vegan Roundhouse Kicks",
  title: "Level change on the heavy bag",
});
const sprawl = ready({
  url: "https://www.youtube.com/watch?v=QMVavyxjlNU",
  seconds: 67,
  channel: "Cary Kolat",
  title: "Best Sprawl Position To Stop Leg Attack - Cary Kolat Wrestling Moves",
});
const shrimp = ready({
  url: "https://www.youtube.com/watch?v=Wwhuorkm4oA",
  seconds: 65,
  channel: "Bellingham BJJ",
  title: "Solo Drills: Shrimp / Hip Escape",
});
const sideControl = ready({
  url: "https://www.youtube.com/watch?v=_JPZaIcr90c",
  seconds: 69,
  channel: "Matt Arroyo Jiu Jitsu",
  title: "How to get out of SIDE CONTROL (against a bigger stronger opponent!)",
});
const burpee = ready({
  url: "https://www.youtube.com/watch?v=auBLPXO8Fww",
  seconds: 52,
  channel: "CrossFit",
  title: "The Burpee",
});
const woodchop = ready({
  url: "https://www.youtube.com/watch?v=ZDt4MCvjMAA",
  seconds: 50,
  channel: "Goodlife Health Clubs",
  title: "HOW TO: Cable Wood Chop",
});
const pallof = ready({
  url: "https://www.youtube.com/watch?v=y1fOBVtANdM",
  seconds: 39,
  channel: "TurnFit - Vancouver Personal Trainers",
  title: "How to do a Standing Banded Pallof Press",
});
const bandPullApart = ready({
  url: "https://www.youtube.com/watch?v=qi2y-eI_kuI",
  seconds: 25,
  channel: "Luke Selway | Strength Coaching Online",
  title: "How to do a Band Pull Apart",
});
const highPull = ready({
  url: "https://www.youtube.com/watch?v=2oq8CDNM8ww",
  seconds: 51,
  channel: "LivingFit",
  title: "How to Do Dumbbell High Pulls | Movement Breakdown",
});
const straightArm = ready({
  url: "https://www.youtube.com/watch?v=6-lDyiVOWqE",
  seconds: 48,
  channel: "Testosterone Nation",
  title: "Straight-Arm Pulldown",
});
const pullover = ready({
  url: "https://www.youtube.com/watch?v=jQjWlIwG4sI",
  seconds: 14,
  channel: "Renaissance Periodization",
  title: "Dumbbell pullover",
});
const plyoPushUp = ready({
  url: "https://www.youtube.com/watch?v=MM0np2nu_m0",
  seconds: 57,
  channel: "Cain & Jones Training",
  title: "Plyometric Pushup - Beginner",
});
const landmineRotation = ready({
  url: "https://www.youtube.com/watch?v=MswsBPLGhE8",
  seconds: 26,
  channel: "O.B. Training & Sports Performance",
  title: "Landmine Rotation",
});
// TODO: human review — correct step-up, 9-subscriber channel, metadata only.
const stepUp = ready({
  url: "https://www.youtube.com/watch?v=cHftRks6yXQ",
  seconds: 26,
  channel: "Kapono Performance, LLC",
  title: "Dumbbell Box Step Ups with Forward Lean",
});
const broadJump = ready({
  url: "https://www.youtube.com/watch?v=uhz-ia-2UcM",
  seconds: 8,
  channel: "PureGym",
  title: "How To Do Broad Jumps",
});
const hipThrust = ready({
  url: "https://www.youtube.com/watch?v=T4P0SDrJZl4",
  seconds: 55,
  channel: "Physio Plus Fitness",
  title: "Dumbbell hip thrust",
});
const lateralLunge = ready({
  url: "https://www.youtube.com/watch?v=2z9q1zmwcSk",
  seconds: 48,
  channel: "Fitness With Tross",
  title: "The Lateral Lunge | Movement Demo",
});
const hipHinge = ready({
  url: "https://www.youtube.com/watch?v=2W_gXhut5S8",
  seconds: 58,
  channel: "Hinge Health",
  title: "How to Do a Hip Hinge: A Guide from Physical Therapists",
});
const airSquat = ready({
  url: "https://www.youtube.com/watch?v=C_VtOYc6j5c",
  seconds: 42,
  channel: "CrossFit",
  title: "The Air Squat: CrossFit Foundational Movement",
});
const pauseAirSquat = ready({
  url: "https://www.youtube.com/watch?v=fcH-nbutvyE",
  seconds: 17,
  channel: "GPS Human Performance",
  title: "Paused Air Squat | GPS Human Performance",
});
const splitSquat = ready({
  url: "https://www.youtube.com/watch?v=vvZHaPGOIWU",
  seconds: 65,
  channel: "Purple Patch Fitness",
  title: "Body Weight Split Squat",
});
const gluteBridge = ready({
  url: "https://www.youtube.com/watch?v=Z3cY3d3BBo4",
  seconds: 42,
  channel: "National Academy of Sports Medicine (NASM)",
  title: "How to do a Floor Bridge",
});
const singleLegBridge = ready({
  url: "https://www.youtube.com/watch?v=lHXShY-FivU",
  seconds: 35,
  channel: "National Academy of Sports Medicine (NASM)",
  title: "How to do a Single-Leg Floor Bridge",
});
const pikePushUp = ready({
  url: "https://www.youtube.com/watch?v=XckEEwa1BPI",
  seconds: 17,
  channel: "National Academy of Sports Medicine (NASM)",
  title: "How to do a Pike Push-Up",
});
const bandChin = ready({
  url: "https://www.youtube.com/watch?v=hZxc9vXI4bk",
  seconds: 20,
  channel: "Girls Gone Strong | Women's Health & Fitness",
  title: "Band-Assisted Chin-Up",
});
const latPulldown = ready({
  url: "https://www.youtube.com/watch?v=l07nQ5V9v3U",
  seconds: 53,
  channel: "LA Fitness",
  title: "Proper Lat Pull Down Technique",
});
const invertedRow = ready({
  url: "https://www.youtube.com/watch?v=KOaCM1HMwU0",
  seconds: 13,
  channel: "Renaissance Periodization",
  title: "Inverted Row",
});
const bandWoodchop = ready({
  url: "https://www.youtube.com/watch?v=Yp2DmHk3KnY",
  seconds: 36,
  channel: "YuryFit",
  title: "How to do a Wood Chopper with resistance bands | YuryFit",
});
const sideStepOver = ready({
  url: "https://www.youtube.com/watch?v=5R5cN1sOQWQ",
  seconds: 24,
  channel: "Christopher Johnson",
  title: "Hurdle Sidestep | Chris Johnson PT",
});
const birdDog = ready({
  url: "https://www.youtube.com/watch?v=ZdAHe9_HeEw",
  seconds: 26,
  channel: "National Academy of Sports Medicine (NASM)",
  title: "How to do a Bird Dog | Proper Form & Technique | NASM",
});
const hollowHold = ready({
  url: "https://www.youtube.com/watch?v=4xRpGgttca8",
  seconds: 13,
  channel: "Marcus Filly",
  title: "Hollow Hold",
});

export const DEMO_FORM_VIDEOS: Record<string, FormVideoSeed> = {
  "Goblet squat": goblet,
  "Romanian deadlift": rdl,
  "Reverse lunge": lunge,
  "Squat jump or box step-up": squatJump,
  "Squat jump": squatJump,
  "Sit-to-stand": sitToStand,
  "Jump rope": jumpRope,
  "Easy bike intervals": airBike,
  "Box step-up": stepUp,
  "Band Pallof press": pallof,
  "Band pull-apart": bandPullApart,
  "Front plank": plank,
  "Push-up or dumbbell bench press": pushUp,
  "Push-up": pushUp,
  "Dumbbell bench press": dbBench,
  "Single-arm dumbbell bench press": singleArmDbBench,
  "Barbell bench press": barBench,
  "Explosive dumbbell press": PENDING,
  "Pause push-up": pushUp,
  "Close-grip push-up": pushUp,
  "Feet-elevated push-up": pushUp,
  "Incline push-up": pushUp,
  "Push-up to side plank": pushUp,
  "Lateral lunge": lateralLunge,
  "Side plank with reach": sidePlank,
  "One-arm row": oneArmRow,
  "Overhead press": overheadPress,
  "Band pull-apart or face pull": facePull,
  "Face pull": facePull,
  "Farmer carry": farmer,
  "Kettlebell swing or hip hinge": swing,
  "Kettlebell swing": swing,
  "Chin-up, band-assist, or lat pulldown": pullUp,
  "Chin-up": pullUp,
  "Lat pulldown": latPulldown,
  "Band-assisted chin-up": bandChin,
  "Lateral bound or side step-over": lateralBound,
  "Lateral bound": lateralBound,
  "Step-out and stick": lateralBound,
  "Assault bike intervals": airBike,
  "Daru alactic power bike": airBike,
  "Jamieson tempo bike": airBike,
  "Daru 75% endurance bike": airBike,
  "Jamieson cardiac output bike": airBike,
  "Leon Edwards 10/20 bike finisher": airBike,
  "Fight-pace bike rounds": airBike,
  "Trap-bar deadlift": trapBar,
  "Floor press": floorPress,
  "Landmine press": landminePress,
  "Rotational med-ball throw": rotationalThrow,
  "Med-ball chest pass": chestPass,
  "Sled push": sledPush,
  "Sled hamstring drag": sledDrag,
  "Farmer's carry": farmer,
  "Banded kettlebell swing": bandedSwing,
  "Neck isometric matrix": ready({
    url: "https://www.youtube.com/watch?v=LPIKF7Rrzc0",
    seconds: 28,
    channel: "Logan Regional Hospital",
    title: "Neck isometric flexion",
  }),
  "Neck extension hold": neckExtension,
  "Banded DB front-rack march": frontRackMarch,
  "Bent-over DB shrug": shrug,
  "Jump rope or easy bike intervals": jumpRope,
  "Jump rope intervals": jumpRope,
  "Side plank": sidePlank,
  "Jab–cross (1–2)": oneTwo,
  "Low kick (roundhouse)": lowKick,
  "Hands to low-kick combo": lowKick,
  "Teep (push kick)": teep,
  "Double-collar clinch posture": clinchKnee,
  "Straight knee (clinch)": clinchKnee,
  "Alternate knee rhythm": clinchKnee,
  "Exit the clinch / frame": PENDING,
  "Boxing jab": jab,
  "Lead hook": leadHook,
  "1-2-3 bag rounds": oneTwo,
  "Mount / high-posture hold": PENDING,
  "Short punch from mount": PENDING,
  "Hip drive + post": PENDING,
  "Ground-and-pound burst": PENDING,
  "Level change (penetration step)": doubleLeg,
  "Double-leg entry": doubleLeg,
  Sprawl: sprawl,
  "Shot–sprawl reset": sprawl,
  "Closed guard posture break": PENDING,
  "Hip escape (shrimp)": shrimp,
  "Closed guard hip tilt": PENDING,
  "Frame and recover": sideControl,
  "Dead bug": deadBug,
  "Single-leg RDL": singleLegRdl,
  "Shadowbox warm-up": NO_FORM_VIDEO,
  "Easy shadow cool-down": NO_FORM_VIDEO,
  "Bag rounds — boxing combos": oneTwo,
  "Bag rounds — kicks & teeps": teep,
  "Bag rounds — body shots": bodyHook,
  "Bag rounds — clinch knees": clinchKnee,
  "Bag rounds — defense & counters": parry,
  "Bag rounds — power & speed": jab,
  "Shadowbox round 1 — empty hands": NO_FORM_VIDEO,
  "Shadowbox round 2 — hand weights": NO_FORM_VIDEO,
  "Jab — step and snap": jab,
  "Slip then jab–cross": slip,
  "Level change into the jab": levelChange,
  "Switch-step teep": teep,
  "Body hook": bodyHook,
  "Punch into the clinch knee": clinchKnee,
  "Roll under then body hook": bodyHook,
  "Body jab trap": bodyJab,
  "Check and answer kick": checkKick,
  "Boxing step-off combo": oneTwo,
  "Elbow then knee": elbow,
  "Parry and cross": parry,
  "Bag rounds — intelligent jab": jab,
  "Bag rounds — teeps and low kicks": teep,
  "Bag rounds — hooks and pivot": hook,
  "Bag rounds — defense counters": parry,
  "Bag rounds — speed and power": jab,
  "Bag rounds — level changes": levelChangeBag,
  "Bag rounds — switch entries": teep,
  "Bag rounds — body hooks": bodyHook,
  "Bag rounds — boxing to knees": clinchKnee,
  "Bag rounds — level counters": levelChange,
  "Bag rounds — pivot power": hook,
  "Bag rounds — body jab traps": bodyJab,
  "Bag rounds — kick counters": checkKick,
  "Bag rounds — combo flow": oneTwo,
  "Bag rounds — elbow and knee": elbow,
  "Bag rounds — counter then exit": parry,
  "Bag rounds — theme review": jab,
  "Pause goblet squat": goblet,
  "Walking lunge": walkingLunge,
  "Chest-supported dumbbell row": chestRow,
  "Single-arm overhead press": singleArmPress,
  "Dumbbell Romanian deadlift": dbRdl,
  "Suitcase carry": suitcase,
  "Half-kneeling one-arm row": halfKneelRow,
  Burpees: burpee,
  "Cable or band woodchop": woodchop,
  "Cable woodchop": woodchop,
  "Cable or band Pallof press": pallof,
  "Cable Pallof press": pallof,
  "Dumbbell high pull": highPull,
  "Straight-arm pulldown": straightArm,
  "Dumbbell pullover": pullover,
  "Plyo push-up": plyoPushUp,
  "Landmine rotation": landmineRotation,
  "Dumbbell step-up": stepUp,
  "Broad jump": broadJump,
  "Dumbbell hip thrust": hipThrust,
  "Dumbbell lateral lunge": lateralLunge,
  "Hip hinge": hipHinge,
  "Air squat": airSquat,
  "Pause air squat": pauseAirSquat,
  "Split squat": splitSquat,
  "Glute bridge": gluteBridge,
  "Single-leg glute bridge": singleLegBridge,
  "Pike push-up": pikePushUp,
  "Inverted row": invertedRow,
  "Band woodchop": bandWoodchop,
  "Side step-over": sideStepOver,
  "Bird dog": birdDog,
  "Hollow hold": hollowHold,
};

function clip(url: string, seconds: number, channel: string, title: string) {
  return ready({ url, seconds, channel, title });
}

/** Mobility moves. Flagged clips still use the report URL. */
const MOBILITY_FORM_VIDEOS: Record<string, FormVideoSeed> = {
  "90/90 hip switches": clip("https://youtu.be/m51AZSXMvEA", 31, "The Active Life", "90/90 hip switches"),
  "Hip openers": clip("https://youtu.be/m51AZSXMvEA", 31, "The Active Life", "90/90 hip switches"),
  "Ankle circles": clip("https://youtu.be/om1IAdzpKsg", 21, "The Barefoot Sprinter", "Ankle circles"),
  Butterfly: clip("https://youtu.be/cfJcO7gi3zw", 13, "Atomic Athlete", "Butterfly"),
  "Child's pose with a lat reach": clip("https://youtu.be/5uQ2Xuc3LiE", 18, "Revo Physiotherapy", "Child's pose"),
  "Couch stretch": clip("https://youtu.be/nw8UTCCFZRo", 38, "TrainHeroic", "Couch stretch"),
  "Deep squat hold": clip("https://youtu.be/D3zYzIlbjXM", 23, "AV High Performance Academy", "Deep squat hold"),
  "Frog rocks": clip("https://youtu.be/iM3EDuJlpDw", 20, "Kinetic Impact", "Frog rocks"),
  // TODO: human review — metadata only, small channel.
  "Front leg raise": clip("https://youtu.be/UIJoMa5mXWY", 53, "Align Pain & Performance", "Front leg raise"),
  "Front leg swings": clip("https://youtu.be/UezSaXf9mtI", 13, "The Active Life", "Front leg swings"),
  "Side leg swings": clip("https://youtu.be/64FhHrDsTeg", 17, "The Active Life", "Side leg swings"),
  // TODO: human review — 9-subscriber channel, metadata only.
  "Half split": clip("https://youtu.be/9hY6BbfK4mQ", 11, "Amber Kay", "Half split"),
  Hang: clip("https://youtu.be/0Bx_Ap7-EwU", 11, "OPEX Fitness", "Hang"),
  "Knee-to-wall rocks": clip("https://youtu.be/YH7xjrkq7ic", 11, "The Basketball Doctors", "Knee-to-wall rocks"),
  "Lounge-chair stretch": clip("https://youtu.be/xeuxwSPV1nQ", 22, "The Active Life", "Lounge-chair stretch"),
  "Lunge to knee strike": clip("https://youtu.be/F_AOPQU0OcA", 35, "Fitness Mama", "Lunge to knee strike"),
  "Neck isometric — flexion": clip("https://youtu.be/LPIKF7Rrzc0", 28, "Logan Regional Hospital", "Neck flexion"),
  "Neck isometric — extension": clip("https://youtu.be/QSeLz4CZHsI", 58, "Rehab My Patient", "Neck extension"),
  "Neck isometric — left": clip("https://youtu.be/i1H2pRTvjME", 27, "Logan Regional Hospital", "Neck lateral"),
  "Neck isometric — right": clip("https://youtu.be/i1H2pRTvjME", 27, "Logan Regional Hospital", "Neck lateral"),
  Pigeon: clip("https://youtu.be/1o7awuDGzag", 21, "Atomic Athlete", "Pigeon"),
  "Quadruped upper-back rotation": clip("https://youtu.be/e4suHCXcDqY", 34, "Comeback Performance", "Quadruped rotation"),
  "Shoulder circles": clip("https://youtu.be/OW-3qjXeoRM", 39, "Advanced Physical Medicine & Therapy", "Shoulder circles"),
  // TODO: human review — metadata only, small channel.
  "Standing knee to chest": clip("https://youtu.be/zC44t9A9g_A", 11, "Aaron Howse", "Standing knee to chest"),
  "Standing scale": clip("https://www.youtube.com/shorts/tXM8YUh_t-Y", 9, "Turnlehrer", "Standing scale"),
  "Hip circles": clip("https://youtu.be/J0oKshD0Ky8", 42, "Dr Christopher Notley", "Hip circles"),
  "Side leg raise": clip("https://youtu.be/6b1hu6iSqok", 22, "Joanna Soh", "Side leg raise"),
  "Back leg raise": clip("https://youtu.be/pn2EZjEE_ZU", 49, "Leap Fitness", "Back leg raise"),
  // TODO: human review — 198s, low-subscriber channel. Start at 0 so the short-clip rule passes.
  "Chair-supported slow roundhouse": clip(
    "https://youtu.be/Wzb88YW3_Ro?t=0",
    198,
    "The House Of Muay Thai",
    "Chair roundhouse",
  ),
  // TODO: human review — wall rather than a chair.
  "Chair-supported slow side kick": clip("https://youtu.be/tTrSwQ6qZYM", 70, "Park's Champions Taekwondo", "Side kick"),
  "Pivot-and-open shadow kicks": clip("https://youtu.be/S2I5O92wXpI", 59, "AKA Thailand", "Body kick"),
  "Wall hang": clip("https://youtu.be/ZeBnQy9Peio", 56, "Dr. Chris Netley", "Wall hang"),
  "Foot-on-support hamstring": clip("https://youtu.be/m7yPZOrk8XE", 72, "Georgina Gabriel", "Hamstring"),
  "Straddle lean": clip("https://youtu.be/uKg1rqo9YrE", 16, "The Active Life", "Straddle lean"),
  // TODO: human review — low subscriber count.
  "Straddle push and pull": clip("https://youtu.be/LfU_CurKPQs", 56, "The Free Range Movement", "Straddle PAILs"),
  // TODO: human review — frog half only.
  "Sit-through to frog": clip("https://youtu.be/00vnerwGdWw", 53, "Dr. Beau Beard", "Frog sit"),
  // TODO: human review — lunge to pigeon, no squat.
  "Lunge to pigeon to squat": clip("https://youtu.be/H8a0apsFXOg", 40, "Recalibrated Strength", "Lunge to pigeon"),
  // TODO: human review — plow end only. Advanced.
  "Quadruped twist to plow": clip("https://youtu.be/cVOCI43RjH4", 49, "Happy Back Yoga", "Plow"),
  "Slow nasal breathing": clip("https://youtu.be/Mg2ar-7_HfA", 78, "NewYork-Presbyterian Hospital", "Diaphragmatic breathing"),
  // TODO: human review — 126s, low-subscriber channel.
  "Head-to-toe joint circles": clip(
    "https://youtu.be/3301wCeUx0c?t=0",
    126,
    "Stephen Reiners",
    "Joint circles",
  ),
};

Object.assign(DEMO_FORM_VIDEOS, MOBILITY_FORM_VIDEOS);

for (const [name, seed] of Object.entries(combatFormVideoSeeds())) {
  if (DEMO_FORM_VIDEOS[name]) continue;
  DEMO_FORM_VIDEOS[name] = {
    url: seed.url,
    pending: seed.pending,
    channel: seed.channel,
    title: seed.title,
    seconds: seed.seconds,
  };
}

for (const [name, seed] of Object.entries(fighterFormVideoSeeds())) {
  if (DEMO_FORM_VIDEOS[name]) continue;
  DEMO_FORM_VIDEOS[name] = seed;
}

export function mobilityVideoUrl(name: string) {
  return MOBILITY_FORM_VIDEOS[name]?.url ?? "";
}

/** "Goblet squat · 2" is still the Goblet squat clip. */
export function catalogExerciseName(name: string) {
  return name.replace(/\s+·\s+\d+$/g, "").trim();
}

export function formVideoFieldsFor(name: string): {
  formVideoUrl: string;
  formVideoPending: boolean;
} {
  if (skipsFormVideo(name)) {
    return { formVideoUrl: "", formVideoPending: false };
  }
  const entry = DEMO_FORM_VIDEOS[name] ?? DEMO_FORM_VIDEOS[catalogExerciseName(name)];
  if (entry?.omit) {
    return { formVideoUrl: "", formVideoPending: false };
  }
  if (!entry || entry.pending) {
    return { formVideoUrl: "", formVideoPending: true };
  }
  return { formVideoUrl: entry.url, formVideoPending: false };
}

const YOUTUBE_HOSTS = new Set(["youtube.com", "m.youtube.com", "youtu.be"]);

function parsedYoutubeUrl(url: string): URL | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (!YOUTUBE_HOSTS.has(host)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isYoutubeShortsUrl(url: string): boolean {
  const parsed = parsedYoutubeUrl(url);
  if (!parsed) return false;
  return /\/shorts\/[^/?#]+/.test(parsed.pathname);
}

/** Learn / study links: a regular watch or youtu.be URL. Shorts stay off this path. */
export function isYoutubeWatchUrl(url: string): boolean {
  if (isYoutubeShortsUrl(url)) return false;
  return Boolean(youtubeVideoId(url));
}

/**
 * Train form link: Shorts, a verified sub-90s demo, or a watch URL with `t=`.
 * A long watch URL with no start time is not gym-floor usable.
 */
export function isYoutubeFormUrl(url: string): boolean {
  const id = youtubeVideoId(url);
  if (!id) return false;
  if (isYoutubeShortsUrl(url)) return true;
  if (youtubeStartSeconds(url) !== null) return true;
  const seconds = verifiedShortFormSeconds(id);
  return seconds !== null && seconds <= FORM_VIDEO_SHORT_MAX_SECONDS;
}

export function youtubeVideoId(url: string): string | null {
  const parsed = parsedYoutubeUrl(url);
  if (!parsed) return null;
  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  const shorts = parsed.pathname.match(/\/shorts\/([^/?#]+)/);
  if (shorts?.[1]) return shorts[1];
  if (host === "youtu.be") {
    const id = parsed.pathname.replace(/^\//, "").split("/")[0] ?? "";
    return id.length > 0 ? id : null;
  }
  return parsed.searchParams.get("v");
}

/** Start offset in seconds from `t=` (`90`, `90s`, `1m30s`). Missing `t` is null. */
export function youtubeStartSeconds(url: string): number | null {
  const parsed = parsedYoutubeUrl(url);
  if (!parsed) return null;
  const raw = parsed.searchParams.get("t") ?? parsed.searchParams.get("start");
  if (!raw) return null;
  return parseYoutubeTimestamp(raw);
}

/** End offset from `end=`. Missing `end` is null. */
export function youtubeEndSeconds(url: string): number | null {
  const parsed = parsedYoutubeUrl(url);
  if (!parsed) return null;
  const raw = parsed.searchParams.get("end");
  if (!raw || !/^\d+$/.test(raw)) return null;
  return Number(raw);
}

/**
 * Start and end the player should use. A verified short clip with no trim
 * still gets start=0 and end at its length so the embed does not buffer the
 * whole upload.
 */
export function formClipWindow(url: string): { start: number | null; end: number | null } {
  const start = youtubeStartSeconds(url);
  const end = youtubeEndSeconds(url);
  if (start != null || end != null) return { start, end };
  const id = youtubeVideoId(url);
  const seconds = id ? verifiedShortFormSeconds(id) : null;
  if (seconds != null && seconds <= FORM_VIDEO_SHORT_MAX_SECONDS) {
    return { start: 0, end: seconds };
  }
  return { start: null, end: null };
}

/**
 * Trim the catalog already wrote onto this video. A short with no `t` or `end`
 * in the catalog stays bare; the player still clips it through formClipWindow.
 */
function catalogDeclaredTrim(id: string): { start: number | null; end: number | null } | null {
  for (const entry of Object.values(DEMO_FORM_VIDEOS)) {
    if (!entry.url || youtubeVideoId(entry.url) !== id) continue;
    const start = youtubeStartSeconds(entry.url);
    const end = youtubeEndSeconds(entry.url);
    if (start != null || end != null) return { start, end };
  }
  return null;
}

/** Put `t` and `end` on a URL only when the catalog URL for that video already has them. */
export function ensureFormTrim(url: string): string {
  const id = youtubeVideoId(url);
  const declared = id ? catalogDeclaredTrim(id) : null;
  if (!declared) return url;
  const needsStart = youtubeStartSeconds(url) == null && declared.start != null;
  const needsEnd = youtubeEndSeconds(url) == null && declared.end != null;
  if (!needsStart && !needsEnd) return url;
  const parsed = parsedYoutubeUrl(url);
  if (!parsed) return url;
  if (needsStart) parsed.searchParams.set("t", String(declared.start));
  if (needsEnd) parsed.searchParams.set("end", String(declared.end));
  return parsed.toString();
}

/** In-app player. Does not open youtube.com. */
export function nocookieEmbedSrc(url: string): string | null {
  const id = youtubeVideoId(url);
  if (!id) return null;
  const params = new URLSearchParams({
    playsinline: "1",
    rel: "0",
    modestbranding: "1",
    enablejsapi: "1",
  });
  const clip = formClipWindow(url);
  if (clip.start != null) params.set("start", String(clip.start));
  if (clip.end != null) params.set("end", String(clip.end));
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

function parseYoutubeTimestamp(raw: string): number | null {
  if (/^\d+$/.test(raw)) return Number(raw);
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i.exec(raw);
  if (!match || (!match[1] && !match[2] && !match[3])) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function verifiedShortFormSeconds(id: string): number | null {
  for (const entry of Object.values(DEMO_FORM_VIDEOS)) {
    if (entry.pending || entry.seconds == null) continue;
    if (youtubeVideoId(entry.url) === id) return entry.seconds;
  }
  return null;
}

export function youtubeThumbSrcs(url: string): string[] {
  const id = youtubeVideoId(url);
  if (!id) return [];
  return [
    `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
  ];
}

export type FormVideoLookup = {
  url: string;
  pending: boolean;
  /** No technique video and no pending placeholder. Shadow rounds set this. */
  omit: boolean;
};

export function showFormVideoPending(form: FormVideoLookup) {
  if (form.omit) return false;
  return form.pending || !form.url;
}

export function lookupFormVideo(
  name: string,
  exercises?: Array<{ name: string; formVideoUrl: string; formVideoPending: boolean }>,
): FormVideoLookup {
  if (skipsFormVideo(name)) {
    return { url: "", pending: false, omit: true };
  }
  const fromDay =
    exercises?.find((row) => row.name === name) ??
    exercises?.find((row) => catalogExerciseName(row.name) === catalogExerciseName(name));
  if (
    fromDay?.formVideoUrl &&
    !fromDay.formVideoPending &&
    isYoutubeFormUrl(fromDay.formVideoUrl)
  ) {
    const seeded = formVideoFieldsFor(name);
    const sameClip =
      seeded.formVideoUrl &&
      youtubeVideoId(seeded.formVideoUrl) === youtubeVideoId(fromDay.formVideoUrl);
    const seedHasEnd = Boolean(seeded.formVideoUrl && youtubeEndSeconds(seeded.formVideoUrl) != null);
    const storedHasEnd = youtubeEndSeconds(fromDay.formVideoUrl) != null;
    const url = sameClip && seedHasEnd && !storedHasEnd ? seeded.formVideoUrl : fromDay.formVideoUrl;
    return { url: ensureFormTrim(url), pending: false, omit: false };
  }
  const seeded = formVideoFieldsFor(name);
  const entry = DEMO_FORM_VIDEOS[name] ?? DEMO_FORM_VIDEOS[catalogExerciseName(name)];
  if (entry?.omit) {
    return { url: "", pending: false, omit: true };
  }
  return {
    url: seeded.formVideoUrl ? ensureFormTrim(seeded.formVideoUrl) : "",
    pending: seeded.formVideoPending,
    omit: false,
  };
}
