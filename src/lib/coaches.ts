import { isImmersiveTrainingPath } from "@/lib/member-nav";

export const AI_COACHES = [
  {
    id: "skye",
    name: "Skye",
    vibe: "Bright and direct. She keeps the pace honest.",
    image: "/coaches/skye.webp",
    /** Small circle crop. Same file as the thumb for the original four. */
    circle: "/coaches/skye-thumb.webp",
    thumb: "/coaches/skye-thumb.webp",
    /** OpenAI TTS voice. Bright woman. */
    voice: "nova",
  },
  {
    id: "maya",
    name: "Maya",
    vibe: "Warm and precise. She names the detail that fixes the round.",
    image: "/coaches/maya.webp",
    circle: "/coaches/maya-thumb.webp",
    thumb: "/coaches/maya-thumb.webp",
    /** OpenAI TTS voice. Warm woman. */
    voice: "shimmer",
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
    /** OpenAI TTS voice. Easy male, distinct from Mateo and Ricky. */
    voice: "fable",
  },
  {
    id: "ricky",
    name: "Ricky",
    vibe: "SVG MMA Academy head coach",
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
  skye: "Persona: Skye is bright and direct. She keeps the pace honest, says the standard out loud, and moves to the next rep without a speech.",
  maya: "Persona: Maya is warm and precise. She finds the one detail that fixes the round and stays on it until it is clean.",
  mateo: "Persona: Mateo is quiet intensity. Short cues, a high standard, and no filler.",
  cole: "Persona: Cole is easy confidence. He pushes the round, stays with you, and keeps the energy specific.",
  ricky:
    "Persona: Ricky is the SVG MMA Academy head coach and a fighter. Direct, hard-nosed, and motivating. Fight-culture voice: short sentences, the standard, and the next action. No fluff and no shame.",
};

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

export function resolveAiCoachByName(name?: string | null): AiCoach {
  const trimmed = name?.trim().toLowerCase();
  if (!trimmed) return resolveAiCoach();
  return (
    AI_COACHES.find((coach) => coach.id === trimmed || coach.name.toLowerCase() === trimmed) ??
    resolveAiCoach()
  );
}

export function resolveCoachingStyle(value?: string | null): CoachingStyle {
  return (
    COACHING_STYLES.find((style) => style.value === value) ??
    COACHING_STYLES.find((style) => style.value === DEFAULT_COACHING_STYLE)!
  );
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
    "The persona and the style stack. Persona is who is talking. Style is the tone. This style changes tone only. Keep every required answer-style section, the safety rules, and any refusal. Do not drop or rename those sections to match the style or the persona.",
  ].join(" ");
}

/**
 * Floating coach on signed-in screens. It stays off the coach screen itself
 * (that page is where the button goes) and the splash CSS hides it during intro.
 * The button sits above the bottom dock. Logger screens raise it.
 */
export function shouldShowCoachFab(pathname: string) {
  const path = pathname.split("?")[0] || "/";
  return !path.startsWith("/coach");
}

/** Day and logger screens have a bottom Start or Save bar and no account dock. */
export function coachFabClearsBottomBar(pathname: string) {
  return isImmersiveTrainingPath(pathname);
}
