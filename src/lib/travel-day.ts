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
    name: "Half-kneeling turn",
    prescription: "2 sets × 6 each side",
    cues: "Half kneel with a light bell at the chest, or empty hands. Turn the ribs and keep the hips pointed forward. Idea seen in a post by @maximilianmoves.",
  },
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
  {
    name: "Bear-hug carry",
    prescription: "3 walks × 20 s",
    cues: "Hug a backpack at the chest and walk tall. If you lean back, lighten the bag. Idea seen in a post by @fit.ferris.",
  },
];

export const TRAVEL_CREDITS = [
  {
    coach: "@maximilianmoves",
    url: "https://www.instagram.com/p/DQm7NdGDi1X/",
    idea: "a half-kneeling turn with a kettlebell",
  },
  {
    coach: "@fit.ferris",
    url: "https://www.instagram.com/p/DZRCVVUCm5O/",
    idea: "a bear-hug carry you can do with a backpack",
  },
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
