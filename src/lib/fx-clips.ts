export type FxClipName = "star_flash" | "ember_burst" | "ring_comet" | "ember_drift";

export type FxClip = {
  name: FxClipName;
  sheet: string;
  animated: string;
  frameSize: number;
  frames: number;
  columns: number;
  rows: number;
  fps: number;
  durationMs: number;
  loop: boolean;
};

export const FX_CLIPS: Record<FxClipName, FxClip> = {
  star_flash: {
    name: "star_flash",
    sheet: "/fx/star_flash_sheet.webp",
    animated: "/fx/star_flash.webp",
    frameSize: 512,
    frames: 24,
    columns: 6,
    rows: 4,
    fps: 30,
    durationMs: 800,
    loop: false,
  },
  ember_burst: {
    name: "ember_burst",
    sheet: "/fx/ember_burst_sheet.webp",
    animated: "/fx/ember_burst.webp",
    frameSize: 512,
    frames: 36,
    columns: 6,
    rows: 6,
    fps: 30,
    durationMs: 1200,
    loop: false,
  },
  ring_comet: {
    name: "ring_comet",
    sheet: "/fx/ring_comet_sheet.webp",
    animated: "/fx/ring_comet.webp",
    frameSize: 512,
    frames: 36,
    columns: 6,
    rows: 6,
    fps: 30,
    durationMs: 1200,
    loop: false,
  },
  ember_drift: {
    name: "ember_drift",
    sheet: "/fx/ember_drift_sheet.webp",
    animated: "/fx/ember_drift.webp",
    frameSize: 512,
    frames: 72,
    columns: 9,
    rows: 8,
    fps: 30,
    durationMs: 2400,
    loop: true,
  },
};

export const FX_MAX_PX = 900;

export function fxSheetSrcs() {
  return Object.values(FX_CLIPS).map((clip) => clip.sheet);
}

export function frameIndexAt(clip: FxClip, elapsedMs: number) {
  const frame = Math.floor((elapsedMs / 1000) * clip.fps);
  if (clip.loop) {
    return ((frame % clip.frames) + clip.frames) % clip.frames;
  }
  return Math.min(clip.frames - 1, Math.max(0, frame));
}

export function fxStillPlaying(clip: FxClip, elapsedMs: number) {
  if (clip.loop) return true;
  return elapsedMs < clip.durationMs;
}
