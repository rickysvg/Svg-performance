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

/** A new digit beeps. Leaving 1 is GO. */
export function countdownCue(
  previous: CountdownDigit | null,
  next: CountdownDigit | null,
): "beep" | "go" | null {
  if (next != null && next !== previous) return "beep";
  if (previous === 1 && next == null) return "go";
  return null;
}

/** Count beeps and the GO bell follow Bell. Vibration on GO follows Vibrate. */
export function countdownSound(
  cue: "beep" | "go",
  prefs: { bell: boolean; vibrate: boolean },
) {
  return {
    beep: cue === "beep" && prefs.bell,
    bell: cue === "go" && prefs.bell,
    vibrate: cue === "go" && prefs.vibrate,
  };
}
