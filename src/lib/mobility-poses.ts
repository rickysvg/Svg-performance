/**
 * Position demos for mobility stretches and drill cards.
 * Original SVG figures — not filmed coaches, and not a reprint of a credited program.
 */
import { IG_DRILLS } from "@/lib/ig-drills";
import { MOBILITY_ROUTINES } from "@/lib/mobility";

export type XY = readonly [number, number];

export type FigureProp =
  | { kind: "wall"; x: number; y: number; h: number }
  | { kind: "box"; x: number; y: number; w: number; h: number }
  | { kind: "bar"; x1: number; x2: number; y: number }
  | { kind: "arc"; cx: number; cy: number; r: number }
  | { kind: "arrow"; x1: number; y1: number; x2: number; y2: number };

export type FigureLimb = "armL" | "armR" | "legL" | "legR";

export type FigureSpec = {
  caption: string;
  head: XY;
  shoulder: XY;
  hip: XY;
  elbowL: XY;
  handL: XY;
  elbowR: XY;
  handR: XY;
  kneeL: XY;
  footL: XY;
  kneeR: XY;
  footR: XY;
  accent?: FigureLimb[];
  props?: FigureProp[];
};

const BASE: Omit<FigureSpec, "caption"> = {
  head: [108, 30],
  shoulder: [108, 50],
  hip: [108, 96],
  elbowL: [86, 74],
  handL: [76, 102],
  elbowR: [132, 74],
  handR: [146, 100],
  kneeL: [98, 132],
  footL: [92, 166],
  kneeR: [124, 132],
  footR: [140, 166],
};

function fig(caption: string, over: Partial<Omit<FigureSpec, "caption">> = {}): FigureSpec {
  return { caption, ...BASE, ...over };
}

function say(spec: FigureSpec, caption: string): FigureSpec {
  return { ...spec, caption };
}

const hipCircles = fig("Stand on one leg and draw a slow circle with the other knee.", {
  kneeR: [156, 108],
  footR: [148, 140],
  handL: [78, 70],
  elbowL: [88, 58],
  accent: ["legR"],
  props: [{ kind: "arc", cx: 168, cy: 112, r: 22 }],
});

const frontRaise = fig("Stand tall and lift one straight leg in front of you.", {
  kneeR: [156, 90],
  footR: [204, 74],
  handL: [70, 62],
  elbowL: [84, 52],
  accent: ["legR"],
  props: [{ kind: "arrow", x1: 150, y1: 118, x2: 198, y2: 78 }],
});

const sideRaise = fig("Lift the leg out to the side without leaning away.", {
  head: [100, 30],
  shoulder: [100, 50],
  hip: [100, 96],
  kneeL: [96, 132],
  footL: [92, 166],
  kneeR: [158, 96],
  footR: [214, 86],
  elbowL: [70, 70],
  handL: [52, 88],
  elbowR: [128, 40],
  handR: [148, 28],
  accent: ["legR"],
  props: [{ kind: "arrow", x1: 140, y1: 120, x2: 206, y2: 90 }],
});

const backRaise = fig("Hinge slightly and lift the leg long behind you.", {
  head: [68, 78],
  shoulder: [92, 86],
  hip: [128, 102],
  kneeL: [136, 134],
  footL: [146, 166],
  kneeR: [176, 80],
  footR: [218, 62],
  elbowL: [70, 100],
  handL: [52, 118],
  elbowR: [112, 96],
  handR: [128, 112],
  accent: ["legR"],
});

const kneeChest = fig("Pull one knee to the chest and pause at the top.", {
  kneeR: [136, 70],
  footR: [156, 96],
  elbowR: [128, 62],
  handR: [124, 78],
  elbowL: [112, 66],
  handL: [118, 84],
  accent: ["legR"],
});

const lungeKnee = fig("From a short lunge, rise into a controlled knee. Hands up.", {
  head: [118, 32],
  shoulder: [118, 52],
  hip: [116, 100],
  kneeR: [156, 128],
  footR: [178, 166],
  kneeL: [78, 76],
  footL: [60, 98],
  elbowL: [100, 48],
  handL: [96, 34],
  elbowR: [142, 46],
  handR: [154, 34],
  accent: ["legL"],
});

