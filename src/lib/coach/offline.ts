/**
 * Member-visible fallback when no live model is available.
 * One intent, 2–4 complete sentences, or a short technique answer from the bank.
 * No files, keys, demo mode, or topic labels.
 */

import { domainOfflineFallback, matchOfflineBank } from "@/lib/coach/offline-bank";
import { classifyQuestion } from "@/lib/coach/router";

function parseScopedNote(message: string) {
  const exercise = /Exercise:\s*(.+?)\.\s*Log mode:/i.exec(message)?.[1]?.trim();
  const question = /Member note or question:\s*(.+?)(?:\s+Give one or two practical cues\.|$)/i
    .exec(message)?.[1]
    ?.trim();
  return { exercise, question };
}

function missedCount(text: string) {
  const digits = /\b(\d+)\s+(classes|class|sessions|session)/i.exec(text);
  if (digits) return digits[1];
  if (/\btwo\s+(classes|class|sessions|session)/i.test(text)) return "two";
  if (/\bthree\s+(classes|class|sessions|session)/i.test(text)) return "three";
  return "";
}

function missedReply(text: string) {
  const count = missedCount(text);
  const open = count
    ? `${count.charAt(0).toUpperCase()}${count.slice(1)} missed classes doesn't erase your work.`
    : "A missed class doesn't erase your work.";
  return `${open} Don't try to make it up with a punishment session. Get to your next scheduled class, then hit the rest of the week as planned. Consistency beats catching up.`;
}

function sorenessReply() {
  return "Soreness after honest work is normal. Walk, drink water, and keep the next session a little smaller if you need it. Sleep is part of the training. If pain changes how you move, stop and see a coach or a doctor.";
}

function foodReply(question: string) {
  if (/\bsauna\b/i.test(question) && /\brecover/i.test(question)) {
    return "A short sauna can be fine for recovery if you feel well and you replace the fluid. Get out if you feel dizzy. It is not a way to make weight. I will not write a sweat-off protocol.";
  }
  if (/\bwater cuts?\b/i.test(question) && /\b(why|dangerous|risk)/i.test(question)) {
    return "Water cuts drop blood volume. Heart rate climbs, you overheat faster, and skill and thinking get worse. That is why they are dangerous. I will not explain how to do one. Lose weight gradually from food instead, about 1% of body weight per week or slower.";
  }
  return domainOfflineFallback("nutrition");
}

function weightCutReply() {
  return "Start a weight cut weeks out and lose about 1% of body weight per week or slower through meals, not in the last day. Keep protein in each meal, eat carbs around training, and hydrate on a normal schedule until the rules for your weigh-in say otherwise. Pick a class near walking weight. Red lines: no sauna suit, sweat suit, diuretic, laxative, or water-cut protocol. After weigh-ins, drink, take in some salt and familiar carbs, and get help if you feel faint. A coach or clinician should run any fight-week plan.";
}

function nervesReply() {
  return domainOfflineFallback("mindset");
}

