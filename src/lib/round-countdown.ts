export const COUNTDOWN_MS = 3000;

export type CountdownDigit = 3 | 2 | 1;

/** Digit showing for a countdown that started at t=0. Null means GO. */
export function countdownDigitAt(elapsedMs: number): CountdownDigit | null {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return null;
  const index = Math.floor(elapsedMs / 1000);
  if (index <= 0) return 3;
  if (index === 1) return 2;
  if (index === 2) return 1;
  return null;
}

/** A new digit is a count tick. Leaving 1 is GO. Neither plays audio. */
export function countdownCue(
  previous: CountdownDigit | null,
  next: CountdownDigit | null,
): "beep" | "go" | null {
  if (next != null && next !== previous) return "beep";
  if (previous === 1 && next == null) return "go";
  return null;
}

/**
 * Count ticks and GO never play a beep or bell. Vibration follows Vibrate.
 * `beep` and `bell` stay in the result so older callers cannot turn sound back on.
 */
export function countdownSound(
  cue: "beep" | "go",
  prefs: { vibrate: boolean },
) {
  return {
    beep: false,
    bell: false,
    vibrate: prefs.vibrate,
    pattern: cue === "go" ? 160 : 45,
  };
}