const chairRound = fig("Hold a chair, chamber, and extend a slow roundhouse.", {
  head: [96, 36],
  shoulder: [96, 56],
  hip: [100, 100],
  elbowL: [62, 88],
  handL: [44, 100],
  elbowR: [124, 70],
  handR: [140, 58],
  kneeL: [90, 132],
  footL: [84, 166],
  kneeR: [158, 86],
  footR: [214, 70],
  accent: ["legR"],
  props: [{ kind: "box", x: 16, y: 78, w: 36, h: 88 }],
});

const chairSide = say(
  { ...chairRound, kneeR: [160, 102], footR: [216, 100] },
  "Hold a chair, lift the knee, and press the heel out slowly.",
);

const pivotShadow = fig("Shadow a slow kick and pivot the base foot. Stay tall.", {
  elbowL: [92, 48],
  handL: [86, 34],
  elbowR: [136, 48],
  handR: [150, 36],
  kneeL: [88, 132],
  footL: [72, 166],
  kneeR: [130, 128],
  footR: [154, 166],
  accent: ["legL"],
  props: [{ kind: "arc", cx: 70, cy: 158, r: 16 }],
});

const wallHang = fig("Hands on the wall, hips back, flat back, head between the arms.", {
  head: [118, 74],
  shoulder: [146, 58],
  hip: [96, 112],
  elbowL: [168, 48],
  handL: [196, 42],
  elbowR: [178, 62],
  handR: [204, 58],
  kneeL: [70, 140],
  footL: [52, 166],
  kneeR: [88, 140],
  footR: [78, 166],
  accent: ["armL", "armR"],
  props: [{ kind: "wall", x: 208, y: 18, h: 150 }],
});

const footSupport = fig("Heel on a low support. Rock the hips, then hold.", {
  head: [58, 78],
  shoulder: [84, 88],
  hip: [118, 112],
  kneeL: [108, 140],
  footL: [98, 166],
  kneeR: [168, 118],
  footR: [198, 108],
  elbowL: [64, 108],
  handL: [48, 124],
  elbowR: [108, 100],
  handR: [130, 112],
  accent: ["legR"],
  props: [{ kind: "box", x: 176, y: 108, w: 52, h: 58 }],
});

const halfSplit = fig("Front leg long, back knee down, hips square. Fold only as far as the knee stays straight.", {
  head: [150, 96],
  shoulder: [118, 108],
  hip: [78, 120],
  kneeR: [148, 150],
  footR: [208, 158],
  kneeL: [48, 150],
  footL: [26, 132],
  elbowR: [160, 124],
  handR: [182, 142],
  elbowL: [96, 128],
  handL: [112, 146],
  accent: ["legR"],
});

const frog = fig("Knees wide, hips back toward the heels, then shift forward a little.", {
  head: [120, 68],
  shoulder: [120, 90],
  hip: [120, 118],
  kneeL: [52, 146],
  footL: [34, 164],
  kneeR: [188, 146],
  footR: [206, 164],
  elbowL: [96, 132],
  handL: [88, 154],
  elbowR: [144, 132],
  handR: [154, 154],
  accent: ["legL", "legR"],
  props: [{ kind: "arrow", x1: 120, y1: 48, x2: 120, y2: 28 }],
});

const straddle = fig("Seated straddle. Lean the chest forward with a long spine.", {
  head: [120, 46],
  shoulder: [120, 70],
  hip: [120, 116],
  kneeL: [68, 146],
  footL: [22, 162],
  kneeR: [172, 146],
  footR: [218, 162],
  elbowL: [100, 108],
  handL: [92, 136],
  elbowR: [140, 108],
  handR: [150, 136],
  accent: ["legL", "legR"],
});

const straddlePush = say(
  {
    ...straddle,
    props: [
      { kind: "arrow", x1: 68, y1: 128, x2: 68, y2: 156 },
      { kind: "arrow", x1: 172, y1: 128, x2: 172, y2: 156 },
    ],
  },
  "Hold the straddle, press the inner thighs down, then pull a little deeper.",
);

const ankleCircles = fig("Draw a slow full circle with the foot. Keep the knee still.", {
  head: [72, 52],
  shoulder: [72, 74],
  hip: [72, 112],
  kneeL: [48, 140],
  footL: [70, 156],
  kneeR: [132, 128],
  footR: [188, 140],
  elbowL: [56, 100],
  handL: [48, 124],
  elbowR: [96, 100],
  handR: [112, 118],
  accent: ["legR"],
  props: [{ kind: "arc", cx: 196, cy: 128, r: 16 }],
});

