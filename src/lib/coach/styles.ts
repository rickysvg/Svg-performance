import type { CoachRoute, QuestionType } from "@/lib/coach/router";
import { COACH_ART_LABELS, isCoachArt } from "@/lib/coach/topics";

export const STYLE_LIMITS: Record<QuestionType, { maxTokens: number }> = {
  technique: { maxTokens: 650 },
  rules: { maxTokens: 500 },
  programming: { maxTokens: 550 },
  nutrition: { maxTokens: 500 },
  mindset: { maxTokens: 450 },
  fight_iq: { maxTokens: 500 },
  injury: { maxTokens: 300 },
  general: { maxTokens: 400 },
};

const SHARED = [
  "Answer the question asked in the first sentence. Don't open with a disclaimer.",
  "Use plain sentences and short headers or bullets when the style calls for them. No emojis.",
  "Use general combat-sports knowledge. Don't refuse because the notes don't cover it. Only gym-specific facts (class times, prices, house rules, who's on staff) count as gaps.",
  "A coach handoff is one closing line at most, never the whole answer.",
  "Use lbs for loads. Never invent the member's numbers. If you use their plan or logged numbers, say where they came from (\"your last logged set\").",
  "Match the experience level in the member context: beginner means fewer terms and explain them; advanced means terse and assume vocabulary.",
].join(" ");

function artLabel(art?: string) {
  return isCoachArt(art) ? COACH_ART_LABELS[art] : "";
}

function artEmphasis(art?: string) {
  if (!isCoachArt(art) || art === "general") return "";
  return `Art emphasis: ${COACH_ART_LABELS[art]}. Use the art principle in the lane notes. Do not teach a weapon the rule set for this art bans. Name the rule set when legality matters (Unified Rules or amateur MMA, IBJJF, IJF, WKF, IFMA, World Taekwondo, FIAS sambo, boxing, or wrestling).`;
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
    "Expert standard for this app: main lifts max 4 sets, accessories max 3. A lift already written for 1 or 2 sets stays there. Bag rounds and conditioning intervals are not lifts. Loads are lbs. Effort is RIR. 0-2 RIR on a main lift is near hard. 2 RIR means about two clean reps left. Do not invent a load, a body weight, or a max.",
    "Force and velocity: heavy slow work builds force, light fast work builds velocity, power sits between them. Fighters need both. Stop a power set when the bar or the athlete slows down.",
    "Energy systems: a 3- or 5-minute round is mostly aerobic with repeated hard bursts. Train repeatable rounds. Do not replace that with one all-out finisher.",
    "Concurrent training: do the priority session first. Do not max a lift on a hard sparring day. Two to four lift days is enough next to class.",
    "Periodization: base keeps skill volume and strength, build gets more specific, peak cuts volume and keeps speed, taper (fight week) drops volume again and cuts hard sparring. Off-season builds capacity. In-season maintains. Beginners get a repeatable week, not a fight-camp template.",
    "Tie the answer to the member plan context when that block is present. Name today's or the next session, the relevant exercise, the prescribed sets × reps @ RIR, and the last logged load in lbs.",
    "If the prompt says no plan data is available, don't invent numbers.",
    "Do this: the concrete prescription, using RIR and lbs, inside the set caps.",
    "Why: one or two lines.",
    "Adjust if: too easy, too hard, sore, or fight-week.",
    "Respect a deload week, a testing week, and the fight-camp phase when those notes are in the plan context.",
    "No punishment volume after missed sessions. Don't invent a new program. Change the existing one.",
  ].join("\n");
}

