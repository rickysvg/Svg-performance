export const SPLASH_STORAGE_KEY = "svg_splash_seen";
export const SPLASH_VIDEO_SRC = "/svg-performance-splash.mp4";
export const SPLASH_STILL_SRC = "/svg-performance-splash-still.webp";
/** Trimmed to the frame the neon streak closes the ring (~8.15s). */
export const SPLASH_VIDEO_MS = 8_150;

export function splashTimings(reducedMotion: boolean) {
  if (reducedMotion) {
    return { holdMs: 400, exitMs: 220 };
  }
  return { holdMs: SPLASH_VIDEO_MS, exitMs: 280 };
}

export function shouldSkipSplash(stored: string | null) {
  return stored === "1";
}

export function canDismissSplash(input: {
  videoFinished: boolean;
  appReady: boolean;
  reducedMotion: boolean;
}) {
  if (input.reducedMotion) {
    return input.appReady;
  }
  return input.videoFinished && input.appReady;
}

export async function playSplashWithSound(video: {
  muted: boolean;
  play: () => Promise<void>;
}) {
  video.muted = false;
  try {
    await video.play();
    return "sound" as const;
  } catch {
    video.muted = true;
    await video.play();
    return "muted" as const;
  }
}
