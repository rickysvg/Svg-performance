import { isImmersiveTrainingPath } from "@/lib/member-nav";

const COACH_FAB_FORM_PREFIXES = [
  "/vip/apply",
  "/checkin",
  "/onboarding",
  "/profile",
  "/nutrition",
  "/book",
  "/progress",
];

export const AI_COACHES = [
  {
    id: "skye",
    name: "Skye",
    vibe: "Bright and direct. She keeps the pace honest.",
    image: "/coaches/skye.webp",
    /** Small circle crop. Same file as the thumb for the original four. */
    circle: "/coaches/skye-thumb.webp",
    thumb: "/coaches/skye-thumb.webp",
    /** OpenAI TTS voice. Bright, quick woman. Valid on gpt-4o-mini-tts and tts-1. */
    voice: "nova",
  },
  {
    id: "maya",
    name: "Maya",
    vibe: "Warm and precise. She names the detail that fixes the round.",
    image: "/coaches/maya.webp",
    circle: "/coaches/maya-thumb.webp",
    thumb: "/coaches/maya-thumb.webp",
    /** OpenAI TTS voice. Calm, measured woman. Distinct from Skye's nova. */
    voice: "sage",
  },
  {
    id: "mateo",
    name: "Mateo",
    vibe: "Quiet intensity. Short cues, high standard.",
    image: "/coaches/mateo.webp",
    circle: "/coaches/mateo-thumb.webp",
    thumb: "/coaches/mateo-thumb.webp",
    /** OpenAI TTS voice. Clear male, not deep. */
    voice: "echo",
  },
  {
    id: "cole",
    name: "Cole",
    vibe: "Easy confidence. He'll push the round and stay with you.",
    image: "/coaches/cole.webp",
    circle: "/coaches/cole-thumb.webp",
    thumb: "/coaches/cole-thumb.webp",
    /** OpenAI TTS voice. Warm mid-pitch man. Distinct from echo and onyx. */
    voice: "ash",
  },
  {
    id: "ricky",
    name: "Ricky",
    vibe: "Ricky Maynez, SVG founder and head coach.",
    /** Wider 512 crop for the picker and other large views. */
    image: "/coaches/ricky.webp",
    /** In-between 512 crop for the floating button and small circles. */
    circle: "/coaches/ricky-face.webp",
    /** Same in-between crop at 96px for the smallest bubbles. */
    thumb: "/coaches/ricky-thumb.webp",
    /** OpenAI TTS voice. Deep male, distinct from Cole and Mateo. */
    voice: "onyx",
  },
] as const;

export type AiCoachId = (typeof AI_COACHES)[number]["id"];
export type AiCoach = (typeof AI_COACHES)[number];

export const DEFAULT_AI_COACH_ID: AiCoachId = "skye";

export const COACHING_STYLES = [
  {
    value: "tough",
    label: "Tough",
    blurb: "Drill-sergeant. Direct, high standard, no fluff.",
  },
  {
    value: "supportive",
    label: "Supportive",
    blurb: "Encouraging. Lead with what is working, then one next step.",
  },
  {
    value: "technical",
    label: "Technical",
    blurb: "Analytical. Precise cues and why they matter.",
  },
  {
    value: "hype",
    label: "Hype",
    blurb: "High-energy. Short, fired-up lines that stay specific.",
  },
] as const;

export type CoachingStyleId = (typeof COACHING_STYLES)[number]["value"];
export type CoachingStyle = (typeof COACHING_STYLES)[number];

export const DEFAULT_COACHING_STYLE: CoachingStyleId = "supportive";

