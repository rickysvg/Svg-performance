export const COACH_PUBLIC_NAME = "SVG Coach";

export const COACH_TOPICS = ["martial_art", "conditioning", "mental"] as const;
export type CoachTopic = (typeof COACH_TOPICS)[number];

export const COACH_TOPIC_LABELS: Record<CoachTopic, string> = {
  martial_art: "Martial art",
  conditioning: "Conditioning",
  mental: "Mental",
};

export const COACH_TOPIC_BLURBS: Record<CoachTopic, string> = {
  martial_art: "Technique, rules, and fight IQ for a specific art.",
  conditioning: "Strength, conditioning, recovery, and training load.",
  mental: "Mindset and fight IQ: arousal, routines, and decisions.",
};

export const COACH_ARTS = [
  "boxing",
  "muay-thai",
  "kickboxing",
  "wrestling",
  "catch-wrestling",
  "jiu-jitsu",
  "judo",
  "sambo",
  "karate",
  "taekwondo",
  "mma",
  "cagework",
  "general",
] as const;
export type CoachArt = (typeof COACH_ARTS)[number];

export const COACH_ART_LABELS: Record<CoachArt, string> = {
  boxing: "Boxing",
  "muay-thai": "Muay Thai",
  kickboxing: "Kickboxing",
  wrestling: "Wrestling",
  "catch-wrestling": "Catch wrestling",
  "jiu-jitsu": "Jiu-Jitsu",
  judo: "Judo",
  sambo: "Sambo",
  karate: "Karate",
  taekwondo: "Taekwondo",
  mma: "MMA",
  cagework: "Cagework",
  general: "General striking / grappling",
};

/** One coaching principle and the rule set that usually governs the art. */
export const COACH_ART_EXPERT: Record<CoachArt, string> = {
  boxing:
    "Boxing principle: the jab is the range finder, the hands live at home, and the feet step without crossing. Amateur cards often use headgear and a standing eight. Pro boxing is a 10-point must system. Elbows and holding are fouls. The referee breaks the clinch.",
  "muay-thai":
    "Muay Thai principle: score with the whole body, return to a tall stance, and kick with the shin. Traditional Thai rules usually allow elbows, knees, sweeps, and a long clinch. IFMA amateur Muay Thai usually bans elbows and limits clinch time. Check the card.",
  kickboxing:
    "Kickboxing principle: hands and kicks share one base, the shin meets the target, and the leg comes home. Most kickboxing rules (K-1, Glory, WAKO point or low-kick) ban elbows and allow only a short clinch, if any. Knees depend on the rule set.",
  wrestling:
    "Wrestling principle: win the angle and the level before you shoot, then finish on your feet. Folkstyle scores takedowns, escapes, reversals, and near-fall. Freestyle scores exposure. Greco-Roman does not allow attacks below the waist. No strikes.",
  "catch-wrestling":
    "Catch principle: control the body, then the pin or the submission. Prefer rides, turns, and joint locks that have a clean tap. Neck cranks and spinal locks are ruleset-specific. Do not teach them as a default. No strikes unless the event is a combat ruleset.",
  "jiu-jitsu":
    "Jiu-jitsu principle: frames before strength, hips before arms, and a tap ends the rep. IBJJF gi bans heel hooks at every belt and bans knee reaping. No-gi leg-lock rules change by belt. Slams are illegal. Check the current IBJJF book for the division.",
  judo:
    "Judo principle: kuzushi, then the throw, then immediate groundwork only while it is progressing. Under current IJF contest rules a direct hand grab on the leg in standing is penalized. Ippon needs impact and control. Check the current IJF rules.",
  sambo:
    "Sambo principle: use the jacket, commit the hips, and finish the throw. Sport sambo allows throws and many leg locks and arm locks, and it does not allow chokes or strikes. Combat sambo adds strikes and chokes. They are different sports. Check FIAS for the event.",
  karate:
    "Karate principle: short path, hip behind the weapon, recover the stance. WKF kumite scores controlled punches and kicks to legal targets. Face contact depends on the category. Excessive contact is a penalty. Check the current WKF rules for that division.",
  taekwondo:
    "Taekwondo principle: chamber, turn the hip, retract the kick onto a live base. World Taekwondo scores kicks, with head kicks and turning kicks worth more than body kicks. Punches to the head do not score. Elbows and knees are not part of WT sparring. Check the current WT point values.",
  mma:
    "MMA principle: strike, clinch, and grapple as one game, and know which rule set you are under. Pro Unified Rules (ABC, July 2024 revision) allow elbow strikes except to the spine and the back of the head. The 12-6 elbow was removed as an ABC foul in that revision, and not every commission has adopted it. Amateur rules usually ban all elbow and forearm strikes and knees to the head. A grounded fighter, under the 2024 ABC text, has any part other than the hands or feet on the canvas and may not be kneed or kicked in the head. Check the commission. For El Paso, that check includes Texas TDLR.",
  cagework:
    "Cage principle: the fence is a tool for frames, underhooks, and wall-walks. Grabbing it with fingers or toes is a foul under the Unified Rules. A hand may push off. Toes may pass through. Texas's published text is stricter, so do not assume a push-off is legal on a Texas card until TDLR says so.",
  general:
    "General principle: name the art and the rule set before you teach a weapon. A move that is legal in Muay Thai can be a foul in boxing, kickboxing, or amateur MMA.",
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
    return "No topic is selected. Stay practical. If the question is broad, answer the best version of it and ask which lane they want.";
  }
  if (topic === "martial_art") {
    const artLabel = isCoachArt(art) ? COACH_ART_LABELS[art] : "general striking / grappling";
    const expert = isCoachArt(art) ? COACH_ART_EXPERT[art] : COACH_ART_EXPERT.general;
    return [
      `Stay in the martial-art lane: ${artLabel}.`,
      expert,
      "Teach the technique or the rule that was asked. Follow the answer style for this question type. Do not prescribe unsupervised sparring, live blasting, or a paid curriculum.",
      "Separate fight IQ (reads, plans, if-thens) from mindset (arousal, routines, self-talk). Do not turn a tactics question into a feelings talk, or a nerves question into a game plan.",
      "YouTube / Learn clips are external technique references — never claim they are SVG-produced film.",
      "You may end with one line suggesting live reps with a coach. Never make that the whole answer.",
    ].join(" ");
  }
  if (topic === "conditioning") {
    return [
      "Stay in the conditioning lane: strength, power, energy systems, work capacity, recovery, and training load.",
      "Expert standard: main lifts max 4 sets, accessories max 3, loads in lbs, effort in RIR. 0-2 RIR is near hard. Do not invent the member's numbers.",
      "Concurrent training: the priority session comes first. Do not max a lift the same day as hard sparring.",
      "Periodize when they have a camp: base, build, peak, taper. Beginners and off-season athletes do not get a fight-week template.",
      "Keep loads honest. No medical calorie plans, no dehydration protocols, no training through injury or head symptoms.",
      "One next session beats a punishment week.",
    ].join(" ");
  }
  return [
    "Stay in the mental lane and split the two jobs.",
    "Mindset: arousal control, pre-performance routines, imagery, instructional self-talk, and the week after a loss. Be direct. No shame.",
    "Fight IQ: reads, game plans, and if-then decisions. Keep it tactical. Do not turn it into a feelings talk.",
    "No invented fight dates or Ricky comments.",
    "If they need a human call, point them to Book with Ricky.",
  ].join(" ");
}
