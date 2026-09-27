/**
 * Optional no-gym / travel day. Not a replacement for the Core week
 * unless the athlete chooses it.
 */

export type TravelBlock = {
  name: string;
  prescription: string;
  cues: string;
};

export const TRAVEL_KB: TravelBlock[] = [
  {
    name: "Kettlebell swings",
    prescription: "10 sets × 10",
    cues: "Crisp hip snap, full lockout, then shake out. Shadowbox easy between sets so you are not smoked for later training.",
  },
  {
    name: "Turkish get-ups",
    prescription: "5 each side",
    cues: "Slow and organized. Eyes on the fist if you have a bell. No bell: use a shoe balanced on the fist and keep the same path.",
  },
];

export const TRAVEL_CIRCUIT: TravelBlock[] = [
  {
    name: "Squat to stand",
    prescription: "3 rounds × 8",
    cues: "Hands to the floor, squat down, stand tall. Easy pace.",
  },
  {
    name: "Push-ups",
    prescription: "3 rounds × 8–12",
    cues: "Straight body. Drop to the knees if the last reps fall apart.",
  },
  {
    name: "Reverse lunges",
    prescription: "3 rounds × 6 / side",
    cues: "Step back, knee soft, stand through the front heel.",
  },
  {
    name: "Mountain climbers",
    prescription: "3 rounds × 20 s",
    cues: "Hands under shoulders. Stop if the low back sags.",
  },
];

export const TRAVEL_CREDITS = [
  {
    coach: "Pavel Macek / StrongFirst",
    url: "https://www.strongfirst.com/preparing-a-mma-fighter/",
    idea: "swings and get-ups with full recovery",
  },
  {
    coach: "Ross Enamait",
    url: "https://rosstraining.com/blog/work-capacity-101/",
    idea: "a no-gym work-capacity circuit",
  },
] as const;
