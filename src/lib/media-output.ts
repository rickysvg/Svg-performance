/**
 * Haptics only.
 *
 * This module used to open a Web Audio context, play cue files, and hold a
 * silent loop so iOS would route timer sounds to Bluetooth. That playback
 * session pauses Apple Music and Spotify. Nothing here may open a web audio
 * context, an audio element, or the browser audio-session API.
 *
 * iOS Safari does not implement navigator.vibrate. The checkbox-switch haptic
 * only fires while a finger is on the control, so a rest clock that ends by
 * itself cannot buzz an iPhone. Callers pair this with a visual cue.
 */
export function vibratePattern(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  } catch {
    /* iOS Safari does not implement the Vibration API */
  }
}