const kneeWall = fig("Bend the knee toward the wall without the heel lifting.", {
  head: [112, 38],
  shoulder: [118, 58],
  hip: [128, 104],
  kneeR: [176, 116],
  footR: [190, 166],
  kneeL: [96, 136],
  footL: [78, 166],
  elbowL: [100, 78],
  handL: [88, 98],
  elbowR: [140, 78],
  handR: [154, 96],
  accent: ["legR"],
  props: [
    { kind: "wall", x: 208, y: 36, h: 132 },
    { kind: "arrow", x1: 168, y1: 116, x2: 198, y2: 108 },
  ],
});

const deepSquat = fig("Sit in the bottom of a squat. Heels down. Shift knee to knee.", {
  head: [120, 34],
  shoulder: [120, 54],
  hip: [120, 108],
  kneeL: [70, 132],
  footL: [48, 166],
  kneeR: [170, 132],
  footR: [192, 166],
  elbowL: [104, 78],
  handL: [108, 96],
  elbowR: [136, 78],
  handR: [132, 96],
  accent: ["legL", "legR"],
});

const standingScale = fig("Stand on one leg and hinge until the free leg reaches back.", {
  head: [36, 70],
  shoulder: [68, 78],
  hip: [116, 92],
  kneeR: [116, 130],
  footR: [116, 166],
  kneeL: [170, 76],
  footL: [214, 62],
  elbowR: [40, 64],
  handR: [18, 58],
  elbowL: [90, 70],
  handL: [108, 62],
  accent: ["legL"],
});

const shoulderCircles = fig("The arm makes a big slow circle while the ribs stay down.", {
  elbowR: [148, 34],
  handR: [172, 26],
  accent: ["armR"],
  props: [{ kind: "arc", cx: 154, cy: 48, r: 30 }],
});

const tspine = fig("On hands and knees, rotate the chest open, then thread the elbow through.", {
  head: [70, 70],
  shoulder: [98, 80],
  hip: [124, 108],
  kneeL: [88, 150],
  footL: [62, 158],
  kneeR: [158, 150],
  footR: [184, 158],
  elbowL: [64, 128],
  handL: [52, 152],
  elbowR: [132, 46],
  handR: [158, 26],
  accent: ["armR"],
});

const loungeChair = fig("Kneel beside a bench. Elbow up so the front of the shoulder opens.", {
  head: [112, 46],
  shoulder: [118, 68],
  hip: [96, 118],
  kneeL: [78, 158],
  footL: [52, 150],
  kneeR: [122, 142],
  footR: [148, 166],
  elbowL: [96, 92],
  handL: [84, 112],
  elbowR: [168, 68],
  handR: [190, 54],
  accent: ["armR"],
  props: [{ kind: "box", x: 156, y: 52, w: 72, h: 26 }],
});

const hang = fig("Dead hang from a bar. Shoulders can start relaxed. Step down before the grip slips.", {
  head: [120, 78],
  shoulder: [120, 58],
  hip: [120, 116],
  elbowL: [96, 42],
  handL: [88, 26],
  elbowR: [144, 42],
  handR: [152, 26],
  kneeL: [108, 144],
  footL: [104, 166],
  kneeR: [132, 144],
  footR: [136, 166],
  accent: ["armL", "armR"],
  props: [{ kind: "bar", x1: 64, x2: 176, y: 22 }],
});

const neckFlex = fig("Palm on the forehead. Press gently into the hand. Keep the neck long.", {
  elbowR: [78, 48],
  handR: [86, 32],
  accent: ["armR"],
  props: [{ kind: "arrow", x1: 64, y1: 32, x2: 92, y2: 32 }],
});

const neckExt = fig("Hand on the back of the head. Press back gently. Keep the neck long.", {
  elbowR: [146, 46],
  handR: [140, 28],
  accent: ["armR"],
  props: [{ kind: "arrow", x1: 168, y1: 28, x2: 132, y2: 30 }],
});

