/**
 * Member-visible fallback when no live model is available.
 * Sounds like a floor coach. Never mention files, keys, demo mode, or topics.
 */

type Tone = "tough" | "encouraging" | "balanced" | string;

function levelCue(experienceLevel: string) {
  if (experienceLevel === "advanced") {
    return "You have a base. Stay honest — no junk volume.";
  }
  if (experienceLevel === "beginner") {
    return "Keep loads you can control. Last two reps honest, not ugly.";
  }
  return "Match the work to how you actually recover this week.";
}

function withTone(tone: Tone, body: string) {
  if (tone === "tough") {
    return `Standard stays high. ${body}`;
  }
  if (tone === "encouraging") {
    return `Good — you asked. ${body}`;
  }
  return body;
}

function parseScopedNote(message: string) {
  const exercise = /Exercise:\s*(.+?)\.\s*Log mode:/i.exec(message)?.[1]?.trim();
  const planned = /Planned work:\s*(.+?)\.\s*Member note/i.exec(message)?.[1]?.trim();
  const question = /Member note or question:\s*(.+?)(?:\s+Give one or two practical cues\.|$)/i
    .exec(message)?.[1]
    ?.trim();
  return { exercise, planned, question };
}

function cueForExercise(name: string, planned = "") {
  const text = name.toLowerCase();
  const plan = planned ? ` Your plan: ${planned}.` : "";

  if (/plank|hollow|dead bug/.test(text)) {
    return `${name}: ribs down, glutes on, breathe behind the brace. Hold only while the shape stays clean — if you’re new, 20–30 seconds is enough. Stop before the low back takes over.${plan}`;
  }
  if (/goblet squat|squat(?! jump)/.test(text)) {
    return `${name}: elbows in, heels own the floor, stand tall at the top. A load you can control. Sit between the hips — don’t bounce.${plan}`;
  }
  if (/deadlift|rdl|romanian/.test(text)) {
    return `${name}: hinge, don’t squat it. Soft knees, bar close, squeeze the glutes at the top. If the low back takes it, go lighter.${plan}`;
  }
  if (/lunge/.test(text)) {
    return `${name}: long enough stride that the back knee drops under the hip. Front heel stays down. Same height both sides.${plan}`;
  }
  if (/jump|step-up|step up/.test(text)) {
    return `${name}: land quiet, own the knee. If the jump gets sloppy, switch to a step-up and keep it crisp.${plan}`;
  }
  if (/farmer|carry/.test(text)) {
    return `${name}: tall torso, packed shoulders, even steps. Walk the clock — don’t rush. Set the bells down with the same control you picked them up with.${plan}`;
  }
  if (/bike|assault|air bike/.test(text)) {
    return `${name}: sit tall, push and pull the pedals. Count rounds. First and last round should look the same. Don’t sprint the rest.${plan}`;
  }
  if (/bag|pads|shadow/.test(text)) {
    return `${name}: hands up, chin in, snap the shots back to guard. Work in rounds. Have a coach watch one if you can.${plan}`;
  }
  if (/jab|cross|hook|1–2|1-2/.test(text)) {
    return `${name}: sit on the stance, short punch, snap back to guard. Don’t reach. Then get live eyes on the floor.${plan}`;
  }
  if (/teep|kick|knee|clinch/.test(text)) {
    return `${name}: posture first, then the weapon. Chamber, hit, recover. Don’t throw yourself off the standing leg.${plan}`;
  }
  if (/guard|shrimp|mount|pass/.test(text)) {
    return `${name}: frames first, hips next. One clean movement, then reset. Don’t muscle a bad position.${plan}`;
  }
  if (/hold|isometric/.test(text)) {
    return `${name}: own the position, then own the breath. End the hold when the shape breaks — not when the ego wants more.${plan}`;
  }
  return `${name}: one clean cue, then do the set. Control the load, finish the last rep like the first.${plan}`;
}

