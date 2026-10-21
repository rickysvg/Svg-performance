import { dayList, type OfflineMemberFacts } from "@/lib/coach/member-facts";
import { domainOfflineFallback, matchOfflineBank } from "@/lib/coach/offline-bank";
import type { CoachIntent } from "@/lib/coach/router";
import { offlinePersonaCue, type OfflineVoice } from "@/lib/coach/styles";
import { campPhasePlan, resolveWhen, weeksUntil } from "@/lib/coach/timeframe";

export type ComposeInput = {
  message: string;
  intent: CoachIntent;
  topic?: string;
  art?: string;
  coachName?: string;
  coachingStyle?: string;
  facts?: OfflineMemberFacts | null;
  now?: Date;
};

function bullets(lines: string[]) {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5)
    .map((line) => `• ${line}`)
    .join("\n");
}

function block(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join("\n\n");
}

function limitationLine(facts?: OfflineMemberFacts | null) {
  const note = facts?.limitations?.trim();
  if (!note) return "";
  return `Work around what is on file: ${note}. If it changes how you move, stop and see a coach or a doctor.`;
}

function campDirect(voice: OfflineVoice, label: string, weeks: number | null) {
  const when = label || "That date";
  const span =
    weeks == null
      ? "a real camp, not a one-week peak"
      : `about ${weeks} week${weeks === 1 ? "" : "s"} out`;
  if (voice === "warm") {
    return `${when} is ${span}. You have time. The job right now is a base and strength block. Nerves can wait until the week gets close.`;
  }
  if (voice === "precise") {
    return `${when} is ${span}. This phase is base and strength: skill volume, force, and rounds you can repeat. Fight week is the last block, not this one.`;
  }
  if (voice === "hype") {
    return `${when}. ${span.charAt(0).toUpperCase()}${span.slice(1)}. Build now. Get sharp later. Do the block in front of you.`;
  }
  return `${when} is the fight. You are ${span}. Right now is base and strength. Do not peak early, and do not turn this into a nerves talk.`;
}

function campActions(message: string, facts?: OfflineMemberFacts | null) {
  const lifts = dayList(facts?.liftDays, "your lift days");
  const bags = dayList(facts?.bagDays, "your bag days");
  const spar = dayList(facts?.sparringDays, "the sparring day already on your week");
  const unknown = /\bwinner of|main event|cfc|whoever wins|unknown opponent/i.test(message);
  const bagCue = facts?.bagDays?.length
    ? `Bag work on ${bags}. Build the jab, the level change, and getting off the fence. Themed rounds, then stop.`
    : "Bag work is separate from the strength week. Build the jab, the level change, and getting off the fence. Themed rounds, then stop.";
  const lines = [
    `Lift on ${lifts}. Stay on the written reps at the written RIR. Main lifts stop at 4 sets. Accessories stop at 3.`,
    bagCue,
    `Sparring stays on ${spar}. Early rounds stay technical. A coach runs anything hard.`,
    "Sleep and eat normal meals. If weight has to move, do it slowly from food, about 1% a week. No water cut.",
  ];
  if (unknown) {
    lines.push(
      "Until that main event is over, split skill between a sprawl and whizzer and a jab that exits. Rewatch the winner once, then write one path and one backup.",
    );
  } else {
    lines.push(
      "Keep one skill theme per bag day. Do not add a new technique in the last two weeks.",
    );
  }
  const limit = limitationLine(facts);
  if (limit) lines.splice(3, 0, limit);
  return lines.slice(0, 5);
}

function campFollow(message: string) {
  if (/\bwinner of|main event|cfc|whoever wins/i.test(message)) {
    return "Who do you think wins that main event, a wrestler or a striker?";
  }
  return "Do you know the opponent's style yet, or are you preparing for both a wrestler and a striker?";
}

