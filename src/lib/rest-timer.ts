import { soundFxEnabled } from "@/lib/badge-sfx";
import { playEndCue, playWarningCue, vibratePattern } from "@/lib/media-output";

export type RestTimerState = {
  exerciseName: string;
  durationSeconds: number;
  endsAtMs: number;
};

export function clockNow() {
  return Date.now();
}

export function startRestTimer(
  exerciseName: string,
  durationSeconds: number,
  nowMs = Date.now(),
): RestTimerState {
  const duration = Math.max(0, Math.round(durationSeconds));
  return {
    exerciseName,
    durationSeconds: duration,
    endsAtMs: nowMs + duration * 1000,
  };
}

export function remainingRestSeconds(
  timer: RestTimerState | null,
  nowMs = Date.now(),
): number {
  if (!timer) return 0;
  return Math.max(0, Math.ceil((timer.endsAtMs - nowMs) / 1000));
}

export function isRestActive(timer: RestTimerState | null, nowMs = Date.now()): boolean {
  return remainingRestSeconds(timer, nowMs) > 0;
}

export function formatRestClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatRestPill(seconds: number): string {
  return `${Math.max(0, Math.round(seconds))}s`;
}

export function addRestSeconds(timer: RestTimerState, seconds: number): RestTimerState {
  const extra = Math.round(seconds);
  return {
    ...timer,
    durationSeconds: Math.max(0, timer.durationSeconds + extra),
    endsAtMs: timer.endsAtMs + extra * 1000,
  };
}

export type RestCue = "warning" | "complete";

/**
 * One warning as the clock enters 3, then 2, then 1. Zero is the end cue.
 * A jump that skips the last seconds still ends once, and does not stack beeps.
 */
export function restCueForTick(previous: number | null, next: number): RestCue | null {
  if (previous != null && previous <= 0 && next <= 0) return null;
  if (next <= 0 && (previous == null || previous > 0)) return "complete";
  if (next >= 1 && next <= 3 && (previous == null || previous > next)) return "warning";
  return null;
}

export function signalRestWarning() {
  if (typeof window === "undefined") return;
  if (!soundFxEnabled()) return;
  playWarningCue();
}

export function signalRestComplete() {
  if (typeof window === "undefined") return;
  vibratePattern([180, 70, 220, 70, 180]);
  if (!soundFxEnabled()) return;
  playEndCue();
}
