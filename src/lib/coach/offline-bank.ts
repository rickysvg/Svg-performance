import type { QuestionType } from "@/lib/coach/router";

export type OfflineBankEntry = {
  id: string;
  match: RegExp[];
  answer: string;
  /** Set on a catch-all for one question type. Specific matches win first. */
  domain?: QuestionType;
  fallback?: boolean;
};

const CAGE_FOREARM_FRAME = [
  "Short answer: Yes. A forearm or elbow frame on the jaw is legal when you are pushing, not striking.",
  "Position: You are pinned on the cage in the clinch, chest to chest, often with an underhook.",
  "Steps: 1. Win an underhook on one side if you can. 2. Slide the forearm across the jaw or chin. Keep the elbow tight, on bone, not the throat. 3. Push the head away and turn it. 4. Step the hips off the fence at an angle, then circle out or pummel. 5. Keep your head tight to theirs.",
  "Common mistakes: a straight arm gets dragged, so bend the elbow to the ribs. Framing the chest collapses, so use the jaw. Fingers toward the eyes are a foul. Grabbing the fence is a foul too.",
  "Drill: Partner pins you on the wall for 5 rounds of 30 seconds. Frame, turn the head, angle off. Go cooperative, then half speed, then live positional with a coach watching. No unsupervised hard sparring.",
  "Rules check: Framing and pushing are not a strike and are legal. Pulling the elbow back and driving it in is an elbow strike: legal under pro rules except to the back of the head, and most amateur rule sets ban elbows. A 12-6 elbow was removed as an ABC foul in 2024, and not every commission has adopted that. Check your commission or promotion.",
].join("\n\n");

const TECHNIQUE_FALLBACK = [
  "Short answer: start from the position, then one clean step, then a partner drill.",
  "Position: name where both people are, the grips, and the stance before the move.",
  "Mechanics: the weapon or the frame goes to a specific target, then you recover your base. Hands and head come home.",
  "Common mistakes: reaching, holding your breath, and adding speed before the shape is clean.",
  "Drill: cooperative reps, then half speed, then live positional with a coach watching. No unsupervised hard sparring.",
].join(" ");

const RULES_FALLBACK = [
  "Legality depends on the rule set. A foul in one sport can be legal in another.",
  "Pro Unified Rules of MMA allow elbow strikes except to the spine and the back of the head. The ABC removed the 12-6 elbow as a foul in the July 2024 revision, and not every commission has adopted that. Amateur MMA usually bans elbows and knees to the head.",
  "IBJJF bans heel hooks in the gi. IJF bans direct standing leg grabs. IFMA amateur Muay Thai usually bans elbows. WKF face contact depends on the category. Kickboxing usually bans elbows.",
  "Rules vary by commission and promotion, so check your commission/promotion.",
].join(" ");

const PROGRAMMING_FALLBACK = [
  "Do the sets already written on your plan. Main lifts stop at 4 sets. Accessories stop at 3. Keep the load in lbs and stay on the prescribed reps at the written RIR. 0-2 RIR is near hard. 2 RIR means about two clean reps left.",
  "If the plan or your last logged set is missing, do not invent numbers. Too easy: add a little load next time. Too hard or sore: keep the sets and drop the load.",
  "Heavy slow work builds force. Light fast work builds velocity. A 5-minute round needs repeatable work, not a random finisher. Lift before hard sparring only when the lift is the priority, and do not max out that day.",
  "Fight week and deload weeks stay lighter. No punishment volume after a miss.",
].join(" ");

const PERIODIZATION_FALLBACK = [
  "Base keeps skill volume and strength. Build gets more specific. Peak cuts volume and keeps speed. A taper in fight week drops volume again and cuts hard sparring. Do not add new techniques that week.",
  "Off-season is for capacity and holes in the game. In-season maintains strength with fewer hard exposures. A beginner gets a repeatable 2–4 day week, not a fight-camp template.",
  "Main lifts stay at 4 sets or fewer, accessories at 3, loads in lbs, effort in RIR. No punishment volume and no dehydration plan.",
].join(" ");