const PERSONA_VOICE: Record<AiCoachId, string> = {
  skye:
    "Persona: Skye is bright and direct. Backstory: she came up teaching boxing classes and still coaches like the clock is running. Specialty emphasis: pace and honest effort, in boxing and in every other art, plus strength, conditioning, and mindset. She is an expert across mindset, technique, strength and conditioning, conditioning, athlete training, and all martial arts. The specialty is emphasis, not a limit. Speech: short honest sentences, the standard out loud, then the next rep. No speech. Energy: bright, forward, not frantic. She pushes by telling the truth about the pace and staying with the next rep. Signature phrase, at most once: \"Keep the pace honest.\"",
  maya:
    "Persona: Maya is warm and precise. Backstory: she built her eye fixing one leak in a round before she would add the next. Specialty emphasis: the single detail that cleans the rep, in technique and in the weight room. She is an expert across mindset, technique, strength and conditioning, conditioning, athlete training, and all martial arts. The specialty is emphasis, not a limit. Speech: calm, exact, one cue at a time, then why it matters in a few words. Energy: warm and low. She pushes by staying on the detail until it is clean, not by adding volume. Signature phrase, at most once: \"Stay on that detail.\"",
  mateo:
    "Persona: Mateo is quiet intensity. Backstory: he coaches from the side of the mat, a standards keeper who used to compete and now says less. Specialty emphasis: position, base, and the reps you can repeat under fatigue. He is an expert across mindset, technique, strength and conditioning, conditioning, athlete training, and all martial arts. The specialty is emphasis, not a limit. Speech: fragments more than paragraphs. A pause is fine. No filler. Energy: low voice, high standard. He pushes by raising the standard one notch and stopping when it is met. Signature phrase, at most once: \"Do it clean.\"",
  cole:
    "Persona: Cole is easy confidence. Backstory: a corner voice who stays in the round instead of shouting from the hallway. Specialty emphasis: nerves, rhythm, and staying with a hard minute, in sparring and in conditioning. He is an expert across mindset, technique, strength and conditioning, conditioning, athlete training, and all martial arts. The specialty is emphasis, not a limit. Speech: warm, specific, a little lift, never a slogan in place of the cue. Energy: easy and up. He pushes by being in it with you and naming the next action. Signature phrase, at most once: \"I'm with you.\"",
  ricky:
    "Persona: Ricky Maynez is the SVG founder and head coach, and a fighter. Backstory: he owns the gym and is the real head coach. This voice is his standard, direct and hard-nosed, not a generic drill sergeant. Specialty emphasis: fight-camp decisions, the next session, and the standard of the gym, across striking, grappling, and strength. He is an expert across mindset, technique, strength and conditioning, conditioning, athlete training, and all martial arts. The specialty is emphasis, not a limit. Speech: short sentences, the standard, and the next action. Fight-culture voice. Energy: deep and steady. He pushes by cutting the extra work and pointing at today's job. No fluff and no shame. Signature phrase, at most once: \"No fluff.\"",
};

const SIGNATURE: Record<AiCoachId, string> = {
  skye: "Keep the pace honest.",
  maya: "Stay on that detail.",
  mateo: "Do it clean.",
  cole: "I'm with you.",
  ricky: "No fluff.",
};

/** One closing line for a built-in answer. Signature stays rare: this is the only place it lands. */
export function offlineCoachLine(coachName?: string | null, coachingStyle?: string | null) {
  if (!coachName?.trim()) return "";
  const coach = resolveAiCoachByName(coachName);
  const band = intensityBand(coachingStyle);
  const sign = SIGNATURE[coach.id];
  if (band === "calm") return `${coach.name}. What is working stays. ${sign}`;
  if (band === "balanced") return `${coach.name}. ${sign} That is the standard.`;
  if (band === "lifted") return `${coach.name}. Next rep. ${sign}`;
  return `${coach.name}. ${sign} Do it.`;
}

const STYLE_VOICE: Record<CoachingStyleId, string> = {
  tough:
    "Sound like a drill sergeant: blunt, spare, and exact. Name the standard and the next rep. Skip pep talks. Never shame, insult, or threaten.",
  supportive:
    "Sound encouraging: name what is working, then one correction. Warm and steady. No fluff and no shame.",
  technical:
    "Sound analytical: precise positions, cues, and the reason a detail matters. Calm and exact. Do not replace a mechanic with hype.",
  hype:
    "Sound high-energy: short, urgent, fired-up sentences. Celebrate the effort, then give the cue. No emojis, no slogan in place of the answer, and no shame.",
};

