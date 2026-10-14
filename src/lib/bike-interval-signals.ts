import { soundFxEnabled } from "@/lib/badge-sfx";
import type { BikeIntervalCue } from "@/lib/bike-interval-timer";
import { playEndCue, playPhaseCue, playWarningCue, vibratePattern } from "@/lib/media-output";

type WakeLockLike = { release: () => Promise<void> | void };

export function signalBikeIntervalCue(cue: BikeIntervalCue) {
  if (cue === "none" || typeof window === "undefined") return;
  if (cue === "work-warning") vibratePattern(40);
  else if (cue === "complete") vibratePattern([120, 50, 160]);
  else vibratePattern(80);
  if (!soundFxEnabled()) return;
  if (cue === "work-warning") playWarningCue();
  else if (cue === "complete") playEndCue();
  else playPhaseCue();
}

export async function requestSetWakeLock(): Promise<WakeLockLike | null> {
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockLike> };
    };
    if (!nav.wakeLock?.request) return null;
    return await nav.wakeLock.request("screen");
  } catch {
    return null;
  }
}

export function releaseSetWakeLock(lock: WakeLockLike | null) {
  if (!lock) return;
  try {
    void lock.release();
  } catch {
    /* wake lock is best-effort */
  }
}