function fightCampAnswer(input: ComposeInput, now: Date) {
  const voice = offlinePersonaCue(input.coachName, input.coachingStyle);
  const when = resolveWhen(input.message, now, input.facts?.fightDate);
  const weeks = when ? weeksUntil(when.date, now) : null;
  const label =
    when?.source === "saved" ? `Your saved fight date (${when.label})` : when?.label || "";
  const phases =
    weeks == null
      ? [
          "Base / strength first. Skill volume, lifts, and aerobic rounds you can repeat.",
          "Specific prep next. The work starts to look like the fight.",
          "Peak after that. Less volume, keep speed, ease hard sparring.",
          "Fight week last. Short and sharp. Nothing new.",
        ]
      : campPhasePlan(weeks).map((phase) => `${phase.title}. ${phase.detail}`);
  const heading = weeks == null ? "Plan" : `Plan, about ${weeks} week${weeks === 1 ? "" : "s"}`;
  return block([
    campDirect(voice, label, weeks),
    `${heading}\n${bullets(phases)}`,
    `Do this\n${bullets(campActions(input.message, input.facts))}`,
    campFollow(input.message),
  ]);
}

function listBlock(title: string, lines: string[], follow: string, direct: string) {
  return block([direct, `${title}\n${bullets(lines)}`, follow]);
}

const ART_TECHNIQUE: Record<string, string> = {
  boxing:
    "Hands up. Sit on your stance. Throw a short straight jab and snap it back to guard. Chin stays in. Feet step without crossing. Then have a coach watch one round.",
  "muay-thai":
    "Posture first, then the weapon. Chamber the kick or teep, hit with the shin or the ball of the foot, and recover on the standing leg. Don't throw yourself into the shot. Traditional Thai rules usually allow elbows and a long clinch. IFMA amateur usually bans elbows. Check the card.",
  wrestling:
    "Level change, stay in your stance, and finish on your feet. Head stays tight. Don't dive on a bad shot. Get a coach to watch one live go. No strikes in folkstyle, freestyle, or Greco.",
  "jiu-jitsu":
    "Frames first, then the hips. Make one clean move and reset. An armbar needs the angle, the knees tight, and the hips in. Tap early. IBJJF bans heel hooks in the gi.",
  kickboxing:
    "Stay in a kickboxing stance, turn the hip, and meet the target with the shin. Bring the leg home. Most kickboxing rules ban elbows and keep the clinch short. Have a coach watch one round.",
  judo:
    "Break balance first, then commit the hips into the throw. For osoto, reap the leg you have already moved them onto. Under IJF rules, do not grab the leg with your hand in standing. Practice the fall.",
  karate:
    "Keep the front knee stacked, turn the back hip, and send a short reverse punch. Recover the stance and the hand. WKF face contact depends on the category, so keep the touch controlled until a coach says otherwise.",
  taekwondo:
    "Chamber the kick, turn the hip, and put the foot back down on a live base. Head kicks score in World Taekwondo. Punches to the head do not. Retract before you admire the kick.",
  sambo:
    "Grip the jacket, get the hips in, and finish the throw. Do not stall on the cloth. Sport sambo has no chokes and no strikes. Combat sambo is a different rule set. Practice the fall.",
  "catch-wrestling":
    "From the front headlock, keep the head and arm tight, step to the side, and turn them to a pin. Control the body. Do not crank the neck. A tap ends the rep.",
  mma:
    "Start from the position: frame in, elbow tight, then one step off the fence. Win an underhook, turn the head, and angle out. Don't grab the fence. A forearm frame on the jaw is a push, not a strike.",
  cagework:
    "Start from the position on the cage: frame in, elbow tight, then one step off the fence. Win an underhook, turn the head, and angle out. Drill the position with a partner before you add speed. Don't grab the fence.",
};