const neckLeft = fig("Hand on the left side of the head. Press sideways without shrugging.", {
  elbowL: [78, 52],
  handL: [88, 34],
  accent: ["armL"],
  props: [{ kind: "arrow", x1: 60, y1: 34, x2: 92, y2: 34 }],
});

const neckRight = fig("Hand on the right side of the head. Press sideways without shrugging.", {
  elbowR: [150, 52],
  handR: [138, 34],
  accent: ["armR"],
  props: [{ kind: "arrow", x1: 176, y1: 34, x2: 142, y2: 34 }],
});

const sitThrough = fig("Step one foot through and sit the hip down, then back to a wide frog.", {
  head: [96, 52],
  shoulder: [112, 74],
  hip: [128, 104],
  elbowL: [78, 120],
  handL: [64, 148],
  elbowR: [140, 124],
  handR: [150, 152],
  kneeL: [100, 148],
  footL: [82, 162],
  kneeR: [172, 112],
  footR: [206, 142],
  accent: ["legR"],
});

const hip90 = fig("Both knees bent about 90 degrees. Switch sides with the hips.", {
  head: [112, 46],
  shoulder: [112, 68],
  hip: [112, 112],
  kneeR: [168, 128],
  footR: [112, 148],
  kneeL: [68, 140],
  footL: [36, 114],
  elbowL: [92, 100],
  handL: [84, 128],
  elbowR: [136, 96],
  handR: [154, 112],
  accent: ["legL", "legR"],
});

const pigeon = fig("Front shin across, back leg long. Keep the front knee happy.", {
  head: [124, 46],
  shoulder: [116, 70],
  hip: [104, 114],
  kneeR: [158, 132],
  footR: [104, 154],
  kneeL: [62, 124],
  footL: [20, 116],
  elbowL: [100, 96],
  handL: [92, 120],
  elbowR: [140, 92],
  handR: [158, 108],
  accent: ["legR"],
});

const plow = fig("Advanced. Roll toward the shoulders so the weight sits on the upper back, never the skull.", {
  head: [36, 118],
  shoulder: [78, 150],
  hip: [128, 78],
  kneeL: [108, 48],
  footL: [72, 36],
  kneeR: [88, 62],
  footR: [48, 70],
  elbowL: [52, 158],
  handL: [24, 164],
  elbowR: [108, 156],
  handR: [136, 162],
  accent: ["legL", "legR"],
});

const couch = fig("Back shin on the wall, front foot planted, torso tall.", {
  head: [96, 42],
  shoulder: [92, 64],
  hip: [82, 122],
  kneeL: [50, 132],
  footL: [40, 78],
  kneeR: [148, 134],
  footR: [180, 166],
  elbowL: [78, 88],
  handL: [68, 110],
  elbowR: [116, 86],
  handR: [134, 104],
  accent: ["legL"],
  props: [{ kind: "wall", x: 22, y: 28, h: 140 }],
});

const butterfly = fig("Soles together, knees open, tall spine.", {
  head: [120, 40],
  shoulder: [120, 62],
  hip: [120, 118],
  kneeL: [58, 140],
  footL: [110, 156],
  kneeR: [182, 140],
  footR: [130, 156],
  elbowL: [100, 112],
  handL: [104, 148],
  elbowR: [140, 112],
  handR: [136, 148],
  accent: ["legL", "legR"],
});

const child = fig("Hips toward the heels, arms long. Walk the hands to one side if you want.", {
  head: [168, 140],
  shoulder: [132, 134],
  hip: [72, 126],
  kneeL: [88, 156],
  footL: [52, 148],
  kneeR: [112, 156],
  footR: [70, 146],
  elbowL: [160, 142],
  handL: [204, 148],
  elbowR: [168, 130],
  handR: [214, 136],
  accent: ["armL", "armR"],
});

const breath = fig("Sit or lie down. In through the nose, out through the nose.", {
  head: [120, 40],
  shoulder: [120, 62],
  hip: [120, 118],
  kneeL: [74, 146],
  footL: [128, 152],
  kneeR: [166, 146],
  footR: [112, 158],
  elbowL: [96, 96],
  handL: [86, 124],
  elbowR: [144, 96],
  handR: [154, 124],
  props: [
    { kind: "arc", cx: 120, cy: 88, r: 14 },
    { kind: "arc", cx: 120, cy: 88, r: 24 },
  ],
});

