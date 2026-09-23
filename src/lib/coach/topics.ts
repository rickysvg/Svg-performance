export const COACH_PUBLIC_NAME = "SVG Coach";

export const COACH_TOPICS = ["martial_art", "conditioning", "mental"] as const;
export type CoachTopic = (typeof COACH_TOPICS)[number];

export const COACH_TOPIC_LABELS: Record<CoachTopic, string> = {
  martial_art: "Martial art",
  conditioning: "Conditioning",
  mental: "Mental",
};

export const COACH_TOPIC_BLURBS: Record<CoachTopic, string> = {
  martial_art: "Technique, stance, and class cues for a specific art.",
  conditioning: "Strength, conditioning, recovery, and training load.",
  mental: "Mindset, discipline, fight-week nerves, consistency, resilience.",
};

export const COACH_ARTS = [
  "boxing",
  "muay-thai",
  "wrestling",
  "jiu-jitsu",
  "mma",
  "cagework",
  "general",
] as const;
export type CoachArt = (typeof COACH_ARTS)[number];

export const COACH_ART_LABELS: Record<CoachArt, string> = {
  boxing: "Boxing",
  "muay-thai": "Muay Thai",
  wrestling: "Wrestling",
  "jiu-jitsu": "Jiu-Jitsu",
  mma: "MMA",
  cagework: "Cagework",
  general: "General striking / grappling",
};

export function isCoachTopic(value: string | undefined): value is CoachTopic {
  return Boolean(value && COACH_TOPICS.includes(value as CoachTopic));
}

export function isCoachArt(value: string | undefined): value is CoachArt {
  return Boolean(value && COACH_ARTS.includes(value as CoachArt));
}

export function resolveCoachTopic(value: string | undefined): CoachTopic | undefined {
  return isCoachTopic(value) ? value : undefined;
}

export function resolveCoachArt(value: string | undefined): CoachArt | undefined {
  return isCoachArt(value) ? value : undefined;
}

export function coachLaneLabel(topic?: string, art?: string) {
  if (!isCoachTopic(topic)) return "";
  if (topic === "martial_art") {
    if (isCoachArt(art)) return `${COACH_TOPIC_LABELS[topic]} · ${COACH_ART_LABELS[art]}`;
    return COACH_TOPIC_LABELS[topic];
  }
  return COACH_TOPIC_LABELS[topic];
}

export function buildCoachHref(query: { topic?: string; art?: string }) {
  const params = new URLSearchParams();
  if (query.topic) params.set("topic", query.topic);
  if (query.art) params.set("art", query.art);
  const search = params.toString();
  return search ? `/coach?${search}` : "/coach";
}

export function coachTopicContext(topic?: string, art?: string) {
  if (!isCoachTopic(topic)) {
    return "No topic is selected. Stay practical and ask which lane they want if the question is broad.";
  }
  if (topic === "martial_art") {
    const artLabel = isCoachArt(art) ? COACH_ART_LABELS[art] : "general striking / grappling";
    return [
      `Stay in the martial-art lane: ${artLabel}.`,
      "Give one or two technical cues. Do not prescribe unsupervised sparring, live blasting, or a paid curriculum.",
      "YouTube / Learn clips are external technique references — never claim they are SVG-produced film.",
      "Send them to a coach on the floor for live eyes.",
    ].join(" ");
  }
  if (topic === "conditioning") {
    return [
      "Stay in the conditioning lane: strength, work capacity, recovery, and training load.",
      "Keep loads honest. No medical calorie plans, no rapid cuts, no training through injury.",
      "One next session beats a punishment week.",
    ].join(" ");
  }
  return [
    "Stay in the mental lane: mindset, discipline, fight-week nerves, consistency, and resilience.",
    "Be direct and encouraging. No shame. No invented fight dates or Ricky comments.",
    "If they need a human call, point them to Book with Ricky.",
  ].join(" ");
}