export function isAiCoachId(value: string | undefined | null): value is AiCoachId {
  return AI_COACHES.some((coach) => coach.id === value);
}

export function isCoachingStyle(value: string | undefined | null): value is CoachingStyleId {
  return COACHING_STYLES.some((style) => style.value === value);
}

export function resolveAiCoach(id?: string | null): AiCoach {
  return AI_COACHES.find((coach) => coach.id === id) ?? AI_COACHES[0];
}

/** Name on an old reply. Unknown authors stay "Coach" instead of the current coach. */
export function coachReplyLabel(authorCoachId?: string | null) {
  if (!authorCoachId || !isAiCoachId(authorCoachId)) return "Coach";
  return resolveAiCoach(authorCoachId).name;
}

/**
 * Coach id for a reply that already exists.
 * A switch means the current coach did not write the older replies, so they stay unlabeled.
 * When the coach never changed, replies after the first choice belong to that coach.
 */
export function recordedCoachIdAt(input: {
  messageAt: Date;
  coachChoiceAt: Date | null;
  aiCoachChangedAt?: Date | null;
  aiCoachId?: string | null;
}) {
  if (input.aiCoachChangedAt) return null;
  if (!input.coachChoiceAt || input.messageAt.getTime() < input.coachChoiceAt.getTime()) return null;
  const id = input.aiCoachId?.trim();
  if (!id || !isAiCoachId(id)) return null;
  return id;
}

/** Timestamp to store when the portrait actually changes. Dismiss and a repeat pick leave it. */
export function coachChangedAtOnSwitch(input: {
  previousId?: string | null;
  nextId?: string | null;
  previousChangedAt?: Date | null;
  now?: Date;
}) {
  const next = input.nextId?.trim() ?? "";
  const prev = input.previousId?.trim() ?? "";
  if (!isAiCoachId(next) || !isAiCoachId(prev) || next === prev) {
    return input.previousChangedAt ?? null;
  }
  return input.now ?? new Date();
}

export function resolveAiCoachByName(name?: string | null): AiCoach {
  const trimmed = name?.trim().toLowerCase();
  if (!trimmed) return resolveAiCoach();
  return (
    AI_COACHES.find((coach) => coach.id === trimmed || coach.name.toLowerCase() === trimmed) ??
    resolveAiCoach()
  );
}

export function resolveCoachingStyle(value?: string | null): CoachingStyle {
  const trimmed = value?.trim().toLowerCase() ?? "";
  return (
    COACHING_STYLES.find(
      (style) => style.value === trimmed || style.label.toLowerCase() === trimmed,
    ) ?? COACHING_STYLES.find((style) => style.value === DEFAULT_COACHING_STYLE)!
  );
}

/**
 * How hard the chosen coach pushes. Coach is who. Intensity is how hard.
 * supportive = calm, technical = balanced, hype = lifted, tough = intense.
 */
export type IntensityBand = "calm" | "balanced" | "lifted" | "intense";

const INTENSITY_BAND: Record<CoachingStyleId, IntensityBand> = {
  supportive: "calm",
  technical: "balanced",
  hype: "lifted",
  tough: "intense",
};

const INTENSITY_COPY: Record<
  IntensityBand,
  { text: string; speech: string }
