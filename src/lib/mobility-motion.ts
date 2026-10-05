/**
 * Short stick-figure loops for stretches whose still position does not show the path.
 * Holds stay as the existing position figure. This is not a video catalog.
 */
import type { FigureSpec, XY } from "@/lib/mobility-poses";

export const MOTION_MIN_SECONDS = 3;
export const MOTION_MAX_SECONDS = 8;

const JOINTS = [
  "head",
  "shoulder",
  "hip",
  "elbowL",
  "handL",
  "elbowR",
  "handR",
  "kneeL",
  "footL",
  "kneeR",
  "footR",
] as const;

type JointName = (typeof JOINTS)[number];
export type MotionFrame = Partial<Record<JointName, XY>>;

export type MotionClip = {
  blockKey: string;
  /** Full out-and-back loop length. */
  seconds: number;
  frames: MotionFrame[];
};

const CLIPS: MotionClip[] = [
  {
    blockKey: "hip-cars",
    seconds: 5,
    frames: [
      { kneeR: [148, 64], footR: [156, 36] },
      { kneeR: [128, 128], footR: [140, 166] },
      { kneeR: [168, 128], footR: [198, 150] },
    ],
  },
  {
    blockKey: "front-swing",
    seconds: 5,
    frames: [{ kneeR: [118, 124], footR: [168, 148] }],
  },
  {
    blockKey: "side-swing",
    seconds: 5,
    frames: [{ kneeR: [48, 112], footR: [22, 128] }],
  },
  {
    blockKey: "chair-round",
    seconds: 6,
    frames: [{ kneeR: [128, 72], footR: [116, 98] }],
  },
  {
    blockKey: "chair-side",
    seconds: 6,
    frames: [{ kneeR: [128, 78], footR: [112, 102] }],
  },
  {
    blockKey: "ankle-cars",
    seconds: 5,
    frames: [
      { footR: [200, 118] },
      { footR: [172, 110] },
      { footR: [164, 142] },
    ],
  },
  {
    blockKey: "frog-rocks",
    seconds: 4,
    frames: [
      { head: [120, 52], shoulder: [120, 74], hip: [120, 98] },
    ],
  },
  {
    blockKey: "shoulder-cars",
    seconds: 5,
    frames: [
      { elbowR: [170, 78], handR: [198, 96] },
      { elbowR: [136, 112], handR: [148, 142] },
      { elbowR: [78, 72], handR: [58, 48] },
    ],
  },
];

const BY_KEY = new Map(CLIPS.map((clip) => [clip.blockKey, clip]));

export function motionClips() {
  return CLIPS;
}

export function motionForBlock(blockKey: string) {
  return BY_KEY.get(blockKey) ?? null;
}

function applyFrame(start: FigureSpec, frame: MotionFrame | undefined): FigureSpec {
  if (!frame) return start;
  const next: FigureSpec = { ...start };
  for (const joint of JOINTS) {
    const point = frame[joint];
    if (point) next[joint] = point;
  }
  return next;
}

function lerpPoint(a: XY, b: XY, t: number): XY {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function lerpSpec(from: FigureSpec, to: FigureSpec, t: number): FigureSpec {
  const next: FigureSpec = { ...from };
  for (const joint of JOINTS) {
    next[joint] = lerpPoint(from[joint], to[joint], t);
  }
  return next;
}

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

/** progress is 0–1 across one loop, including the return to the still. */
export function poseAt(clip: MotionClip, start: FigureSpec, progress: number): FigureSpec {
  const wrapped = ((progress % 1) + 1) % 1;
  const segments = clip.frames.length + 1;
  const scaled = wrapped * segments;
  const index = Math.min(segments - 1, Math.floor(scaled));
  const local = smooth(scaled - index);
  const from = applyFrame(start, index === 0 ? undefined : clip.frames[index - 1]);
  const to = applyFrame(start, index === clip.frames.length ? undefined : clip.frames[index]);
  return lerpSpec(from, to, local);
}
