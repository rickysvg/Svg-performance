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

export function waitForSplashCanPlay(video: {
  readyState: number;
  addEventListener: (type: string, fn: () => void) => void;
  removeEventListener: (type: string, fn: () => void) => void;
}) {
  if (video.readyState >= 2) return Promise.resolve();
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
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("canplay", onReady);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("canplay", onReady);
    video.addEventListener("error", onError);
  });
}

export function prepareSplashVideo(video: {
  muted: boolean;
  defaultMuted?: boolean;
  playsInline?: boolean;
  setAttribute?: (name: string, value: string) => void;
}) {
  video.muted = true;
  if ("defaultMuted" in video) video.defaultMuted = true;
  if ("playsInline" in video) video.playsInline = true;
  video.setAttribute?.("muted", "");
  video.setAttribute?.("playsinline", "");
  video.setAttribute?.("webkit-playsinline", "");
}

/**
 * Motion first: start muted so mobile browsers actually play.
 * Sound is optional and never blocks the streak animation.
 */
export async function startSplashPlayback(video: {
  muted: boolean;
  defaultMuted?: boolean;
  playsInline?: boolean;
  readyState: number;
  paused?: boolean;
  play: () => Promise<void>;
  setAttribute?: (name: string, value: string) => void;
  addEventListener: (type: string, fn: () => void) => void;
  removeEventListener: (type: string, fn: () => void) => void;
}) {
  prepareSplashVideo(video);
  try {
    await video.play();
    return "playing" as const;
  } catch {
    await waitForSplashCanPlay(video);
    prepareSplashVideo(video);
    await video.play();
    return "playing" as const;
  }
}
