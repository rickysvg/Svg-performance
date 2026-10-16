/**
 * Member-visible fallback when no live model is available.
 * One intent, 2–4 complete sentences, or a short technique answer from the bank.
 * No files, keys, demo mode, or topic labels.
 */

import { composeOfflineAnswer } from "@/lib/coach/offline-compose";
import type { OfflineMemberFacts } from "@/lib/coach/member-facts";
import { domainOfflineFallback, matchOfflineBank } from "@/lib/coach/offline-bank";
import { classifyQuestion, intentFor } from "@/lib/coach/router";

export type OfflineReplyOptions = {
  coachName?: string;
  coachingStyle?: string;
  facts?: OfflineMemberFacts | null;
  now?: Date;
};

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

function injuryReply() {
  return domainOfflineFallback("injury");
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

function offlineAnswer(
  question: string,
  topic?: string,
  art?: string,
  options?: OfflineReplyOptions,
) {
  const route = classifyQuestion(question, { topic, art });
  const intent = intentFor(question, route);
  if (route.primary === "injury") return injuryReply();
  if (route.primary === "rules") return rulesReply(question);
  if (isMissed(question)) return missedReply(question);
  if (route.primary === "technique") {
    return (
      matchOfflineBank(question) ??
      composeOfflineAnswer({ message: question, intent, topic, art, ...options })
    );
  }
  if (route.primary === "general" && !topic) return genericReply();
  return composeOfflineAnswer({ message: question, intent, topic, art, ...options });
}

export function offlineReply(
  message: string,
  _experienceLevel: string,
  _coachingTone?: string,
  topic?: string,
  art?: string,
  options?: OfflineReplyOptions,
) {
  const scoped = parseScopedNote(message);
  const question = scoped.question || message;
  if (scoped.exercise) {
    return cueForExercise(scoped.exercise);
  }
  return offlineAnswer(question, topic, art, options);
}

export function liveModelUnavailableReply(
  message: string,
  experienceLevel: string,
  coachingTone = "",
  topic?: string,
  art?: string,
  options?: OfflineReplyOptions,
) {
  return offlineReply(message, experienceLevel, coachingTone, topic, art, options);
}

export const EMPTY_COACH_FALLBACK =
  "I don’t have a clean answer for that. Ask a coach on the floor.";