function topicAnswer(input: {
  text: string;
  topic?: string;
  art?: string;
  experienceLevel: string;
}) {
  const { text, topic, art, experienceLevel } = input;
  const level = levelCue(experienceLevel);

  if (/missed|skip(ped)?|fell off|inconsistent|yesterday/.test(text)) {
    return `${level} A miss is not a verdict. Pick the next session you can actually finish and do that one. Do not stack a punishment workout.`;
  }
  if (/food|eat|meal|protein|calorie|hungry|nutrition/.test(text)) {
    return `Eat a real meal around training — protein and something you digest. Log a rough plate if you want the habit. I will not write a cut or a medical diet. If you have allergies, you still check the label.`;
  }
  if (/sore|recover|sleep|rest day|tired|wrecked/.test(text)) {
    return `If you’re cooked, walk, drink water, and keep the next session smaller. Sleep is the work you can’t skip. Pain that changes how you move is a different story — stop and get it checked.`;
  }
  if (/discourag|fail|setback|plateau|nerves|mindset|behind|anxious/.test(text)) {
    return `Nerves and setbacks happen. Shrink the next session so you can finish it. I will not pile shame on you. Show up, do the work, leave.`;
  }
  if (/how heavy|what weight|how much should/.test(text)) {
    return `${level} Last two reps should feel honest, not shaky. If you cannot name the weight, start lighter and add next time.`;
  }

  if (topic === "martial_art") {
    if (art === "boxing" || /jab|cross|hook|guard|stance/.test(text)) {
      return `${level} Hands up, sit on your stance, short straight shot, snap back to guard. Then have a coach watch one round. Live eyes beat this chat.`;
    }
    if (art === "muay-thai" || /teep|kick|clinch|knee/.test(text)) {
      return `${level} Posture first. Chamber the kick or teep, hit, recover on the standing leg. Don’t throw yourself into the shot.`;
    }
    if (art === "wrestling" || /takedown|shot|sprawl/.test(text)) {
      return `${level} Level change, stay in your stance, finish on your feet. Don’t dive on a bad shot. Get a coach to watch one live go.`;
    }
    if (art === "jiu-jitsu" || /guard|shrimp|mount/.test(text)) {
      return `${level} Frames, hips, then the pass or escape. One clean move. Don’t muscle a bad position.`;
    }
    if (/technique|how do i|stance/.test(text)) {
      return `${level} One simple cue, then live eyes on the floor. I will not invent a full curriculum in chat.`;
    }
    return `${level} Stay sharp on the basics for this art. One cue you can repeat under fatigue. Ask a coach on the floor to watch it.`;
  }

  if (topic === "conditioning") {
    if (/bike|interval|engine/.test(text)) {
      return `${level} Count rounds. Keep the last round as clean as the first. Don’t sprint the rest, and don’t add extra work after a miss.`;
    }
    return `${level} Strength and conditioning stay simple: control the load, finish the set, walk out honest. Extra midnight grinding doesn’t make you tougher.`;
  }

  if (topic === "mental") {
    return `${level} Discipline is showing up for the next session you can finish. Don’t write a story overnight. Do the work, then go home.`;
  }

  if (/technique|jab|takedown|guard|stance|how do i/.test(text)) {
    return `${level} One simple cue, then live eyes on the floor. I will not invent a full curriculum in chat.`;
  }

  return `${level} Stay practical. If you need eyes on the movement, ask a coach on the floor. I will not guess gym-specific policy.`;
}

export function offlineReply(
  message: string,
  experienceLevel: string,
  coachingTone = "",
  topic?: string,
  art?: string,
) {
  const scoped = parseScopedNote(message);
  const question = (scoped.question || message).toLowerCase();

  if (scoped.exercise) {
    const body = cueForExercise(scoped.exercise, scoped.planned);
    const extra = /how long|hold|new|beginner/.test(question)
      ? " If you’re new, shorter clean holds beat a long ugly one."
      : "";
    return withTone(coachingTone, `${body}${extra}`.trim());
  }

  return withTone(
    coachingTone,
    topicAnswer({
      text: question,
      topic,
      art,
      experienceLevel,
    }),
  );
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