const NUTRITION_FALLBACK = [
  "Eat a real meal around training, with protein and carbs you digest. A useful protein range is about 0.7 to 1.0 grams per pound of walking-around weight, spread across the day. I will not build a calorie plan from a stored weight.",
  "Hydrate with meals and around training. That is a habit, not a weigh-in trick.",
  "If you are making weight, start weeks out and lose about 1% of body weight per week or slower from food. Red lines: no sauna suit, diuretic, laxative, water cut, or sweat-off protocol. A coach or clinician runs fight week.",
].join(" ");

const MINDSET_FALLBACK = [
  "Nerves mean you care. Settle arousal with a longer exhale than the inhale, then a short routine you can repeat: breath, cue word, first job in the round.",
  "Show up, do the work you planned, and leave. Instructional self-talk names the next action. I will not pile shame on you.",
  "If you are flat, stand tall, take one sharp breath, and say the cue word tied to the first action.",
].join(" ");

const FIGHT_IQ_FALLBACK = [
  "Read one habit first: stance, level change, or what they do after the jab.",
  "Plan one primary path and one backup. If they shoot, sprawl and get the whizzer. If they jab and exit, step off the line and answer with one shot. If you are on the fence, frame the head, win an underhook, and angle out.",
  "Drill it as a constrained round with a coach watching. No unsupervised hard sparring.",
  "If the opponent is not decided yet, prepare both a wrestler and a striker. Rewatch the tape after the fight and lock the plan then.",
].join(" ");

const INJURY_FALLBACK = [
  "Stop or modify that movement. Pain that changes how you move, swelling, numbness, chest pain, or anything in the head, including a headache after a hit, means stop and see a doctor or physio. Do not spar through head symptoms.",
  "If a clinician has not told you to stop training entirely, you can train other limbs or drill technique without that load. This is not a diagnosis or a rehab plan.",
].join(" ");

export const DOMAIN_FALLBACKS: Record<QuestionType, string> = {
  technique: TECHNIQUE_FALLBACK,
  rules: RULES_FALLBACK,
  programming: PROGRAMMING_FALLBACK,
  nutrition: NUTRITION_FALLBACK,
  mindset: MINDSET_FALLBACK,
  fight_iq: FIGHT_IQ_FALLBACK,
  injury: INJURY_FALLBACK,
  general: TECHNIQUE_FALLBACK,
};

const WRESTLER_PLAN = [
  "Read the level change and the lead foot before the hands.",
  "Plan one primary path and one backup. Primary: hands on the head, hips back, sprawl, whizzer, then stand or a clinch you chose. Backup: frame the head, win an underhook, and angle off the fence.",
  "If they shoot, sprawl. If they jab and level, paw the hand and circle off the lead foot. If you are under them, frame the neck and the hip before you accept the bottom.",
  "Drill a constrained round where they can only shoot and you can only defend and stand. A coach watches. No unsupervised hard sparring.",
].join(" ");

const STRIKER_PLAN = [
  "Read the jab and what the rear hand does after it.",
  "Plan one primary path and one backup. Primary: catch or slip the jab and answer with one shot, then exit. Backup: teep or check the kick and reset the stance.",
  "If they press, take an angle instead of walking straight back. If they kick the lead leg, check and step out. If you are on the fence, frame and circle.",
  "Drill it as a constrained round with a coach watching. No unsupervised hard sparring.",
].join(" ");

const UNKNOWN_OPPONENT = [
  "You do not know the winner yet, so do not build a one-style camp.",
  "Plan one path for a wrestler and one path for a striker. Wrestler: sprawl, whizzer, get back up. Striker: jab home, check the kick, exit on an angle.",
  "Split skill days until the card. After the fight, rewatch the tape once and lock a primary path plus a backup.",
  "Drill both as constrained rounds with a coach watching. No unsupervised hard sparring.",
].join(" ");