function formReply(art?: string) {
  if (art === "boxing") {
    return "Hands up. Sit on your stance. Throw a short straight jab and snap it back to guard. Then have a coach watch one round — live eyes beat this chat.";
  }
  if (art === "muay-thai") {
    return "Posture first, then the weapon. Chamber the kick or teep, hit, and recover on the standing leg. Don't throw yourself into the shot.";
  }
  if (art === "wrestling") {
    return "Level change, stay in your stance, and finish on your feet. Don't dive on a bad shot. Get a coach to watch one live go.";
  }
  if (art === "jiu-jitsu") {
    return "Frames first, then the hips. Make one clean move and reset. Don't muscle a bad position. An armbar needs the angle, the knees tight, and the hips in. Tap early.";
  }
  if (art === "kickboxing") {
    return "Stay in a kickboxing stance, turn the hip, and meet the target with the shin. Bring the leg home. Most kickboxing rules ban elbows and keep the clinch short. Have a coach watch one round.";
  }
  if (art === "judo") {
    return "Break balance first, then commit the hips into the throw. For osoto, reap the leg you have already moved them onto. Do not just kick. Under IJF rules, do not grab the leg with your hand in standing. Practice the fall.";
  }
  if (art === "karate") {
    return "Keep the front knee stacked, turn the back hip, and send a short reverse punch. Recover the stance and the hand. WKF face contact depends on the category, so keep the touch controlled until a coach says otherwise.";
  }
  if (art === "taekwondo") {
    return "Chamber the kick, turn the hip, and put the foot back down on a live base. Head kicks score in World Taekwondo. Punches to the head do not. Retract before you admire the kick.";
  }
  if (art === "sambo") {
    return "Grip the jacket, get the hips in, and finish the throw. Do not stall on the cloth. Sport sambo has no chokes and no strikes. Combat sambo is a different rule set. Practice the fall.";
  }
  if (art === "catch-wrestling") {
    return "From the front headlock, keep the head and arm tight, step to the side, and turn them to a pin. Control the body. Do not crank the neck. A tap ends the rep.";
  }
  if (art === "mma" || art === "cagework") {
    return "Start from the position on the cage: frame in, elbow tight, then one step off the fence. Win an underhook, turn the head, and angle out. Drill the position with a partner before you add speed. A coach can watch the rep. Don't grab the fence.";
  }
  return "Start with the position, then one clean step, then a partner drill. Keep the frame or the hands where they belong. Get a coach to watch the rep before you add speed.";
}

function conditioningReply() {
  return "Keep the work honest and count rounds. The last round should look like the first. Don't sprint the rest, and don't add extra work after a miss.";
}

function programmingReply(text: string) {
  return matchOfflineBank(text, "programming") ?? domainOfflineFallback("programming");
}

function injuryReply() {
  return domainOfflineFallback("injury");
}

function fightIqReply() {
  return domainOfflineFallback("fight_iq");
}

function rulesReply(text: string) {
  const lower = text.toLowerCase();
  const parts = ["Legality depends on the rule set."];
  if (/elbow/.test(lower)) {
    parts.push(
      "Under most pro Unified Rules, elbow strikes are legal except to the spine or the back of the head. A 12-6 elbow stopped being an ABC foul in 2024, but not every commission has adopted that. Most amateur rule sets ban elbow and forearm strikes completely.",
    );
  }
  if (/fence|cage/.test(lower)) {
    parts.push(
      "Grabbing the fence with fingers or toes is a foul. A hand on the fence to frame or stand is not the same thing as a grab.",
    );
  }
  if (!/elbow|fence|cage/.test(lower)) {
    return domainOfflineFallback("rules");
  }
  parts.push("Rules vary by commission and promotion, so check your commission/promotion.");
  return parts.join(" ");
}

function genericReply() {
  return "Stay practical and do the next session you already have planned. If you need eyes on a movement, ask a coach on the floor. I will not guess gym-specific policy from here.";
}

function isMissed(text: string) {
  return /\b(?:missed|skip(?:ped)?|fell off|inconsistent)\b/i.test(text);
}

function isSoreness(text: string) {
  return /\bsore(?:ness)?\b|\brecover|\bsleep\b|\brest day\b|\btired\b|\bwrecked\b|\bachy\b/i.test(text);
}

function isConditioningWork(text: string) {
  return /\bbike\b|\binterval|\bengine\b|\bconditioning\b|\brounds\b|\bbag work\b/i.test(text);
}

function isWeightCutQuestion(text: string) {
  return /\bweight cuts?\b|\bcut weight\b|\bweigh-?ins?\b|\bmake weight\b|\bfight week\b/i.test(text);
}