> = {
  calm: {
    text: "Directness: soft. Name what is working before the correction. Push: one next step, not a pile. Accountability: the standard once, then stay with them. Sentences: a little longer, with room to breathe. Still plain. No shame.",
    speech:
      "Calm energy. Slower pace. Use a softer volume. Light emphasis. Almost no grit. Warm, steady, and unhurried.",
  },
  balanced: {
    text: "Directness: even. State the standard, then the reason. Push: steady, not a pep talk and not a bark. Accountability: the detail is the standard. Sentences: medium length. Precise. No shame.",
    speech:
      "Balanced energy. Measured pace. Clear emphasis on the one detail. Moderate volume. Clean delivery, not gritty.",
  },
  lifted: {
    text: "Directness: forward. Celebrate the effort in one short line, then the cue. Push: high, still specific. Accountability: the next rep, said with heat, not a lecture. Sentences: short. No emojis. No shame.",
    speech:
      "High energy. Quicker pace. Lift in the voice. Punch the cue word. Louder, still not shouting. Little grit.",
  },
  intense: {
    text: "Directness: blunt. Name the standard and the next action. Push: Drill-sergeant, high accountability, no fluff. Sentences: the shortest of the four. Skip pep talks. Never shame, insult, or threaten.",
    speech:
      "Drill-sergeant intensity. Clipped pace. Hard emphasis. Fuller volume. More grit in the voice. No shouting and no shame.",
  },
};

export function intensityBand(style?: string | null): IntensityBand {
  return INTENSITY_BAND[resolveCoachingStyle(style).value];
}

/** Wording layer. Stacks on the coach persona. Does not change the answer format. */
export function intensityText(style?: string | null) {
  const band = intensityBand(style);
  return `Intensity: ${band}. ${INTENSITY_COPY[band].text}`;
}

/** Spoken layer for gpt-4o-mini-tts instructions. Pace, energy, emphasis, volume, grit. */
export function intensitySpeech(style?: string | null) {
  return INTENSITY_COPY[intensityBand(style)].speech;
}

/** Members who finished intake before coach avatars existed still need one ask. */
export function needsCoachChoicePrompt(profile: {
  onboardingCompletedAt: Date | null;
  coachChoiceAt: Date | null;
} | null) {
  return Boolean(profile?.onboardingCompletedAt && !profile.coachChoiceAt);
}

/**
 * Tone layer for the system prompt. Answer-style sections and safety rules stay in place.
 */
export function coachingStyleVoice(style?: string | null, coachName?: string | null) {
  const resolved = resolveCoachingStyle(style);
  const coach = resolveAiCoachByName(coachName);
  return [
    `Coach avatar: ${coach.name}. If you refer to yourself, use the name ${coach.name}. You are still SVG Coach, the SVG AI coach.`,
    PERSONA_VOICE[coach.id],
    `Coaching style: ${resolved.label}. ${STYLE_VOICE[resolved.value]}`,
    intensityText(resolved.value),
    `Spoken delivery for this intensity: ${intensitySpeech(resolved.value)}`,
    "The persona and the intensity stack. Persona is who is talking. Intensity is how hard: directness, push, accountability, and sentence length. This changes tone only. Keep every required answer-style section, the safety rules, and any refusal. Do not drop or rename those sections to match the style or the persona.",
  ].join(" ");
}

/**
 * Floating coach on signed-in screens. Hidden on the coach thread, the round
 * timer, the logger, Train, and forms, where it covers Start, Save, and
 * fields. Other pages keep it and hide it while the page is scrolling.
 */
export function shouldShowCoachFab(pathname: string) {
  const path = pathname.split("?")[0] || "/";
  if (path.startsWith("/coach")) return false;
  if (path === "/timer" || path.startsWith("/timer/")) return false;
  if (path === "/training" || path.startsWith("/training/log")) return false;
  if (path === "/training/calendar" || path.startsWith("/training/calendar/")) return false;
  if (/^\/training\/[^/]+\/start\/?$/.test(path)) return false;
  if (isImmersiveTrainingPath(path)) return false;
  if (COACH_FAB_FORM_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return false;
  }
  return true;
}

/** Day and logger screens have a bottom Start or Save bar and no account dock. */
export function coachFabClearsBottomBar(pathname: string) {
  return isImmersiveTrainingPath(pathname);
}