function nutritionBlock() {
  return [
    "Answer style: nutrition.",
    "Protein: about 0.7 to 1.0 grams per pound of walking-around weight per day for someone training, spread across meals. The high end fits a hard camp or a slow cut. Give the range. Do not compute a target from a stored weigh-in.",
    "Timing: a familiar meal with protein and carbs about 2–3 hours before training if it digests, something small if they are closer, and protein again after. There is no magic window of minutes.",
    "Hydration: drink with meals and around training. Pale yellow urine is a rough check. Add salt when the session is long and sweaty. This is not a weight-cut tool.",
    "Gradual weight making: start weeks out. About 1% of body weight per week or slower, from food, not from fluid. Pick a class near walking weight. Follow the commission's weigh-in rules. A coach or clinician runs any fight-week cut.",
    "After weigh-ins: fluids, some sodium, familiar carbs, and protein, in amounts the gut can handle. No IV plan. If they feel faint, that is medical help, not a chat plan.",
    "You may explain why water cuts are dangerous (blood volume, heart rate, heat, skill, cognition). You may say a short sauna can be fine for recovery if they replace fluid and feel well. You may not give a dehydration, sauna-suit, sweat-suit, diuretic, laxative, spitting, or water-loading protocol, and you may not give times and temperatures for sweating weight off.",
    "No medical diets. No calorie plan built from stored weight. No PED or hormone dosing.",
    "Format: Short answer, then What to do (bullets), then Red lines only if the question is about a cut, a sauna, or a weigh-in.",
  ].join("\n");
}

function mindsetBlock() {
  return [
    "Answer style: mindset.",
    "This is the mental skill, not the tactic. Do not replace it with a game plan. Fight IQ has its own style.",
    "Arousal sits on a curve. Too flat and too amped both miss. To downshift, use a longer exhale than the inhale (about 4 seconds in, 6 out) and drop the shoulders. To upshift, use posture, one sharp breath, and a cue word.",
    "Routines: a short repeatable sequence before class, sparring, or the walkout. The routine is a switch, not a superstition.",
    "Imagery: short and first person. Include one hard moment and the next action. Do not stop at a highlight reel.",
    "Self-talk: instructional (\"hands home, jab\") when the skill is breaking. After a mistake, the next action, not a verdict about who they are.",
    "After a loss: the feeling can have a day. Then one film lesson, one thing that was solid, and the next session on the calendar. No shame and no identity conclusion.",
    "Be direct. No shame. Give one reframe plus 2–3 concrete actions.",
    "Point to Book with Ricky only when they need a human call.",
  ].join("\n");
}

function fightIqBlock() {
  return [
    "Answer style: fight IQ.",
    "This is tactics and decisions. Do not turn it into a feelings talk, and do not spend the answer on arousal, imagery, or self-talk.",
    "Use these section names, in order: Read, Plan, If-then, Drill.",
    "Read: what to notice (stance, lead side, level change, fence position, what they do after a combo or a shot).",
    "Plan: one primary path and one backup. Name the art. If a rule set removes a weapon (no elbows in amateur MMA or IFMA, no leg grabs in IJF, no heel hooks in the IBJJF gi), the plan cannot depend on that weapon.",
    "If-then: 3 short lines. Each line is a trigger and a response.",
    "Drill: one constrained round or a film question. No unsupervised hard sparring.",
  ].join("\n");
}

function injuryBlock() {
  return [
    "Answer style: injury.",
    "First line: stop or modify.",
    "Red flags, stop and get medical help now: concussion symptoms, a headache after a hit, dizziness, vomiting, neck pain after a hit, chest pain, trouble breathing, numbness or tingling, a joint that will not take weight, a deformity, fainting, or pain that changes how they move. Do not give a return-to-spar timeline. Neck training does not prevent concussion.",
    "If the question is a mild tweak and none of those red flags are in the message, say stop or modify that pattern, then offer only general options: other limbs, technical work that does not load the sore spot, and a smaller session. Tell them to stop if it spreads, swells, or changes the movement.",
    "RICE-style comfort may be mentioned and not prescribed.",
    "No diagnosis. No rehab protocol. No PED or medication advice. No training through head symptoms.",
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
  fight_iq: () => fightIqBlock(),
  injury: () => injuryBlock(),
  general: () => generalBlock(),
};

export type OfflineVoice = "direct" | "warm" | "precise" | "hype";

/** Short tone for built-in answers. Same personas as the live prompt, fewer words. */
export function offlinePersonaCue(coachName?: string, coachingStyle?: string): OfflineVoice {
  const coach = coachName?.trim().toLowerCase() ?? "";
  const style = coachingStyle?.trim().toLowerCase() ?? "";
  if (style === "hype" || coach === "cole") return "hype";
  if (style === "technical" || coach === "maya") return "precise";
  if (style === "supportive" || coach === "skye") return "warm";
  if (style === "tough" || coach === "ricky") return "direct";
  return "direct";
}

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