function cueForExercise(name: string) {
  const text = name.toLowerCase();

  if (/plank|hollow|dead bug/.test(text)) {
    return `For ${name}, keep the ribs down, glutes on, and breathe behind the brace. Hold only while the shape stays clean — 20–30 seconds is enough if you're new. Stop before the low back takes over.`;
  }
  if (/goblet squat|squat(?! jump)/.test(text)) {
    return `For ${name}, keep the elbows in and the heels on the floor, then stand tall at the top. Use a load you can control. Sit between the hips — don't bounce.`;
  }
  if (/deadlift|rdl|romanian/.test(text)) {
    return `For ${name}, hinge; don't squat it. Soft knees, bar close, squeeze the glutes at the top. If the low back takes it, go lighter.`;
  }
  if (/lunge/.test(text)) {
    return `For ${name}, take a stride long enough that the back knee drops under the hip. Keep the front heel down. Match the height on both sides.`;
  }
  if (/jump|step-up|step up/.test(text)) {
    return `For ${name}, land quiet and own the knee. If the jump gets sloppy, switch to a step-up and keep it crisp.`;
  }
  if (/farmer|carry/.test(text)) {
    return `For ${name}, stay tall, pack the shoulders, and take even steps. Walk the clock — don't rush. Set the bells down with the same control you picked them up with.`;
  }
  if (/bike|assault|air bike/.test(text)) {
    return `For ${name}, sit tall and push and pull the pedals. Count rounds. The first and last round should look the same.`;
  }
  if (/bag|pads|shadow/.test(text)) {
    return `For ${name}, hands up, chin in, snap the shots back to guard. Work in rounds. Have a coach watch one if you can.`;
  }
  if (/jab|cross|hook|1–2|1-2/.test(text)) {
    return `For ${name}, sit on the stance, throw a short punch, and snap back to guard. Don't reach. Then get live eyes on the floor.`;
  }
  if (/teep|kick|knee|clinch/.test(text)) {
    return `For ${name}, posture first, then the weapon. Chamber, hit, recover. Don't throw yourself off the standing leg.`;
  }
  if (/guard|shrimp|mount|pass/.test(text)) {
    return `For ${name}, frames first, then the hips. One clean movement, then reset. Don't muscle a bad position.`;
  }
  if (/hold|isometric/.test(text)) {
    return `For ${name}, own the position, then own the breath. End the hold when the shape breaks — not when the ego wants more.`;
  }
  return `For ${name}, pick one clean cue and do the set. Control the load and finish the last rep like the first.`;
}

function offlineAnswer(question: string, topic?: string, art?: string) {
  const route = classifyQuestion(question, { topic, art });
  if (route.primary === "injury") return injuryReply();
  if (route.primary === "technique") {
    return matchOfflineBank(question) ?? formReply(art);
  }
  if (route.primary === "rules") return rulesReply(question);
  if (route.primary === "nutrition") {
    return isWeightCutQuestion(question) ? weightCutReply() : foodReply(question);
  }
  if (route.primary === "mindset") {
    return isMissed(question) ? missedReply(question) : nervesReply();
  }
  if (route.primary === "fight_iq") return fightIqReply();
  if (route.primary === "programming") {
    if (isSoreness(question)) return sorenessReply();
    if (isMissed(question)) return missedReply(question);
    if (isConditioningWork(question)) return conditioningReply();
    return programmingReply(question);
  }
  if (route.primary === "general" && !topic) return genericReply();
  if (topic === "martial_art") return formReply(art);
  if (topic === "mental") return isMissed(question) ? missedReply(question) : nervesReply();
  if (topic === "conditioning") return programmingReply(question);
  if (topic === "nutrition") return foodReply(question);
  return formReply(art);
}

export function offlineReply(
  message: string,
  _experienceLevel: string,
  _coachingTone?: string,
  topic?: string,
  art?: string,
) {
  const scoped = parseScopedNote(message);
  const question = scoped.question || message;
  if (scoped.exercise) {
    return cueForExercise(scoped.exercise);
  }
  return offlineAnswer(question, topic, art);
}

export function liveModelUnavailableReply(
  message: string,
  experienceLevel: string,
  coachingTone = "",
  topic?: string,
  art?: string,
) {
  return offlineReply(message, experienceLevel, coachingTone, topic, art);
}

export const EMPTY_COACH_FALLBACK =
  "I don’t have a clean answer for that. Ask a coach on the floor.";