const jointCircles = fig("Neck, shoulders, hips, knees, and ankles. Small easy circles.", {
  props: [
    { kind: "arc", cx: 108, cy: 30, r: 18 },
    { kind: "arc", cx: 146, cy: 74, r: 14 },
    { kind: "arc", cx: 140, cy: 132, r: 14 },
  ],
});

const frontSwing = fig("Hold a wall. Swing the leg forward and back under control.", {
  head: [78, 36],
  shoulder: [78, 56],
  hip: [80, 100],
  elbowL: [48, 84],
  handL: [32, 96],
  elbowR: [100, 74],
  handR: [114, 96],
  kneeL: [74, 134],
  footL: [70, 166],
  kneeR: [142, 68],
  footR: [186, 48],
  accent: ["legR"],
  props: [
    { kind: "wall", x: 16, y: 36, h: 132 },
    { kind: "arc", cx: 120, cy: 110, r: 48 },
  ],
});

const sideSwing = fig("Swing the leg across the body and out to the side. Do not lean to make it bigger.", {
  head: [78, 36],
  shoulder: [78, 56],
  hip: [80, 100],
  elbowL: [48, 84],
  handL: [32, 96],
  elbowR: [104, 70],
  handR: [120, 88],
  kneeL: [74, 134],
  footL: [70, 166],
  kneeR: [150, 108],
  footR: [208, 112],
  accent: ["legR"],
  props: [
    { kind: "wall", x: 16, y: 36, h: 132 },
    { kind: "arc", cx: 130, cy: 120, r: 40 },
  ],
});

const hipOpen = fig("Slow knee hugs, then open-the-gate steps. Save long holds for later.", {
  kneeR: [156, 84],
  footR: [172, 112],
  elbowR: [140, 70],
  handR: [148, 90],
  elbowL: [120, 74],
  handL: [132, 92],
  accent: ["legR"],
  props: [{ kind: "arrow", x1: 140, y1: 100, x2: 176, y2: 78 }],
});

const highKick = fig("Chamber the knee, turn the standing heel, and extend only as high as you can pause.", {
  elbowL: [90, 46],
  handL: [84, 32],
  elbowR: [132, 46],
  handR: [146, 32],
  kneeR: [158, 72],
  footR: [208, 40],
  accent: ["legR"],
});

const kickRecover = say(
  {
    ...highKick,
    props: [{ kind: "arrow", x1: 200, y1: 52, x2: 168, y2: 150 }],
  },
  "Throw a controlled kick and land where you could kick again.",
);

const pogo = fig("Small hops on the balls of the feet. Land softly.", {
  kneeL: [96, 124],
  footL: [90, 150],
  kneeR: [128, 124],
  footR: [142, 150],
  accent: ["legL", "legR"],
  props: [{ kind: "arrow", x1: 120, y1: 150, x2: 120, y2: 118 }],
});

const freeze = fig("Stop on one foot and hold still. Arms out if you need the balance.", {
  kneeR: [142, 86],
  footR: [158, 112],
  elbowL: [78, 64],
  handL: [52, 70],
  elbowR: [146, 64],
  handR: [176, 70],
  accent: ["legR"],
});

const kneelHop = fig("Start on both knees. Hop to the side and land on the feet.", {
  head: [112, 48],
  shoulder: [112, 70],
  hip: [112, 108],
  kneeL: [86, 152],
  footL: [62, 148],
  kneeR: [142, 152],
  footR: [166, 148],
  elbowL: [90, 92],
  handL: [78, 112],
  elbowR: [138, 90],
  handR: [156, 108],
  accent: ["legL", "legR"],
  props: [{ kind: "arrow", x1: 160, y1: 120, x2: 210, y2: 120 }],
});

const halfKneelTurn = fig("Half kneel. Turn the ribs. Hips stay pointed forward.", {
  head: [112, 40],
  shoulder: [124, 62],
  hip: [100, 112],
  kneeL: [78, 156],
  footL: [52, 148],
  kneeR: [130, 136],
  footR: [168, 166],
  elbowL: [108, 78],
  handL: [116, 96],
  elbowR: [142, 74],
  handR: [150, 94],
  accent: ["armL", "armR"],
  props: [{ kind: "arc", cx: 136, cy: 70, r: 22 }],
});

