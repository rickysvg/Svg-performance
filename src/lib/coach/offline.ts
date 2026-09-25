/**
 * Member-visible fallback when no live model is available.
 * One intent, 2–4 complete sentences. No files, keys, demo mode, or topic labels.
 */

function parseScopedNote(message: string) {
  const exercise = /Exercise:\s*(.+?)\.\s*Log mode:/i.exec(message)?.[1]?.trim();
  const planned = /Planned work:\s*(.+?)\.\s*Member note/i.exec(message)?.[1]?.trim();
  const question = /Member note or question:\s*(.+?)(?:\s+Give one or two practical cues\.|$)/i
    .exec(message)?.[1]
    ?.trim();
  return { exercise, planned, question };
}

function missedCount(text: string) {
  const digits = /\b(\d+)\s+(classes|class|sessions|session)/i.exec(text);
  if (digits) return digits[1];
  if (/\btwo\s+(classes|class|sessions|session)/i.test(text)) return "two";
  if (/\bthree\s+(classes|class|sessions|session)/i.test(text)) return "three";
  return "";
}

export function matchCoachIntent(text: string) {
  const body = text.toLowerCase();
  if (/missed|skip(ped)?|fell off|inconsistent/.test(body)) return "missed";
  if (/sore|soreness|recover|sleep|rest day|tired|wrecked|achy/.test(body)) return "soreness";
  if (/cut weight|weight cut|sauna|diuretic|food|eat|meal|protein|calorie|hungry|nutrition/.test(body)) {
    return "food";
  }
  if (/discourag|fail|setback|plateau|nerves|mindset|behind|anxious|scared/.test(body)) {
    return "nerves";
  }
  if (/technique|jab|takedown|guard|stance|how do i|form|cue/.test(body)) return "form";
  if (/bike|interval|engine|conditioning|rounds|bag work/.test(body)) return "conditioning";
  return "generic";
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

function foodReply() {
  return "Eat a real meal around training — protein and something you digest. Log a rough plate if you want the habit. I will not write a cut or a medical diet. If something hurts or you have allergies, you still check that yourself.";
}

function nervesReply() {
  return "Nerves mean you care. Don't write a story about it overnight. Show up, do the work you planned, and leave. I will not pile shame on you.";
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
    return "Frames first, then the hips. Make one clean move and reset. Don't muscle a bad position.";
  }
  return "Pick one simple cue and repeat it. Then get live eyes on the floor. I will not invent a full curriculum in chat.";
}

function conditioningReply() {
  return "Keep the work honest and count rounds. The last round should look like the first. Don't sprint the rest, and don't add extra work after a miss.";
}

function genericReply() {
  return "Stay practical and do the next session you already have planned. If you need eyes on a movement, ask a coach on the floor. I will not guess gym-specific policy from here.";
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

function answerForIntent(intent: ReturnType<typeof matchCoachIntent>, text: string, art?: string) {
  if (intent === "missed") return missedReply(text);
  if (intent === "soreness") return sorenessReply();
  if (intent === "food") return foodReply();
  if (intent === "nerves") return nervesReply();
  if (intent === "form") return formReply(art);
  if (intent === "conditioning") return conditioningReply();
  return genericReply();
}

export function offlineReply(
  message: string,
  _experienceLevel: string,
  _coachingTone = "",
  _topic?: string,
  art?: string,
) {
  const scoped = parseScopedNote(message);
  const question = scoped.question || message;
  if (scoped.exercise) {
    return cueForExercise(scoped.exercise);
  }
  return answerForIntent(matchCoachIntent(question), question, art);
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
