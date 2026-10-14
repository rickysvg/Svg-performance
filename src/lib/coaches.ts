import { isImmersiveTrainingPath } from "@/lib/member-nav";

export type Coach = {
  id: string;
  name: string;
  vibe: string;
  src: string;
  thumbSrc: string;
};

export const COACHES: readonly Coach[] = [
  {
    id: "lena",
    name: "Lena",
    vibe: "Clean cues. Calm when the round gets loud.",
    src: "/coaches/lena.webp",
    thumbSrc: "/coaches/lena-thumb.webp",
  },
  {
    id: "maren",
    name: "Maren",
    vibe: "Warm, then specific. Stays in your corner.",
    src: "/coaches/maren.webp",
    thumbSrc: "/coaches/maren-thumb.webp",
  },
  {
    id: "andre",
    name: "Andre",
    vibe: "Quiet standards. No wasted words.",
    src: "/coaches/andre.webp",
    thumbSrc: "/coaches/andre-thumb.webp",
  },
  {
    id: "cole",
    name: "Cole",
    vibe: "Easy voice. Serious about the work.",
    src: "/coaches/cole.webp",
    thumbSrc: "/coaches/cole-thumb.webp",
  },
  {
    id: "sloane",
    name: "Sloane",
    vibe: "Bright energy. Makes the hard round doable.",
    src: "/coaches/sloane.webp",
    thumbSrc: "/coaches/sloane-thumb.webp",
  },
  {
    id: "malik",
    name: "Malik",
    vibe: "Direct and grounded. High bar, no drama.",
    src: "/coaches/malik.webp",
    thumbSrc: "/coaches/malik-thumb.webp",
  },
] as const;

export const DEFAULT_COACH_ID = COACHES[0].id;

export type CoachingStyle = {
  id: string;
  label: string;
  detail: string;
  voice: string;
};

export const COACHING_STYLES: readonly CoachingStyle[] = [
  {
    id: "tough",
    label: "Tough",
    detail: "Drill-sergeant. Short, direct, high standards.",
    voice:
      "Tough and drill-sergeant. Use short sentences, direct corrections, and a high standard. No insults and no shame.",
  },
  {
    id: "supportive",
    label: "Supportive",
    detail: "Encouraging. What is working, then the next step.",
    voice:
      "Supportive and encouraging. Name what is working, then one clear next step. Stay honest.",
  },
  {
    id: "technical",
    label: "Technical",
    detail: "Analytical. Mechanics and why, then the drill.",
    voice:
      "Technical and analytical. Lead with the mechanism, positions, and why, then the concrete cue.",
  },
  {
    id: "hype",
    label: "Hype",
    detail: "High-energy. Momentum without empty noise.",
    voice:
      "Hype and high-energy. Bring momentum and belief, and stay practical. No empty slogans and no emojis.",
  },
] as const;

export const DEFAULT_COACHING_STYLE_ID = "supportive";

export function isCoachId(value: string | undefined | null): value is string {
  return Boolean(value && COACHES.some((coach) => coach.id === value));
}

export function isCoachingStyle(value: string | undefined | null): value is string {
  return Boolean(value && COACHING_STYLES.some((style) => style.id === value));
}

export function resolveCoach(id: string | undefined | null): Coach {
  return COACHES.find((coach) => coach.id === id) ?? COACHES.find((coach) => coach.id === DEFAULT_COACH_ID)!;
}

export function resolveCoachingStyle(id: string | undefined | null): CoachingStyle {
  return (
    COACHING_STYLES.find((style) => style.id === id) ??
    COACHING_STYLES.find((style) => style.id === DEFAULT_COACHING_STYLE_ID)!
  );
}

export function needsCoachChoicePrompt(
  profile: { coachChoiceAt: Date | null } | null | undefined,
) {
  return Boolean(profile) && !profile?.coachChoiceAt;
}

/**
 * Tone only. Answer-style sections and safety rules stay in charge.
 * Omitted when the caller did not pass a coach or a style (existing prompts).
 */
export function coachingStyleVoice(input: {
  coachName?: string;
  coachingStyle?: string;
}) {
  if (!input.coachName && !input.coachingStyle) return "";
  const style = resolveCoachingStyle(input.coachingStyle);
  const name = input.coachName?.trim() || resolveCoach(null).name;
  return [
    `Speak as ${name}, the member's chosen SVG Coach voice.`,
    `Coaching style: ${style.label}. ${style.voice}`,
    "You are still the SVG AI coach, not a human and not medical advice.",
    "This changes tone only. Keep the answer-style sections, the safety rules, and the weight-cut rules exactly as written.",
  ].join(" ");
}

export function shouldHideCoachFab(pathname: string) {
  return pathname === "/coach" || pathname.startsWith("/coach/");
}

/** Fixed bottom offset so the avatar clears the dock, the + button, or a sticky logger bar. */
export function coachFabBottomClass(
  pathname: string,
  options?: { staffDock?: boolean },
) {
  if (isImmersiveTrainingPath(pathname)) {
    return "bottom-[calc(6.75rem+env(safe-area-inset-bottom))]";
  }
  if (options?.staffDock) {
    return "bottom-[calc(7.5rem+env(safe-area-inset-bottom))]";
  }
  return "bottom-[calc(5.25rem+env(safe-area-inset-bottom))]";
}