const CONDITIONING_ROUNDS = [
  "A 3- or 5-minute round is mostly aerobic with hard bursts you can repeat. The last round should look like the first.",
  "Count rounds. Do not replace that with one all-out finisher. Bike or bag intervals stay inside the round length.",
  "Lift before hard sparring only when the lift is the priority, and do not max out that day. No punishment volume after a miss.",
].join(" ");

const STRENGTH_SC = [
  "Do the sets already written on your plan. Main lifts stop at 4 sets. Accessories stop at 3. Loads stay in lbs. Effort is RIR. 2 RIR means about two clean reps left. 0-2 RIR is near hard.",
  "Heavy slow work builds force. Light fast work builds velocity. Power sits between them and stops when the bar slows down.",
  "If the log is empty, do not invent a number. Too easy: add a little load next time. Too hard or sore: keep the sets and drop the load.",
].join(" ");

const SCHEDULE_WEEK = [
  "Use the week already on your plan. Lift days stay lift days. Bag days stay bag days. Sparring day stays sparring. Do not stack a max lift on the sparring day.",
  "The day before sparring or class stays lighter. Main lifts stop at 4 sets. Accessories stop at 3. Loads in lbs, effort in RIR.",
  "A missed day is not a punishment day. Hit the next session that is already written.",
].join(" ");

const RECOVERY_NOTE = [
  "Soreness after honest work is normal. Walk, drink water, and keep the next session a little smaller if you need it. Sleep is part of the training.",
  "If pain changes how you move, stop and see a coach or a doctor. Do not spar through a headache or a head hit.",
].join(" ");

export const OFFLINE_BANK: OfflineBankEntry[] = [
  {
    id: "cage-forearm-frame",
    match: [/(?:cage|fence|wall)/i, /(?:elbow|forearm|frame)/i, /(?:jaw|chin|face|head)/i],
    answer: CAGE_FOREARM_FRAME,
  },
  {
    id: "unknown-opponent",
    domain: "fight_iq",
    match: [/winner of|unknown opponent|whoever wins|don'?t know (?:the |my )?opponent/i],
    answer: UNKNOWN_OPPONENT,
  },
  {
    id: "wrestler-plan",
    domain: "fight_iq",
    match: [/wrestler/i, /plan|prepare|prep|game|against|fight/i],
    answer: WRESTLER_PLAN,
  },
  {
    id: "striker-plan",
    domain: "fight_iq",
    match: [/striker|southpaw|boxer|kickbox/i, /plan|prepare|prep|game|against|counter|read/i],
    answer: STRIKER_PLAN,
  },
  {
    id: "conditioning-rounds",
    domain: "programming",
    match: [/conditioning|gas tank|energy system|interval|5[- ]?minute round|engine/i],
    answer: CONDITIONING_ROUNDS,
  },
  {
    id: "strength-sc",
    domain: "programming",
    match: [/squat|deadlift|rdl|bench|rir|how heavy|force[- ]velocity|strength/i],
    answer: STRENGTH_SC,
  },
  {
    id: "schedule-week",
    domain: "programming",
    match: [/schedule|which days|what should i do this week/i],
    answer: SCHEDULE_WEEK,
  },
  {
    id: "recovery-note",
    domain: "programming",
    match: [/sore|soreness|sleep|rest day|tired|wrecked|achy/i],
    answer: RECOVERY_NOTE,
  },
  {
    id: "periodization",
    domain: "programming",
    match: [/taper|fight week|fight camp|off-season|in-season|periodiz|beginner/i],
    answer: PERIODIZATION_FALLBACK,
  },
];

export function domainOfflineFallback(domain: QuestionType) {
  return DOMAIN_FALLBACKS[domain];
}

/** Specific bank hits only. Domain defaults are separate so art cues can win. */
export function matchOfflineBank(message: string, domain?: QuestionType): string | null {
  const text = message.trim();
  if (!text) return null;
  for (const entry of OFFLINE_BANK) {
    if (entry.fallback) continue;
    if (entry.domain && domain && entry.domain !== domain) continue;
    if (entry.domain && !domain) continue;
    if (!entry.match.every((pattern) => pattern.test(text))) continue;
    return entry.answer;
  }
  return null;
}