function techniqueAnswer(input: ComposeInput) {
  const art = input.art && ART_TECHNIQUE[input.art] ? input.art : "";
  const direct =
    (art && ART_TECHNIQUE[art]) ||
    "Start with the position, then one clean step, then a partner drill. Keep the frame or the hands where they belong. Get a coach to watch the rep before you add speed.";
  return listBlock(
    "Do this",
    [
      "Name the position and the grips before you move.",
      "One clean rep, then reset. Add speed only after the shape stays.",
      "Partner drill: cooperative, then half speed, then live positional with a coach watching.",
      "No unsupervised hard sparring.",
    ],
    "Which position is actually failing: the entry, the finish, or the exit?",
    direct,
  );
}

function mindsetAnswer() {
  return listBlock(
    "Do this",
    [
      "Longer exhale than the inhale, about 4 seconds in and 6 out, shoulders down.",
      "A short routine you can repeat: breath, cue word, first job in the round.",
      "Instructional self-talk names the next action. After a miss, throw the next shot. No verdict about who you are.",
      "Show up, do the work you planned, and leave.",
    ],
    "Is this the night before, or are you freezing once the round starts?",
    domainOfflineFallback("mindset"),
  );
}

function weightCutAnswer() {
  return listBlock(
    "Do this",
    [
      "Start weeks out. Lose about 1% of body weight per week or slower from meals, not from fluid.",
      "Keep protein in each meal and eat carbs around training.",
      "Hydrate on a normal schedule until the rules for your weigh-in say otherwise.",
      "Red lines: no sauna suit, sweat suit, diuretic, laxative, or water-cut protocol.",
    ],
    "How many weeks out is the fight, and is the class close to walking weight?",
    "Start a weight cut weeks out and lose about 1% of body weight per week or slower through meals, not in the last day. Keep protein in each meal, eat carbs around training, and hydrate on a normal schedule until the rules for your weigh-in say otherwise. Pick a class near walking weight. After weigh-ins, drink, take in some salt and familiar carbs, and get help if you feel faint. A coach or clinician should run any fight-week plan.",
  );
}

function nutritionAnswer(message: string) {
  if (/\bsauna\b/i.test(message) && /\brecover/i.test(message)) {
    return "A short sauna can be fine for recovery if you feel well and you replace the fluid. Get out if you feel dizzy. It is not a way to make weight. I will not write a sweat-off protocol.";
  }
  if (/\bwater cuts?\b/i.test(message) && /\b(why|dangerous|risk)/i.test(message)) {
    return "Water cuts drop blood volume. Heart rate climbs, you overheat faster, and skill and thinking get worse. That is why they are dangerous. I will not explain how to do one. Lose weight gradually from food instead, about 1% of body weight per week or slower.";
  }
  return listBlock(
    "Do this",
    [
      "A familiar meal with protein and carbs about 2–3 hours before training, if it digests.",
      "Protein again after. A useful range is about 0.7 to 1.0 grams per pound of walking-around weight, spread across the day.",
      "Hydrate with meals and around training. Pale yellow is a rough check. That is not a weigh-in trick.",
    ],
    "Is this a normal training day, or are you making weight?",
    "Eat a real meal around training, with protein and carbs you digest. I will not build a calorie plan from a stored weight.",
  );
}

function opponentAnswer(input: ComposeInput) {
  const bank = matchOfflineBank(input.message, "fight_iq");
  const direct = bank ?? domainOfflineFallback("fight_iq");
  return listBlock(
    "Do this",
    [
      "Watch one habit only: stance, level change, or the first move after the jab.",
      "Write one primary path and one backup that are legal under your rule set.",
      "Drill it as a constrained round with a coach watching.",
    ],
    /\bwinner of|unknown|cfc|main event/i.test(input.message)
      ? "Who do you think wins that main event, a wrestler or a striker?"
      : "What is the one habit you can already see on film?",
    direct,
  );
}

