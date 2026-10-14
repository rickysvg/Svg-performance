/**
 * Striker vs grappler accessory emphasis.
 * Idea from Lachlan James (2016): strikers lean toward high-velocity power,
 * grapplers toward max strength and longer efforts. SVG chooses the accessories.
 */

import { pogoPlyoDrill, strikerPlyoAddOn } from "@/lib/ig-drills";

export const EMPHASIS_OPTIONS = ["balanced", "striker", "grappler"] as const;
export type TrainingEmphasis = (typeof EMPHASIS_OPTIONS)[number];

export const EMPHASIS_CREDIT = {
  coach: "Lachlan James",
  url: "https://pubmed.ncbi.nlm.nih.gov/26993133/",
  idea: "striker and grappler qualities differ",
} as const;

export function isTrainingEmphasis(value: string | null | undefined): value is TrainingEmphasis {
  return (EMPHASIS_OPTIONS as readonly string[]).includes(value ?? "");
}

export function emphasisLabel(value: string | null | undefined) {
  if (value === "striker") return "Striker";
  if (value === "grappler") return "Grappler";
  return "Balanced";
}

export type PlyoDrill = {
  name: string;
  prescription: string;
  cues: string;
};

const LANDING: PlyoDrill = {
  name: "Snap-down landings",
  prescription: "2 sets × 4",
  cues: "Stick each landing quietly. Knees track over the toes. Earn the jumps by landing well first.",
};

/** Floor plyos when the member has no gym and no weights. No med ball, band, or loaded carry. */
export function floorPlyoBlock(): PlyoDrill[] {
  return [
    LANDING,
    pogoPlyoDrill(),
    {
      name: "Broad jumps",
      prescription: "3 sets × 3",
      cues: "Jump out, stick the landing, rest fully.",
    },
    {
      name: "Jump squats",
      prescription: "3 sets × 4",
      cues: "Small jump, quiet feet. Open floor only.",
    },
  ];
}

export function plyoBlockFor(emphasis: TrainingEmphasis | string | null | undefined): PlyoDrill[] {
  const mode = isTrainingEmphasis(emphasis) ? emphasis : "balanced";
  if (mode === "striker") {
    return [
      LANDING,
      pogoPlyoDrill(),
      {
        name: "Broad jumps",
        prescription: "3 sets × 3",
        cues: "Horizontal jump, full rest. Reset the landing before the next one.",
      },
      {
        name: "Band shots",
        prescription: "3 sets × 5 / side",
        cues: "Fast hip turn into the band. Crisp, not sloppy.",
      },
      {
        name: "Jump squats",
        prescription: "3 sets × 4",
        cues: "Leave the ground only as high as you can land quietly.",
      },
      strikerPlyoAddOn(),
      {
        name: "Med-ball rotational throws",
        prescription: "3 sets × 4 / side",
        cues: "Hips lead the throw. Short and fast.",
      },
    ];
  }
  if (mode === "grappler") {
    return [
      LANDING,
      pogoPlyoDrill(),
      {
        name: "Broad jumps",
        prescription: "3 sets × 3",
        cues: "Horizontal power, then a still landing.",
      },
      {
        name: "Pause goblet squat",
        prescription: "3 sets × 5",
        cues: "Two-second pause in the bottom. This is strength, not a bounce.",
      },
      {
        name: "Farmer carry",
        prescription: "3 holds × 20 s",
        cues: "Heavy enough to stay honest. Walk tall for the whole hold.",
      },
      {
        name: "Med-ball rotational throws",
        prescription: "3 sets × 3 / side",
        cues: "Power, then rest. Fewer throws, full intent.",
      },
    ];
  }
  return [
    LANDING,
    pogoPlyoDrill(),
    {
      name: "Broad jumps",
      prescription: "3 sets × 3",
      cues: "Jump out, stick the landing, rest fully.",
    },
    {
      name: "Med-ball rotational throws",
      prescription: "3 sets × 4 / side",
      cues: "Rotate from the hips into a wall.",
    },
    {
      name: "Band shots",
      prescription: "3 sets × 4 / side",
      cues: "Snap the hip. Stop if the band pulls you off balance.",
    },
    {
      name: "Jump squats",
      prescription: "3 sets × 4",
      cues: "Small jump, quiet feet. 8–10 minutes total, then lift.",
    },
  ];
}

export function accessoryNote(emphasis: TrainingEmphasis | string | null | undefined) {
  const mode = isTrainingEmphasis(emphasis) ? emphasis : "balanced";
  if (mode === "striker") {
    return "Striker emphasis: quiet pogo hops and a lunge-to-high-knee sit in the plyo block. Step-off-the-line work is on the drill list. The Daru lifts stay on the plan.";
  }
  if (mode === "grappler") {
    return "Grappler emphasis: quiet pogo hops, a paused squat, longer carries, a wall get-up, and the Friday neck isometrics. The Daru lifts stay on the plan.";
  }
  return "Balanced emphasis: a short power block, then the regular lifts.";
}

export const PLYO_CREDITS = [
  {
    coach: "Loren Landow",
    url: "https://www.landowperformance.com/founder-loren-landow",
    idea: "landing mechanics before plyometric volume",
  },
  {
    coach: "Joel Jamieson",
    url: "https://8weeksout.com/2008/10/06/explosive-mma-conditioning/",
    idea: "horizontal and rotational power",
  },
  {
    coach: "Jonathan Chaimberg",
    url: "https://www.grapplearts.com/gsps-original-mma-conditioning-coach-jon-chaimberg/",
    idea: "med-ball power and a dynamic warm-up",
  },
] as const;

export const PLYO_MINUTES = "8–10 min";
