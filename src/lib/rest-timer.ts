import { clampSetRestSeconds, MAX_SET_REST_SECONDS } from "@/lib/set-rest";
import { vibratePattern } from "@/lib/media-output";

export type RestTimerState = {
  exerciseName: string;
  durationSeconds: number;
  endsAtMs: number;
};

export function startRestTimer(
  exerciseName: string,
  durationSeconds: number,
  nowMs = Date.now(),
): RestTimerState {
  const duration = clampSetRestSeconds(durationSeconds);
  return {
    exerciseName,
    durationSeconds: duration,
    endsAtMs: nowMs + duration * 1000,
  };
}

/** Wall clock for a rest display. Kept out of the component so render stays pure. */
export function readRestNow() {
  return Date.now();
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

/**
 * A swap renames the exercise under a running clock. Keep the countdown and
 * point it at the replacement. A remove of that exercise still clears it.
 */
export function restAfterExerciseChange(
  timer: RestTimerState | null,
  names: ReadonlySet<string>,
  focusName: string | undefined,
  nowMs = Date.now(),
): RestTimerState | null {
  if (!timer) return null;
  if (names.has(timer.exerciseName)) return timer;
  if (focusName && names.has(focusName) && isRestActive(timer, nowMs)) {
    return { ...timer, exerciseName: focusName };
  }
  return null;
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
  const durationSeconds = Math.max(0, Math.min(MAX_SET_REST_SECONDS, timer.durationSeconds + extra));
  const applied = durationSeconds - timer.durationSeconds;
  return {
    ...timer,
    durationSeconds,
    endsAtMs: timer.endsAtMs + applied * 1000,
  };
}

/** How long the "Go" banner stays up after rest ends. No sound plays. */
export const REST_GO_HOLD_MS = 3200;

/**
 * Vibration for the end of rest. Android Chrome honors navigator.vibrate.
 * iPhone Safari does not, so the banner is the cue there.
 */
export const REST_ALARM = {
  vibrate: [220, 90, 220, 90, 380],
} as const;

/** Short pulse as the clock enters 3, then 2, then 1. */
export const REST_WARNING_VIBRATE = [80] as const;

export function clockNow() {
  return Date.now();
}

export type RestCue = "warning" | "complete";

/**
 * One warning as the clock enters 3, then 2, then 1. Zero is the end cue.
 * A jump that skips the last seconds still ends once, and does not stack pulses.
 */
export function restCueForTick(previous: number | null, next: number): RestCue | null {
  if (previous != null && previous <= 0 && next <= 0) return null;
  if (next <= 0 && (previous == null || previous > 0)) return "complete";
  if (next >= 1 && next <= 3 && (previous == null || previous > next)) return "warning";
  return null;
}

export function signalRestWarning() {
  if (typeof window === "undefined") return;
  vibratePattern([...REST_WARNING_VIBRATE]);
}

export function signalRestComplete() {
  if (typeof window === "undefined") return;
  vibratePattern([...REST_ALARM.vibrate]);
}
