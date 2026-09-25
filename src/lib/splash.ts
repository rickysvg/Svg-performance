export const SPLASH_STORAGE_KEY = "svg_splash_seen";
export const SPLASH_MP4_SRC = "/svg-performance-splash.mp4";
export const SPLASH_WEBM_SRC = "/svg-performance-splash.webm";
/** MP4 fallback path — Safari / iOS cannot play the AV1 WebM. */
export const SPLASH_VIDEO_SRC = SPLASH_MP4_SRC;
export const SPLASH_STILL_SRC = "/svg-performance-splash-still.webp";
export const SPLASH_WEBM_TYPE = "video/webm; codecs=av01.0.08M.08";
export const SPLASH_MP4_TYPE = "video/mp4";
/** Same 92-frame ring-close as the live clip, kept inside the 3–4s cap. */
export const SPLASH_VIDEO_MS = 3_800;
/** If playback has not started by then, show the still and keep the original hold. */
export const SPLASH_PLAY_GRACE_MS = 800;

export function splashTimings(reducedMotion: boolean) {
  if (reducedMotion) {
    return { holdMs: 400, exitMs: 220 };
  }
  return { holdMs: SPLASH_VIDEO_MS, exitMs: 280 };
}

export function shouldSkipSplash(stored: string | null) {
  return stored === "1";
}

/** Marketing `/` only. Login and member routes never play the clip. */
export function isSplashPath(pathname: string | null | undefined) {
  return pathname === "/";
}

export function shouldShowSplashOverlay(input: {
  stored: string | null;
  pathname: string | null | undefined;
}) {
  return isSplashPath(input.pathname) && !shouldSkipSplash(input.stored);
}

/** Never mount <video> after the session flag, on inner pages, or for reduced motion. */
export function shouldMountSplashVideo(input: {
  stored: string | null;
  pathname: string | null | undefined;
  reducedMotion: boolean;
}) {
  return shouldShowSplashOverlay(input) && !input.reducedMotion;
}

export function canDismissSplash(input: {
  videoFinished: boolean;
  appReady: boolean;
  reducedMotion: boolean;
  userSkipped?: boolean;
}) {
  if (input.userSkipped) return true;
  if (input.reducedMotion) {
    return input.appReady;
  }
  return input.videoFinished && input.appReady;
}

export function pickSplashVideoSource(canPlayType: (type: string) => string) {
  if (canPlayType(SPLASH_WEBM_TYPE)) {
    return { src: SPLASH_WEBM_SRC, type: SPLASH_WEBM_TYPE };
  }
  return { src: SPLASH_MP4_SRC, type: SPLASH_MP4_TYPE };
}

/** Safari/iOS reports empty for AV1 WebM — pin the MP4 so it never tries the first source. */
export function applySplashVideoSources(video: {
  canPlayType: (type: string) => string;
  src?: string;
}) {
  const chosen = pickSplashVideoSource((type) => video.canPlayType(type));
  if (chosen.src === SPLASH_MP4_SRC) {
    video.src = chosen.src;
  }
  return chosen;
}

export function shouldFallbackSplashStill(input: {
  playing: boolean;
  elapsedMs: number;
  graceMs?: number;
}) {
  return !input.playing && input.elapsedMs >= (input.graceMs ?? SPLASH_PLAY_GRACE_MS);
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
 * If the file is still not playable after the grace window, return stalled
 * so the still can take over on the original ~3.8s schedule.
 */
export async function startSplashPlayback(
  video: {
    muted: boolean;
    defaultMuted?: boolean;
    playsInline?: boolean;
    readyState: number;
    paused?: boolean;
    play: () => Promise<void>;
    setAttribute?: (name: string, value: string) => void;
    addEventListener: (type: string, fn: () => void) => void;
    removeEventListener: (type: string, fn: () => void) => void;
  },
  graceMs = SPLASH_PLAY_GRACE_MS,
) {
  prepareSplashVideo(video);
  try {
    await video.play();
    return "playing" as const;
  } catch {
    const ready = waitForSplashCanPlay(video);
    const grace = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("splash play grace")), graceMs);
    });
    try {
      await Promise.race([ready, grace]);
      prepareSplashVideo(video);
      await video.play();
      return "playing" as const;
    } catch {
      return "stalled" as const;
    }
  }
}