const wallGetUp = fig("Back close to a wall. Post one hand and stand without crawling away.", {
  head: [96, 78],
  shoulder: [108, 96],
  hip: [130, 124],
  kneeL: [150, 146],
  footL: [176, 166],
  kneeR: [168, 130],
  footR: [196, 150],
  elbowL: [78, 118],
  handL: [58, 146],
  elbowR: [128, 108],
  handR: [146, 124],
  accent: ["armL"],
  props: [{ kind: "wall", x: 28, y: 40, h: 128 }],
});

const stepOff = fig("Shift your weight, step off the center line, and come back. Hands stay up.", {
  elbowL: [90, 46],
  handL: [84, 32],
  elbowR: [136, 46],
  handR: [150, 32],
  kneeL: [86, 132],
  footL: [64, 166],
  kneeR: [150, 128],
  footR: [188, 166],
  accent: ["legR"],
  props: [{ kind: "arrow", x1: 120, y1: 158, x2: 180, y2: 158 }],
});

const switchStance = fig("Change the feet in the middle of a short combo. Hands stay up.", {
  elbowL: [92, 44],
  handL: [86, 30],
  elbowR: [138, 46],
  handR: [152, 34],
  kneeL: [90, 130],
  footL: [74, 166],
  kneeR: [136, 128],
  footR: [164, 166],
  accent: ["legL", "legR"],
  props: [{ kind: "arrow", x1: 74, y1: 150, x2: 164, y2: 150 }],
});

const landmine = fig("Steer the free end of the bar from hip to hip. Feet stay planted.", {
  elbowL: [96, 90],
  handL: [88, 112],
  elbowR: [150, 78],
  handR: [176, 96],
  accent: ["armR"],
  props: [
    { kind: "box", x: 196, y: 150, w: 28, h: 18 },
    { kind: "arrow", x1: 200, y1: 150, x2: 168, y2: 96 },
  ],
});

const ribTurn = fig("Turn the ribs over a stable hip. The first reps stay slow.", {
  head: [112, 32],
  shoulder: [128, 52],
  hip: [108, 96],
  elbowL: [100, 70],
  handL: [92, 90],
  elbowR: [164, 64],
  handR: [186, 78],
  accent: ["armR"],
  props: [{ kind: "arc", cx: 140, cy: 64, r: 26 }],
});

const floorTwist = fig("On your back, knees bent, twist the knees side to side.", {
  head: [40, 78],
  shoulder: [72, 86],
  hip: [128, 100],
  kneeL: [156, 132],
  footL: [188, 148],
  kneeR: [176, 124],
  footR: [206, 138],
  elbowL: [58, 70],
  handL: [28, 62],
  elbowR: [96, 68],
  handR: [118, 54],
  accent: ["legL", "legR"],
});

const bearHug = fig("Hug a sandbag or a backpack at the chest and walk tall.", {
  elbowL: [86, 78],
  handL: [100, 100],
  elbowR: [150, 78],
  handR: [132, 100],
  accent: ["armL", "armR"],
  props: [{ kind: "box", x: 96, y: 72, w: 40, h: 36 }],
});

const bridge = fig("Bridge the hips and squeeze at the top.", {
  head: [48, 140],
  shoulder: [74, 146],
  hip: [128, 100],
  kneeL: [166, 122],
  footL: [188, 166],
  kneeR: [178, 128],
  footR: [206, 166],
  elbowL: [40, 150],
  handL: [22, 162],
  elbowR: [90, 140],
  handR: [108, 156],
  accent: ["legL", "legR"],
  props: [{ kind: "arrow", x1: 128, y1: 124, x2: 128, y2: 88 }],
});

const trapRaise = fig("Sit tall. Shrug up and slightly back, then lower under control.", {
  head: [120, 48],
  shoulder: [120, 70],
  hip: [120, 112],
  kneeL: [96, 140],
  footL: [88, 166],
  kneeR: [148, 140],
  footR: [164, 166],
  elbowL: [96, 100],
  handL: [88, 128],
  elbowR: [148, 100],
  handR: [160, 128],
  accent: ["armL", "armR"],
  props: [
    { kind: "box", x: 78, y: 118, w: 84, h: 18 },
    { kind: "arrow", x1: 88, y1: 118, x2: 88, y2: 92 },
    { kind: "arrow", x1: 160, y1: 118, x2: 160, y2: 92 },
  ],
});

