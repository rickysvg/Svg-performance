import { intensityBand, resolveAiCoach, type AiCoachId, type IntensityBand } from "@/lib/coaches";

/**
 * Same gym moment, said in each coach's character.
 * About 40 words so a read lands near 15 seconds.
 */
const INTRO: Record<AiCoachId, Record<IntensityBand, string>> = {
  skye: {
    calm: "Skye. You're here, and that already counts. Today is bag work and a lift. Hands stay home on the bag. On the squat, leave two reps in the tank. Keep the pace honest.",
    balanced: "Skye. Today is bag work and a lift. Hands stay home. On the squat, leave two clean reps. One standard, then the next piece. Keep the pace honest.",
    lifted: "Skye. You're in. Bag work, then the lift. Hands home. Leave two reps on the squat. Next piece, same honesty. Keep the pace honest.",
    intense: "Skye. Bag, then the lift. Hands home. Two reps left on the squat. Do that. Keep the pace honest.",
  },
  maya: {
    calm: "Maya. Good, you're here. Today is bag work and a lift. One detail on the bag: hands home. On the squat, leave two reps. Stay on that detail.",
    balanced: "Maya. Today is bag work and a lift. The detail is hands home, then two reps left on the squat. Stay on that detail until it is clean.",
    lifted: "Maya. Bag work, then the lift. Hands home. Two reps left on the squat. Make that the detail. Stay on that detail.",
    intense: "Maya. Bag, then the lift. Hands home. Two reps left on the squat. That detail. Stay on that detail.",
  },
  mateo: {
    calm: "Mateo. You're in. Bag work, then a lift. Hands home. Leave two reps on the squat. Quiet work. Do it clean.",
    balanced: "Mateo. Bag work and a lift. Hands home. Two reps left on the squat. That is the standard. Do it clean.",
    lifted: "Mateo. Bag, then the lift. Hands home. Two reps in the tank. Same standard. Do it clean.",
    intense: "Mateo. Bag. Then the lift. Hands home. Two reps left. Do it clean.",
  },
  cole: {
    calm: "Cole. Glad you're here. Today is bag work and a lift. Hands stay home. Leave two reps on the squat. I'm with you.",
    balanced: "Cole. Bag work, then the lift. Hands home. Two reps left on the squat. That's the job. I'm with you.",
    lifted: "Cole. We're on it. Bag work, then the lift. Hands home. Two reps left. Next rep. I'm with you.",
    intense: "Cole. Bag, then the lift. Hands home. Two reps left. Do it. I'm with you.",
  },
  ricky: {
    calm: "Ricky here. You're in. Today is bag work and a lift. Hands stay home. Leave two reps on the squat. We'll do today's work. No fluff.",
    balanced: "Ricky here. Bag work and a lift. Hands home. Two reps left on the squat. That is the standard. No fluff.",
    lifted: "Ricky here. We're on this. Bag, then the lift. Hands home. Two reps left. Next piece. No fluff.",
    intense: "Ricky here. Bag, then the lift. Hands home. Two reps left on the squat. Do today's work. No fluff.",
  },
};

export function coachIntroScript(coachId?: string | null, coachingStyle?: string | null) {
  const coach = resolveAiCoach(coachId);
  return INTRO[coach.id][intensityBand(coachingStyle)];
}

/** A short Today's Summary in Ricky's voice, for the sample file. */
export function rickySummarySample() {
  return [
    "Ricky here. Friday.",
    "You have bag work and a lift.",
    "Bag. The theme is the intelligent jab. Hands home. Snap it back. About forty minutes, then you stop.",
    "Lift. Back squat. Zero to two reps in reserve. Main lifts stop at four sets. Last rep can slow down and still stay clean.",
    "Then hips and t-spine. Easy range. No grinding.",
    "Show up and do today's work. No extra. No fluff.",
  ].join(" ");
}
