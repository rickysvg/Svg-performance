import type { CoachRoute, QuestionType } from "@/lib/coach/router";
import { COACH_ART_LABELS, isCoachArt } from "@/lib/coach/topics";

export const STYLE_LIMITS: Record<QuestionType, { maxTokens: number }> = {
  technique: { maxTokens: 650 },
  rules: { maxTokens: 500 },
  programming: { maxTokens: 550 },
  nutrition: { maxTokens: 500 },
  mindset: { maxTokens: 450 },
  injury: { maxTokens: 300 },
  general: { maxTokens: 400 },
};

const SHARED = [
  "Answer the question asked in the first sentence. Don't open with a disclaimer.",
  "Use plain sentences and short headers or bullets when the style calls for them. No emojis.",
  "Use general combat-sports knowledge. Don't refuse because the DEMO notes don't cover it. Only gym-specific facts (class times, prices, house rules, who's on staff) count as gaps.",
  "A coach handoff is one closing line at most, never the whole answer.",
  "Use lbs for loads. Never invent the member's numbers. If you use their plan or logged numbers, say where they came from (\"your last logged set\").",
  "Match the experience level in the member context: beginner means fewer terms and explain them; advanced means terse and assume vocabulary.",
].join(" ");

function artLabel(art?: string) {
  return isCoachArt(art) ? COACH_ART_LABELS[art] : "";
}

function artEmphasis(art?: string) {
  if (art === "mma" || art === "cagework") {
    return "Art emphasis: the cage is a tool (wall-walk, frames, underhooks on the fence). Grabbing the fence with fingers or toes is a foul.";
  }
  if (art === "boxing") {
    return "Art emphasis: boxing. No clinch-fighting advice beyond referee breaks.";
  }
  if (art === "muay-thai") {
    return "Art emphasis: Muay Thai. Elbows and clinch knees are allowed under most Thai rules. Amateur rules vary.";
  }
  if (art === "wrestling" || art === "jiu-jitsu") {
    return "Art emphasis: no strikes. Frames are for space, not damage.";
  }
  return "";
}

function techniqueBlock(route: CoachRoute, art?: string) {
  const rules = route.secondary.includes("rules")
    ? [
        "Rules check: 2–4 bullets on legality.",
        "Say whether the move is a push or a strike.",
        "Cover the pro Unified Rules note and how amateur rules usually differ.",
        "End the Rules check with: check your commission or promotion.",
      ].join(" ")
    : "";
  return [
    "Answer style: technique.",
    "Use these section names, in this order: short answer, Position, Mechanics, Common mistakes, Drill.",
    rules ? "Then add Rules check." : "",
    "Short answer: 1–2 sentences. Answer yes, no, or how directly.",
    "Position: where both fighters are and what grips and stance they have.",
    "Mechanics: 3–6 numbered steps. Say which body part goes where (bone-on-bone frames, elbow tight to ribs, hips, head position, base), then the follow-up (angle out, re-pummel, stand up, strike).",
    "Common mistakes: 3–4 bullets, each with the fix.",
    "Drill: one partner drill with a rep or round scheme, a resistance progression (cooperative, then 50%, then live positional), and a safety note. No unsupervised hard sparring.",
    rules,
    artEmphasis(art),
  ]
    .filter(Boolean)
    .join("\n");
}

function rulesBlock() {
  return [
    "Answer style: rules.",
    "Verdict: Legal, Illegal, or Depends, plus one sentence on why.",
    "Under the Unified Rules (pro): cite the specific foul or permission. Use the file mma-rules.md when it applies and name that file.",
    "Amateur rules: say how they usually differ. Many amateur rule sets ban all elbow and forearm strikes and knees to the head.",
    "Gray areas / ref discretion: intent, repeated warnings, and the line between a push and a strike.",
    "Close with: Rules vary by commission and promotion, so check the rules meeting for your event or ask your commission. For El Paso fights, that's Texas TDLR.",
    "Never state a rule as universal when it varies by jurisdiction. Say check your commission.",
  ].join("\n");
}

function programmingBlock() {
  return [
    "Answer style: programming.",
    "Tie the answer to the member plan context when that block is present. Name today's or the next session, the relevant exercise, the prescribed sets × reps @ RIR, and the last logged load in lbs.",
    "If the prompt says no plan data is available, don't invent numbers.",
    "Do this: the concrete prescription, using RIR (0-2 RIR is near hard) and lbs.",
    "Why: one or two lines.",
    "Adjust if: too easy, too hard, sore, or fight-week.",
    "Respect a deload week, a testing week, and the fight-camp phase when those notes are in the plan context.",
    "No punishment volume after missed sessions. Don't invent a new program. Change the existing one.",
  ].join("\n");
}

function nutritionBlock() {
  return [
    "Answer style: nutrition.",
    "Practical food guidance: protein as a range per lb of bodyweight, meal timing around training, hydration habits, and fight-week basics.",
    "Weight cut: lose weight gradually through diet over weeks, pick a class near walking weight, follow the commission's weigh-in and hydration rules, and get a coach or clinician for any camp cut.",
    "Never give dehydration, sauna, sweat-suit, diuretic, laxative, spitting, or water-loading protocols.",
    "No medical diets. No calorie plan built from stored weight.",
    "Format: Short answer, then What to do (bullets), then Red lines only if the question is about a cut or a weigh-in.",
  ].join("\n");
}

function mindsetBlock() {
  return [
    "Answer style: mindset.",
    "Be direct. No shame. Give one reframe plus 2–3 concrete actions (a pre-round routine, breathing, a cue word, film study with a specific question to answer, or one game-plan if-then).",
    "Fight IQ questions (strategy, reading opponents, cage control) can go tactical.",
    "Point to Book with Ricky only when they need a human call.",
  ].join("\n");
}

function injuryBlock() {
  return [
    "Answer style: injury.",
    "First line: stop or modify. Pain that changes movement, swelling, numbness or tingling, or anything head-related means stop and see a doctor or physio.",
    "Then only general, non-diagnostic options: train around it (other limbs, technique without load). RICE-style comfort may be mentioned and not prescribed.",
    "No diagnosis and no rehab protocol.",
  ].join("\n");
}

function generalBlock() {
  return [
    "Answer style: general.",
    "Answer directly in 2–5 sentences. If the question is ambiguous, give the best answer plus one clarifying question.",
  ].join("\n");
}

const BLOCKS: Record<QuestionType, (route: CoachRoute, art?: string) => string> = {
  technique: techniqueBlock,
  rules: () => rulesBlock(),
  programming: () => programmingBlock(),
  nutrition: () => nutritionBlock(),
  mindset: () => mindsetBlock(),
  injury: () => injuryBlock(),
  general: () => generalBlock(),
};

export function styleInstructions(
  route: CoachRoute,
  lane: { topic?: string; art?: string } = {},
): string {
  const primary = BLOCKS[route.primary](route, lane.art);
  const extra = route.secondary
    .filter((type) => type !== route.primary)
    .map((type) => `Also cover ${type} briefly, without changing the primary format.`)
    .join(" ");
  const label = artLabel(lane.art);
  return [SHARED, label ? `Lane art: ${label}.` : "", primary, extra].filter(Boolean).join("\n\n");
}