const kneeDrop = fig("From a lunge, lower the back knee and turn the front hip open.", {
  head: [118, 36],
  shoulder: [118, 56],
  hip: [110, 104],
  kneeR: [156, 128],
  footR: [180, 166],
  kneeL: [70, 150],
  footL: [48, 140],
  elbowL: [96, 78],
  handL: [84, 98],
  elbowR: [142, 74],
  handR: [160, 90],
  accent: ["legL"],
});

const lungeSquat = say(
  { ...deepSquat, props: [{ kind: "arrow", x1: 48, y1: 140, x2: 120, y2: 120 }] },
  "From a long lunge, shift into a deep squat you can still breathe in.",
);

const BLOCKS: Record<string, FigureSpec> = {
  "hip-cars": hipCircles,
  "front-raise": frontRaise,
  "side-raise": sideRaise,
  "back-raise": backRaise,
  "knee-chest": kneeChest,
  "lunge-knee": lungeKnee,
  "chair-round": chairRound,
  "chair-side": chairSide,
  "pivot-shadow": pivotShadow,
  "wall-hang": wallHang,
  "foot-support": footSupport,
  "half-split": halfSplit,
  "frog-rocks": frog,
  "straddle-lean": straddle,
  "pails-rails": straddlePush,
  "ankle-cars": ankleCircles,
  "knee-wall": kneeWall,
  "deep-squat": deepSquat,
  "standing-scale": standingScale,
  "shoulder-cars": shoulderCircles,
  "tspine": tspine,
  "lounge-chair": loungeChair,
  hang,
  "neck-flex": neckFlex,
  "neck-ext": neckExt,
  "neck-left": neckLeft,
  "neck-right": neckRight,
  "sit-frog": sitThrough,
  "hip-switch": hip90,
  "lunge-pigeon": say(pigeon, "Half-kneeling lunge, then pigeon, then stand into a squat."),
  plow,
  couch,
  pigeon,
  butterfly,
  child,
  breath,
  "joint-circles": jointCircles,
  "front-swing": frontSwing,
  "side-swing": sideSwing,
  "hip-open": hipOpen,
};

const DRILLS: Record<string, FigureSpec> = {
  "knee-drop-lunge": kneeDrop,
  "shin-box": say(hip90, "Sit with both shins down and rotate the knees from side to side."),
  "seated-hip-open": say(butterfly, "Sit tall, one knee open, and rock the pelvis a little."),
  "lunge-squat-shift": say(lungeSquat, "From a long lunge, shift into a deep squat you can still breathe in."),
  "easy-hip-back": say(hip90, "Sit in a 90/90. Shrink any shape that pinches the low back."),
  "mark-high-kick": highKick,
  "kick-and-recover": kickRecover,
  "quiet-pogos": pogo,
  "lunge-high-knee": say(lungeKnee, "Step into a lunge and drive the back knee up to hip height."),
  "reactive-freeze": freeze,
  "kneeling-side-hop": kneelHop,
  "half-kneel-turn": halfKneelTurn,
  "wall-get-up": wallGetUp,
  "pendulum-step": stepOff,
  "hook-switch-cross": switchStance,
  "landmine-turn": landmine,
  "slow-rib-turns": ribTurn,
  "floor-twists": floorTwist,
  "hug-and-walk": bearHug,
  "glute-then-carry": say(bridge, "Bridge the hips, squeeze, then walk a light carry."),
  "seated-trap-raise": trapRaise,
};

export function figureForBlock(key: string): FigureSpec | null {
  return BLOCKS[key] ?? null;
}

export function figureForDrill(id: string): FigureSpec | null {
  return DRILLS[id] ?? null;
}

export function missingMobilityFigures() {
  const missing: string[] = [];
  for (const routine of MOBILITY_ROUTINES) {
    for (const block of routine.blocks) {
      const spec = figureForBlock(block.key);
      if (!spec || spec.caption.trim().length < 12) missing.push(`block:${routine.id}:${block.key}`);
    }
  }
  for (const drill of IG_DRILLS) {
    const spec = figureForDrill(drill.id);
    if (!spec || spec.caption.trim().length < 12) missing.push(`drill:${drill.id}`);
  }
  return missing;
}
