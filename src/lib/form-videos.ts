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
  url: "https://www.youtube.com/watch?v=nfX7IFK9UNI",
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
const singleLegRdl = ready({
  url: "https://www.youtube.com/watch?v=6pEL3KxnlEo",
  seconds: 22,
  channel: "National Academy of Sports Medicine (NASM)",
  title: "How to do a Single-Leg Romanian Deadlift",
});
const lunge = ready({
  url: "https://www.youtube.com/watch?v=71VE3ssaJuQ",
  seconds: 44,
  channel: "ATHLEAN-X",
  title: "How To ACTUALLY Do Lunges (Feat. The “Rock”)",
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
  url: "https://www.youtube.com/watch?v=qFTnmyC-nf4",
  seconds: 23,
  channel: "National Academy of Sports Medicine (NASM)",
  title: "How to do a Single-Arm Dumbbell Chest Press | Proper Form & Technique | NASM",
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
const halfKneelRow = ready({
  url: "https://www.youtube.com/watch?v=Lk4H4rHS2b0",
  seconds: 63,
  channel: "Cody Taggart Exercise Demonstrations",
  title: "How to perform: Half kneeling DB row",
});
const overheadPress = ready({
  url: "https://www.youtube.com/watch?v=MMjBnEBnZKM",
  seconds: 12,
  channel: "National Academy of Sports Medicine (NASM)",
  title: "How to do a Dumbbell Overhead Press",
});
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
  url: "https://www.youtube.com/watch?v=MJdqtIIyz-A",
  seconds: 78,
  channel: "Assault Fitness",
  title: "Assault Fitness Tuesday Tips: AirBike Form Corrections",
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
  url: "https://www.youtube.com/watch?v=FgON_5YZ0NI",
  seconds: 39,
  channel: "Phil Daru",
  title: "Landmine Exercise for Combat Sports",
});
const rotationalThrow = ready({
  url: "https://www.youtube.com/watch?v=ivF-vzxhL3s",
  seconds: 83,
  channel: "TrainFTW",
  title: "Rotational Medicine Ball Throw",
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
const neckExtension = ready({
  url: "https://www.youtube.com/watch?v=ZvR3OFs4HN8",
  seconds: 30,
  channel: "fightperformanceindustries",
  title: "Neck extension. Neck training for combat sports",
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
  url: "https://www.youtube.com/watch?v=0CF1hdvTM2U",
  seconds: 73,
  channel: "Jodi Travaglia",
  title: "Jump rope tutorial - proper form, double bounce, single bounce",
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
const jab = ready({
  url: "https://www.youtube.com/watch?v=1wCQLFhipbE",
  seconds: 58,
  channel: "Tribute Boxing & Fitness",
  title: "Boxing Tips 101 | HOW TO: JAB",
});
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
const slip = ready({
  url: "https://www.youtube.com/watch?v=GpnfB_7OHhM",
  seconds: 26,
  channel: "KoYu Boxing",
  title: "Perfect Jab / Slip / Hook boxing combo. Boxing Tutorial",
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
  url: "https://www.youtube.com/watch?v=Gw_Gf9jRvTM",
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
  url: "https://www.youtube.com/watch?v=WtwvM9l-W74",
  seconds: 44,
  channel: "Nicholas Coleman",
  title: "Dumbbell PullOver - Learn how to exercise with a NASM CPT",
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
  url: "https://www.youtube.com/watch?v=OnD0suBzPQg",
  seconds: 15,
  channel: "Kristin Simone",
  title: "Dumbbell hip thrust",
});
const lateralLunge = ready({
  url: "https://www.youtube.com/watch?v=2z9q1zmwcSk",
  seconds: 48,
  channel: "Fitness With Tross",
  title: "The Lateral Lunge | Movement Demo",
});

export const DEMO_FORM_VIDEOS: Record<string, FormVideoSeed> = {
  "Goblet squat": goblet,
  "Romanian deadlift": rdl,
  "Reverse lunge": lunge,
  "Squat jump or box step-up": squatJump,
  "Front plank": plank,
  "Push-up or dumbbell bench press": pushUp,
  "Dumbbell bench press": dbBench,
  "Push-up": pushUp,
  "Pause push-up": pushUp,
  "Close-grip push-up": pushUp,
  "Feet-elevated push-up": pushUp,
  "Incline push-up": pushUp,
  "Push-up to side plank": pushUp,
  "Squat jump": squatJump,
  "Lateral lunge": lateralLunge,
  "Lateral bound": lateralBound,
  "Side plank with reach": sidePlank,
  "One-arm row": oneArmRow,
  "Overhead press": overheadPress,
  "Band pull-apart or face pull": facePull,
  "Farmer carry": farmer,
  "Kettlebell swing or hip hinge": swing,
  "Chin-up, band-assist, or lat pulldown": pullUp,
  "Lateral bound or side step-over": lateralBound,
  "Assault bike intervals": airBike,
  "Daru alactic power bike": airBike,
  "Jamieson tempo bike": airBike,
  "Daru 75% endurance bike": airBike,
  "Jamieson cardiac output bike": airBike,
  "Leon Edwards 10/20 bike finisher": airBike,
  "Trap-bar deadlift": trapBar,
  "Floor press": floorPress,
  "Landmine press": landminePress,
  "Rotational med-ball throw": rotationalThrow,
  "Med-ball chest pass": chestPass,
  "Sled push": sledPush,
  "Sled hamstring drag": sledDrag,
  "Farmer's carry": farmer,
  "Banded kettlebell swing": bandedSwing,
  "Neck isometric matrix": PENDING,
  "Neck extension hold": neckExtension,
  "Banded DB front-rack march": frontRackMarch,
  "Bent-over DB shrug": shrug,
  "Jump rope or easy bike intervals": jumpRope,
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
  "Lead hook": hook,
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
  "Bag rounds — body shots": hook,
  "Bag rounds — clinch knees": clinchKnee,
  "Bag rounds — defense & counters": parry,
  "Bag rounds — power & speed": jab,
  "Shadowbox round 1 — empty hands": NO_FORM_VIDEO,
  "Shadowbox round 2 — hand weights": NO_FORM_VIDEO,
  "Jab — step and snap": jab,
  "Slip then jab–cross": slip,
  "Level change into the jab": jab,
  "Switch-step teep": teep,
  "Body hook": hook,
  "Punch into the clinch knee": clinchKnee,
  "Roll under then body hook": hook,
  "Body jab trap": jab,
  "Check and answer kick": lowKick,
  "Boxing step-off combo": oneTwo,
  "Elbow then knee": elbow,
  "Parry and cross": parry,
  "Bag rounds — intelligent jab": jab,
  "Bag rounds — teeps and low kicks": teep,
  "Bag rounds — hooks and pivot": hook,
  "Bag rounds — defense counters": parry,
  "Bag rounds — speed and power": jab,
  "Bag rounds — level changes": doubleLeg,
  "Bag rounds — switch entries": teep,
  "Bag rounds — body hooks": hook,
  "Bag rounds — boxing to knees": clinchKnee,
  "Bag rounds — level counters": parry,
  "Bag rounds — pivot power": hook,
  "Bag rounds — body jab traps": jab,
  "Bag rounds — kick counters": lowKick,
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
  "Cable or band Pallof press": pallof,
  "Dumbbell high pull": highPull,
  "Straight-arm pulldown": straightArm,
  "Dumbbell pullover": pullover,
  "Plyo push-up": plyoPushUp,
  "Landmine rotation": landmineRotation,
  "Dumbbell step-up": stepUp,
  "Broad jump": broadJump,
  "Dumbbell hip thrust": hipThrust,
  "Dumbbell lateral lunge": lateralLunge,
};

export function formVideoFieldsFor(name: string): {
  formVideoUrl: string;
  formVideoPending: boolean;
} {
  if (skipsFormVideo(name)) {
    return { formVideoUrl: "", formVideoPending: false };
  }
  const entry = DEMO_FORM_VIDEOS[name];
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
  const raw = parsed.searchParams.get("t");
  if (!raw) return null;
  return parseYoutubeTimestamp(raw);
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
  const fromDay = exercises?.find((row) => row.name === name);
  if (
    fromDay?.formVideoUrl &&
    !fromDay.formVideoPending &&
    isYoutubeFormUrl(fromDay.formVideoUrl)
  ) {
    return { url: fromDay.formVideoUrl, pending: false, omit: false };
  }
  const seeded = formVideoFieldsFor(name);
  const entry = DEMO_FORM_VIDEOS[name];
  if (entry?.omit) {
    return { url: "", pending: false, omit: true };
  }
  return { url: seeded.formVideoUrl, pending: seeded.formVideoPending, omit: false };
}