function strengthAnswer(input: ComposeInput) {
  const bank = matchOfflineBank(input.message, "programming");
  const lifts = dayList(input.facts?.liftDays, "your lift days");
  return listBlock(
    "Do this",
    [
      `On ${lifts}, do the sets already written. Main lifts stop at 4 sets. Accessories stop at 3.`,
      "Loads in lbs. 2 RIR means about two clean reps left. If the log is empty, do not invent a number.",
      "Do not max a lift on a hard sparring day. The priority session comes first.",
      limitationLine(input.facts) || "Too hard or sore: keep the sets and drop the load.",
    ],
    "Which lift is on today, and what did you log last time?",
    bank ?? domainOfflineFallback("programming"),
  );
}

function conditioningAnswer(input: ComposeInput) {
  const bank = matchOfflineBank(input.message, "programming");
  return listBlock(
    "Do this",
    [
      "Work in rounds you can repeat. The last round should look like the first.",
      "Keep a hard piece inside the round, then recover. Do not add a random finisher.",
      "Put conditioning on a day that is not hard sparring, unless a coach set it that way.",
    ],
    "Are your fight rounds 3 minutes or 5?",
    bank ?? "Keep the work honest and count rounds. The last round should look like the first. Don't sprint the rest, and don't add extra work after a miss.",
  );
}

function scheduleAnswer(input: ComposeInput) {
  const lifts = dayList(input.facts?.liftDays, "your lift days");
  const bags = dayList(input.facts?.bagDays, "your bag days");
  const spar = dayList(input.facts?.sparringDays, "your sparring day");
  const bagSentence = input.facts?.bagDays?.length
    ? `Bag work on ${bags}.`
    : "Bag work is separate from the strength week.";
  const bank = matchOfflineBank(input.message, "programming");
  return listBlock(
    "Do this",
    [
      `Lift on ${lifts}. ${bagSentence}`,
      `Keep sparring on ${spar}. Do not add a max lift that day.`,
      "The day before sparring or class stays lighter.",
      "Missed a day: take the next session that is already written. No punishment volume.",
    ],
    "Which day is sparring, and which days are you actually free?",
    bank ??
      "Use the week already on your plan. Lift days stay lift days. Bag work is not a strength day. A missed day is not a makeup day.",
  );
}

function recoveryAnswer(input: ComposeInput) {
  const limit = limitationLine(input.facts);
  return listBlock(
    "Do this",
    [
      "Walk, drink water, and sleep. Keep the next session a little smaller if you need it.",
      "Soreness can train. Pain that changes the movement does not.",
      limit || "Do not spar through a headache or a head hit.",
    ],
    "Is this normal soreness, or does the pain change how you move?",
    "Soreness after honest work is normal. Walk, drink water, and keep the next session a little smaller if you need it. Sleep is part of the training. If pain changes how you move, stop and see a coach or a doctor.",
  );
}

function injuryStay() {
  return domainOfflineFallback("injury");
}

export function composeOfflineAnswer(input: ComposeInput) {
  const now = input.now ?? new Date();
  if (input.intent === "fight_camp") return fightCampAnswer(input, now);
  if (input.intent === "opponent_prep") return opponentAnswer(input);
  if (input.intent === "technique") return techniqueAnswer(input);
  if (input.intent === "weight_cut") return weightCutAnswer();
  if (input.intent === "nutrition") return nutritionAnswer(input.message);
  if (input.intent === "mindset") return mindsetAnswer();
  if (input.intent === "injury") return injuryStay();
  if (input.intent === "recovery") return recoveryAnswer(input);
  if (input.intent === "schedule") return scheduleAnswer(input);
  if (input.intent === "conditioning") return conditioningAnswer(input);
  if (input.intent === "strength") return strengthAnswer(input);
  if (input.intent === "rules") return domainOfflineFallback("rules");
  if (input.topic === "martial_art") return techniqueAnswer(input);
  if (input.topic === "mental") return mindsetAnswer();
  if (input.topic === "nutrition") return nutritionAnswer(input.message);
  if (input.topic === "conditioning") return strengthAnswer(input);
  return techniqueAnswer(input);
}
