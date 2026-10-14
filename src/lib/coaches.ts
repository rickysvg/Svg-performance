import { isImmersiveTrainingPath } from "@/lib/member-nav";

export const AI_COACHES = [
  {
    id: "skye",
    name: "Skye",
    vibe: "Bright and direct. She keeps the pace honest.",
    image: "/coaches/skye.webp",
    thumb: "/coaches/skye-thumb.webp",
  },
  {
    id: "maya",
    name: "Maya",
    vibe: "Warm and precise. She names the detail that fixes the round.",
    image: "/coaches/maya.webp",
    thumb: "/coaches/maya-thumb.webp",
  },
  {
    id: "mateo",
    name: "Mateo",
    vibe: "Quiet intensity. Short cues, high standard.",
    image: "/coaches/mateo.webp",
    thumb: "/coaches/mateo-thumb.webp",
  },
  {
    id: "cole",
    name: "Cole",
    vibe: "Easy confidence. He'll push the round and stay with you.",
    image: "/coaches/cole.webp",
    thumb: "/coaches/cole-thumb.webp",
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
  const name = coachName?.trim() || resolveAiCoach().name;
  return [
    `Coach avatar: ${name}. If you refer to yourself, use the name ${name}. You are still SVG Coach, the SVG AI coach.`,
    `Coaching style: ${resolved.label}. ${STYLE_VOICE[resolved.value]}`,
    "This style changes tone only. Keep every required answer-style section, the safety rules, and any refusal. Do not drop or rename those sections to match the style.",
  ].join(" ");
}

/** Hide the floating coach button on the coach screen itself. Splash CSS hides it during the intro. */
export function shouldShowCoachFab(pathname: string) {
  return !pathname.startsWith("/coach");
}

/** Day and logger screens have a bottom Start or Save bar and no account dock. */
export function coachFabClearsBottomBar(pathname: string) {
  return isImmersiveTrainingPath(pathname);
}
