import type { BikeIntervalCue } from "@/lib/bike-interval-timer";

type WakeLockLike = { release: () => Promise<void> | void };

export function signalBikeIntervalCue(cue: BikeIntervalCue) {
  if (cue === "none" || typeof window === "undefined") return;
  try {
    navigator.vibrate?.(cue === "complete" ? 180 : cue === "work-warning" ? 80 : 120);
  } catch {
    /* vibration is optional */
  }
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = cue === "work-warning" ? 720 : cue === "complete" ? 990 : 880;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (cue === "work-warning" ? 0.08 : 0.12));
    osc.onended = () => {
      void ctx.close();
    };
  } catch {
    /* beep is optional on web */
  }
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
