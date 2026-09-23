export const SPLASH_STORAGE_KEY = "svg_splash_seen";

export function splashTimings(reducedMotion: boolean) {
  if (reducedMotion) {
    return { holdMs: 350, exitMs: 220 };
  }
  return { holdMs: 1700, exitMs: 480 };
}

export function shouldSkipSplash(stored: string | null) {
  return stored === "1";
}
