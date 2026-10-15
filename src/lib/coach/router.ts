/**
 * Question-type router for SVG Coach.
 * Pure and synchronous. Never calls the network, and never decides
 * whether the live model runs — callers still try OpenAI whenever a key exists.
 */

export const QUESTION_TYPES = [
  "injury",
  "rules",
  "technique",
  "programming",
  "nutrition",
  "mindset",
  "fight_iq",
  "general",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export type CoachRoute = {
  primary: QuestionType;
  secondary: QuestionType[];
  signals: string[];
};

export type CoachLane = {
  topic?: string;
  art?: string;
  notepad?: boolean;
};

type Cue = {
  type: QuestionType;
  name: string;
  pattern: RegExp;
  points: number;
  nameFor?: (match: RegExpExecArray) => string;
};

const CUES: Cue[] = [
  { type: "injury", name: "pain", pattern: /\bpain\b/i, points: 2 },
  { type: "injury", name: "hurt", pattern: /\bhurts?\b/i, points: 2 },
  { type: "injury", name: "injury", pattern: /\binjur\w*/i, points: 2 },
  { type: "injury", name: "sprain", pattern: /\bsprains?\b/i, points: 2 },
  { type: "injury", name: "strain", pattern: /\bstrains?\b/i, points: 2 },
  { type: "injury", name: "tweak", pattern: /\btweaks?\b|\btweaked\b/i, points: 2 },
  { type: "injury", name: "swelling", pattern: /\bswell(?:ing|en|ed)?\b/i, points: 2 },
  { type: "injury", name: "popped", pattern: /\bpopped\b/i, points: 2 },
  { type: "injury", name: "numb", pattern: /\bnumb(?:ness)?\b/i, points: 2 },
  { type: "injury", name: "tingling", pattern: /\btingl\w*/i, points: 2 },
  { type: "injury", name: "concussion", pattern: /\bconcuss\w*/i, points: 2 },
  { type: "injury", name: "headache", pattern: /\bheadaches?\b/i, points: 2 },
  { type: "injury", name: "dizzy", pattern: /\bdizzy\b/i, points: 2 },
  { type: "injury", name: "head hit", pattern: /\b(?:hit in the head|from a hit)\b/i, points: 2 },
  { type: "injury", name: "rolled my ankle", pattern: /\brolled my ankle\b/i, points: 2 },
  { type: "injury", name: "torn", pattern: /\btorn\b/i, points: 2 },
  { type: "injury", name: "rehab", pattern: /\brehab\b/i, points: 2 },
  { type: "injury", name: "physio", pattern: /\bphysio\b/i, points: 2 },

  { type: "rules", name: "legal", pattern: /\blegal\b/i, points: 2 },
  { type: "rules", name: "illegal", pattern: /\billegal\b/i, points: 2 },
  { type: "rules", name: "allowed", pattern: /\ballowed\b/i, points: 2 },
  { type: "rules", name: "foul", pattern: /\bfouls?\b/i, points: 2 },
  { type: "rules", name: "banned", pattern: /\bbanned\b/i, points: 2 },
  { type: "rules", name: "rules", pattern: /\brules?\b/i, points: 2 },
  { type: "rules", name: "unified rules", pattern: /\bunified rules\b/i, points: 2 },
  { type: "rules", name: "ref", pattern: /\brefs?\b|\breferee\b/i, points: 2 },
  { type: "rules", name: "point deduction", pattern: /\bpoint deduction\b/i, points: 2 },
  { type: "rules", name: "DQ", pattern: /\bDQ\b/i, points: 2 },
  { type: "rules", name: "disqualification", pattern: /\bdisqualif\w*/i, points: 2 },
  { type: "rules", name: "commission", pattern: /\bcommission\b/i, points: 2 },
  { type: "rules", name: "sanction", pattern: /\bsanction\w*/i, points: 2 },
  { type: "rules", name: "amateur", pattern: /\bamateur\b/i, points: 2 },
  { type: "rules", name: "pro rules", pattern: /\bpro rules\b/i, points: 2 },
  { type: "rules", name: "12-6", pattern: /\b12[- ]?(?:to[- ])?6\b/i, points: 2 },
  { type: "rules", name: "IBJJF", pattern: /\bIBJJF\b/i, points: 3 },
  { type: "rules", name: "IJF", pattern: /\bIJF\b/i, points: 3 },
  { type: "rules", name: "WKF", pattern: /\bWKF\b/i, points: 3 },
  { type: "rules", name: "IFMA", pattern: /\bIFMA\b/i, points: 3 },
  { type: "rules", name: "WT", pattern: /\bWorld Taekwondo\b|\bWT rules\b/i, points: 3 },
  { type: "rules", name: "grounded opponent", pattern: /\bgrounded opponent\b/i, points: 2 },
  {
    type: "rules",
    name: "can i use",
    pattern: /\bcan i (use|throw|do|grab|hold)\b/i,
    points: 3,
    nameFor: (match) => `can i ${match[1].toLowerCase()}`,
  },
  { type: "rules", name: "is it ok to", pattern: /\bis it ok to\b/i, points: 3 },
  { type: "rules", name: "am i allowed", pattern: /\bam i allowed\b/i, points: 3 },

  { type: "technique", name: "frame", pattern: /\bframes?\b|\bframing\b/i, points: 2 },
  { type: "technique", name: "cage", pattern: /\bcages?\b/i, points: 2 },
  { type: "technique", name: "fence", pattern: /\bfences?\b/i, points: 2 },
  { type: "technique", name: "wall walk", pattern: /\bwall walk\b/i, points: 2 },
  { type: "technique", name: "wall", pattern: /\bwalls?\b/i, points: 2 },
  { type: "technique", name: "clinch", pattern: /\bclinch(?:ing)?\b/i, points: 2 },
  { type: "technique", name: "underhook", pattern: /\bunderhooks?\b/i, points: 2 },
  { type: "technique", name: "overhook", pattern: /\boverhooks?\b/i, points: 2 },
  { type: "technique", name: "whizzer", pattern: /\bwhizzers?\b/i, points: 2 },
  { type: "technique", name: "pummel", pattern: /\bpummels?\b|\bpummeling\b/i, points: 2 },
  { type: "technique", name: "takedown", pattern: /\btakedowns?\b/i, points: 2 },
  { type: "technique", name: "sprawl", pattern: /\bsprawls?\b/i, points: 2 },
  { type: "technique", name: "guard", pattern: /\bguards?\b/i, points: 2 },
  { type: "technique", name: "mount", pattern: /\bmounts?\b/i, points: 2 },
  { type: "technique", name: "side control", pattern: /\bside control\b/i, points: 2 },
  { type: "technique", name: "back take", pattern: /\bback takes?\b/i, points: 2 },
  { type: "technique", name: "crossface", pattern: /\bcross-?faces?\b/i, points: 2 },
  { type: "technique", name: "elbow", pattern: /\belbows?\b/i, points: 2 },
  { type: "technique", name: "knee", pattern: /\bknees?\b/i, points: 2 },
  { type: "technique", name: "jab", pattern: /\bjabs?\b/i, points: 2 },
  { type: "technique", name: "cross", pattern: /\bcross(?:es)?\b/i, points: 2 },
  { type: "technique", name: "hook", pattern: /\bhooks?\b/i, points: 2 },
  { type: "technique", name: "uppercut", pattern: /\buppercuts?\b/i, points: 2 },
  { type: "technique", name: "teep", pattern: /\bteeps?\b/i, points: 2 },
  { type: "technique", name: "kick", pattern: /\bkicks?\b/i, points: 2 },
  {
    type: "technique",
    name: "check",
    pattern: /\bchecks?\b(?!\s+(?:your|with|yours)\b)/i,
    points: 2,
  },
  { type: "technique", name: "stance", pattern: /\bstances?\b/i, points: 2 },
  { type: "technique", name: "footwork", pattern: /\bfootwork\b/i, points: 2 },
  { type: "technique", name: "escape", pattern: /\bescapes?\b/i, points: 2 },
  { type: "technique", name: "sweep", pattern: /\bsweeps?\b/i, points: 2 },
  { type: "technique", name: "submission", pattern: /\bsubmissions?\b/i, points: 2 },
  { type: "technique", name: "choke", pattern: /\bchokes?\b/i, points: 2 },
  { type: "technique", name: "armbar", pattern: /\barmbars?\b/i, points: 2 },
  { type: "technique", name: "get up", pattern: /\bget up\b/i, points: 2 },
  { type: "technique", name: "how do i", pattern: /\bhow do i\b/i, points: 2 },
  { type: "technique", name: "how to", pattern: /\bhow to\b/i, points: 2 },
  { type: "technique", name: "technique", pattern: /\btechniques?\b/i, points: 2 },
  { type: "technique", name: "position", pattern: /\bpositions?\b/i, points: 2 },
  {
    type: "technique",
    name: "against the cage",
    pattern: /\bagainst (?:the )?(?:cage|fence)\b/i,
    points: 2,
  },

  { type: "programming", name: "program", pattern: /\bprograms?\b/i, points: 2 },
  { type: "programming", name: "plan", pattern: /\bplans?\b/i, points: 2 },
  { type: "programming", name: "session", pattern: /\bsessions?\b/i, points: 2 },
  { type: "programming", name: "sets", pattern: /\bsets?\b/i, points: 2 },
  { type: "programming", name: "reps", pattern: /\breps?\b/i, points: 2 },
  { type: "programming", name: "RIR", pattern: /\bRIR\b/i, points: 2 },
  { type: "programming", name: "lbs", pattern: /\blbs?\b/i, points: 2 },
  { type: "programming", name: "pounds", pattern: /\bpounds?\b/i, points: 2 },
  { type: "programming", name: "kg", pattern: /\bkg\b/i, points: 2 },
  { type: "programming", name: "weight for", pattern: /\bweight (?:for|on)\b/i, points: 2 },
  { type: "programming", name: "how heavy", pattern: /\bhow heavy\b/i, points: 2 },
  { type: "programming", name: "deload", pattern: /\bdeloads?\b/i, points: 2 },
  { type: "programming", name: "squat", pattern: /\bsquats?\b/i, points: 2 },
  { type: "programming", name: "deadlift", pattern: /\bdeadlifts?\b/i, points: 2 },
  { type: "programming", name: "bench", pattern: /\bbench\b/i, points: 2 },
  { type: "programming", name: "press", pattern: /\bpress(?:es)?\b/i, points: 2 },
  { type: "programming", name: "row", pattern: /\brows?\b/i, points: 2 },
  { type: "programming", name: "pull-up", pattern: /\bpull-?ups?\b/i, points: 2 },
  { type: "programming", name: "conditioning", pattern: /\bconditioning\b/i, points: 2 },
  { type: "programming", name: "interval", pattern: /\bintervals?\b/i, points: 2 },
  { type: "programming", name: "bike", pattern: /\bbikes?\b/i, points: 2 },
  { type: "programming", name: "cardio", pattern: /\bcardio\b/i, points: 2 },
  { type: "programming", name: "gas tank", pattern: /\bgas tank\b/i, points: 2 },
  { type: "programming", name: "strength", pattern: /\bstrength\b/i, points: 2 },
  { type: "programming", name: "power", pattern: /\bpower\b/i, points: 2 },
  { type: "programming", name: "plyo", pattern: /\bplyo(?:metrics?)?\b/i, points: 2 },
  { type: "programming", name: "warm-up", pattern: /\bwarm-?ups?\b/i, points: 2 },
  { type: "programming", name: "recovery", pattern: /\brecovery\b/i, points: 2 },
  { type: "programming", name: "sore", pattern: /\bsore(?:ness)?\b/i, points: 1 },
  { type: "programming", name: "force-velocity", pattern: /\bforce[- ]velocity\b/i, points: 3 },
  { type: "programming", name: "energy systems", pattern: /\benergy systems?\b/i, points: 3 },
  { type: "programming", name: "taper", pattern: /\btapers?\b/i, points: 3 },
  { type: "programming", name: "fight camp", pattern: /\bfight camp\b/i, points: 2 },
  { type: "programming", name: "off-season", pattern: /\boff-season\b/i, points: 3 },
  { type: "programming", name: "in-season", pattern: /\bin-season\b/i, points: 3 },
  { type: "programming", name: "periodization", pattern: /\bperiodiz\w*/i, points: 3 },
  { type: "programming", name: "beginner week", pattern: /\bbeginners?\b/i, points: 2 },

  { type: "nutrition", name: "eat", pattern: /\beat(?:ing)?\b/i, points: 2 },
  { type: "nutrition", name: "food", pattern: /\bfoods?\b/i, points: 2 },
  { type: "nutrition", name: "meal", pattern: /\bmeals?\b/i, points: 2 },
  { type: "nutrition", name: "protein", pattern: /\bprotein\b/i, points: 2 },
  { type: "nutrition", name: "carbs", pattern: /\bcarbs?\b/i, points: 2 },
  { type: "nutrition", name: "fat", pattern: /\bfat\b/i, points: 2 },
  { type: "nutrition", name: "calorie", pattern: /\bcalorie\w*/i, points: 2 },
  { type: "nutrition", name: "macro", pattern: /\bmacro\w*/i, points: 2 },
  { type: "nutrition", name: "hydration", pattern: /\bhydrat\w*/i, points: 2 },
  { type: "nutrition", name: "water", pattern: /\bwater\b/i, points: 2 },
  { type: "nutrition", name: "supplement", pattern: /\bsupplement\w*/i, points: 2 },
  { type: "nutrition", name: "creatine", pattern: /\bcreatine\b/i, points: 2 },
  { type: "nutrition", name: "caffeine", pattern: /\bcaffeine\b/i, points: 2 },
  { type: "nutrition", name: "weigh-in", pattern: /\bweigh-?ins?\b/i, points: 2 },
  { type: "nutrition", name: "make weight", pattern: /\bmake weight\b/i, points: 2 },
  { type: "nutrition", name: "weight cut", pattern: /\bweight cuts?\b|\bcut weight\b/i, points: 2 },
  { type: "nutrition", name: "water cut", pattern: /\bwater cuts?\b/i, points: 3 },
  { type: "nutrition", name: "sauna", pattern: /\bsauna\b/i, points: 3 },
  { type: "nutrition", name: "rehydrate", pattern: /\brehydrat\w*/i, points: 2 },
  {
    type: "nutrition",
    name: "what to eat",
    pattern: /\bwhat should i eat\b/i,
    points: 3,
  },

  { type: "mindset", name: "nerves", pattern: /\bnerves\b/i, points: 2 },
  { type: "mindset", name: "nervous", pattern: /\bnervous\b/i, points: 2 },
  { type: "mindset", name: "anxious", pattern: /\banxious\b/i, points: 2 },
  { type: "mindset", name: "scared", pattern: /\bscared\b/i, points: 2 },
  { type: "mindset", name: "confidence", pattern: /\bconfidence\b/i, points: 2 },
  { type: "mindset", name: "motivation", pattern: /\bmotivation\b/i, points: 2 },
  { type: "mindset", name: "discipline", pattern: /\bdiscipline\b/i, points: 2 },
  { type: "mindset", name: "mindset", pattern: /\bmindset\b/i, points: 2 },
  { type: "mindset", name: "visualize", pattern: /\bvisuali\w*/i, points: 2 },
  { type: "mindset", name: "imagery", pattern: /\bimagery\b/i, points: 2 },
  { type: "mindset", name: "arousal", pattern: /\barousal\b/i, points: 2 },
  { type: "mindset", name: "self-talk", pattern: /\bself-talk\b/i, points: 2 },
  { type: "mindset", name: "freeze", pattern: /\bfreeze(?:s| up)?\b/i, points: 2 },
  { type: "fight_iq", name: "fight iq", pattern: /\bfight iq\b/i, points: 3 },
  { type: "fight_iq", name: "game plan", pattern: /\bgame ?plans?\b/i, points: 3 },
  { type: "fight_iq", name: "strategy", pattern: /\bstrateg(?:y|ies)\b/i, points: 2 },
  { type: "fight_iq", name: "study film", pattern: /\bstudy film\b|\bfilm study\b/i, points: 2 },
  { type: "fight_iq", name: "read", pattern: /\bread(?:ing)?\b/i, points: 2 },
  { type: "fight_iq", name: "counter", pattern: /\bcounter(?:s|ing)?\b/i, points: 2 },
  { type: "mindset", name: "focus", pattern: /\bfocus\b/i, points: 2 },
  { type: "mindset", name: "pressure", pattern: /\bpressure\b/i, points: 2 },
  { type: "mindset", name: "losing streak", pattern: /\blost\b|\blosing streak\b/i, points: 2 },
  { type: "mindset", name: "setback", pattern: /\bsetbacks?\b/i, points: 2 },
  { type: "mindset", name: "plateau", pattern: /\bplateau\b/i, points: 2 },
  { type: "mindset", name: "consistency", pattern: /\bconsistency\b/i, points: 2 },
  {
    type: "mindset",
    name: "missed",
    pattern: /\b(?:missed|skip(?:ped)?|fell off|inconsistent)\b/i,
    points: 2,
  },
];

const JOINT_PAIN =
  /\b(elbows?|knees?|shoulders?|back|neck)\b(?:\W+\w+){0,4}\W+\b(hurts?|pain|sore)\b|\b(hurts?|pain|sore)\b(?:\W+\w+){0,4}\W+\b(elbows?|knees?|shoulders?|back|neck)\b/i;

type Hit = {
  type: QuestionType;
  name: string;
  points: number;
  start: number;
  end: number;
};

function collectHits(text: string): Hit[] {
  const hits: Hit[] = [];
  for (const cue of CUES) {
    const flags = cue.pattern.flags.includes("g") ? cue.pattern.flags : `${cue.pattern.flags}g`;
    const re = new RegExp(cue.pattern.source, flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text))) {
      if (!match[0]) break;
      hits.push({
        type: cue.type,
        name: cue.nameFor ? cue.nameFor(match) : cue.name,
        points: cue.points,
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }
  const joint = JOINT_PAIN.exec(text);
  if (joint) {
    hits.push({
      type: "injury",
      name: "joint-pain",
      points: 3,
      start: joint.index,
      end: joint.index + joint[0].length,
    });
  }
  hits.sort(
    (a, b) => b.end - b.start - (a.end - a.start) || b.points - a.points || a.start - b.start,
  );
  const kept: Hit[] = [];
  for (const hit of hits) {
    const overlaps = kept.some((row) => hit.start < row.end && hit.end > row.start);
    if (overlaps) continue;
    kept.push(hit);
  }
  kept.sort((a, b) => a.start - b.start);
  return kept;
}

function emptyScores(): Record<QuestionType, number> {
  return {
    injury: 0,
    rules: 0,
    technique: 0,
    programming: 0,
    nutrition: 0,
    mindset: 0,
    fight_iq: 0,
    general: 0,
  };
}

function lanePrior(lane: CoachLane): QuestionType[] {
  if (lane.notepad && lane.topic === "martial_art") {
    return ["technique", "rules", "mindset", "programming"];
  }
  if (lane.notepad) {
    return ["programming", "nutrition", "injury", "technique"];
  }
  if (lane.topic === "martial_art") return ["technique", "rules", "fight_iq", "mindset"];
  if (lane.topic === "conditioning") return ["programming", "nutrition", "injury"];
  if (lane.topic === "mental") return ["mindset", "fight_iq", "nutrition"];
  return [];
}

function priorIndex(type: QuestionType, lane: CoachLane) {
  const prior = lanePrior(lane);
  const index = prior.indexOf(type);
  if (index >= 0) return index;
  return 100 + QUESTION_TYPES.indexOf(type);
}

function laneDefault(lane: CoachLane): QuestionType {
  if (lane.notepad && lane.topic === "martial_art") return "technique";
  if (lane.notepad) return "programming";
  if (lane.topic === "martial_art") return "technique";
  if (lane.topic === "conditioning") return "programming";
  if (lane.topic === "mental") return "mindset";
  return "general";
}

function isHowPhrasing(text: string) {
  return /\bhow (?:do i|to|can i|should i)\b/i.test(text);
}

/** A permission question, not a "how do I do this move" question. */
function isLegalityLed(text: string) {
  return (
    /\b(?:is it legal|is it illegal|is it allowed|am i allowed|is it ok to)\b/i.test(text) ||
    /\bare\b[^.?\n]{0,64}\b(?:legal|illegal|allowed|banned)\b/i.test(text)
  );
}

const GENERIC_TECHNIQUE = new Set(["how do i", "how to", "technique"]);

function stripGenericTechnique(scores: Record<QuestionType, number>, signals: string[]) {
  const techniqueNames = new Set(
    CUES.filter((cue) => cue.type === "technique").map((cue) => cue.name),
  );
  const present = signals.filter((name) => techniqueNames.has(name));
  if (present.length === 0) return;
  if (!present.every((name) => GENERIC_TECHNIQUE.has(name))) return;
  const otherExpert = QUESTION_TYPES.some(
    (type) => type !== "technique" && type !== "general" && scores[type] >= 2,
  );
  if (otherExpert) scores.technique = 0;
}

function prefersFightIq(text: string, scores: Record<QuestionType, number>) {
  if (scores.fight_iq < 2) return false;
  if (!/\b(read(?:ing)?|counters?|game ?plans?|fight iq|strateg(?:y|ies)|film study|study film)\b/i.test(text)) {
    return false;
  }
  if (/\bhow (?:do i|to) (?:throw|finish|hit|land|check|shoot|escape|pass|sweep|frame|sprawl)\b/i.test(text)) {
    return false;
  }
  return true;
}

function secondaryFor(
  scores: Record<QuestionType, number>,
  primary: QuestionType,
  pinned: QuestionType[] = [],
): QuestionType[] {
  const rest = QUESTION_TYPES.filter(
    (type) => type !== primary && type !== "general" && scores[type] >= 2 && !pinned.includes(type),
  );
  rest.sort((a, b) => scores[b] - scores[a] || a.localeCompare(b));
  return [...pinned, ...rest].filter((type) => type !== primary).slice(0, 2);
}

export function classifyQuestion(message: string, lane: CoachLane = {}): CoachRoute {
  const text = message.trim();
  const hits = collectHits(text);
  const scores = emptyScores();
  const signals: string[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    const key = `${hit.type}:${hit.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    scores[hit.type] += hit.points;
    signals.push(hit.name);
  }

  stripGenericTechnique(scores, signals);

  if (scores.injury >= 3) {
    return { primary: "injury", secondary: secondaryFor(scores, "injury"), signals };
  }

  if (scores.technique >= 2 && scores.rules >= 2) {
    const rulesLead =
      !isHowPhrasing(text) && (scores.rules >= scores.technique + 3 || isLegalityLed(text));
    if (rulesLead) {
      return {
        primary: "rules",
        secondary: secondaryFor(scores, "rules", ["technique"]),
        signals,
      };
    }
    if (prefersFightIq(text, scores)) {
      return {
        primary: "fight_iq",
        secondary: secondaryFor(scores, "fight_iq", ["technique"]),
        signals,
      };
    }
    return {
      primary: "technique",
      secondary: secondaryFor(scores, "technique", ["rules"]),
      signals,
    };
  }

  if (prefersFightIq(text, scores)) {
    return {
      primary: "fight_iq",
      secondary: secondaryFor(scores, "fight_iq"),
      signals,
    };
  }

  const ranked = QUESTION_TYPES.filter((type) => type !== "general" && scores[type] > 0);
  if (ranked.length === 0) {
    return { primary: laneDefault(lane), secondary: [], signals };
  }
  ranked.sort((a, b) => scores[b] - scores[a] || priorIndex(a, lane) - priorIndex(b, lane));
  const top = scores[ranked[0]];
  const tied = ranked.filter((type) => scores[type] === top);
  tied.sort((a, b) => priorIndex(a, lane) - priorIndex(b, lane));
  const primary = tied[0];
  return { primary, secondary: secondaryFor(scores, primary), signals };
}
