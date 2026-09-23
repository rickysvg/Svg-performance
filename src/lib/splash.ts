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

export function isAutoplayBlocked(error: unknown) {
  if (!error || typeof error !== "object" || !("name" in error)) return false;
  return String(error.name) === "NotAllowedError";
}

export function waitForSplashCanPlay(video: {
  readyState: number;
  addEventListener: (type: string, fn: () => void) => void;
  removeEventListener: (type: string, fn: () => void) => void;
}) {
  if (video.readyState >= 3) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("splash video failed to load"));
    };
    const cleanup = () => {
      video.removeEventListener("canplay", onReady);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("canplay", onReady);
    video.addEventListener("error", onError);
  });
}

/**
 * The clip’s engine/whoosh is the punch at ring-close. Try unmuted autoplay
 * first; if the browser blocks it, play muted immediately — never wait for a tap.
 */
export async function playSplashWithSound(video: {
  muted: boolean;
  defaultMuted?: boolean;
  volume: number;
  play: () => Promise<void>;
}) {
  video.volume = 1;
  video.muted = false;
  if ("defaultMuted" in video) video.defaultMuted = false;
  try {
    await video.play();
    return "sound" as const;
  } catch {
    video.muted = true;
    if ("defaultMuted" in video) video.defaultMuted = true;
    await video.play();
    return "muted" as const;
  }
}
