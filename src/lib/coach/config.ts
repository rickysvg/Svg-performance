/**
 * In-workout coach voice cues.
 *
 * When this is false the logger does not speak cues or prefetch / request TTS,
 * the logger header hides Coach on / Coach off, and Profile hides
 * "Coach motivation during workouts".
 *
 * Set this to true to restore those surfaces. The cue, toggle, and setting
 * code stays in place. Rest-timer sounds do not read this flag.
 * Coach chat speech, summary playback, and voice samples use
 * coachVoiceEnabled() instead.
 */
export const COACH_WORKOUT_MOTIVATION_ENABLED = false;

/**
 * Coach speech, read-aloud, and voice samples.
 *
 * Off unless NEXT_PUBLIC_COACH_VOICE is "1" or "true" at build time.
 * Next inlines that name, so the browser and server see the same value.
 * Text chat and the written Today's Summary stay either way.
 * The play button, read-aloud control, and sample picker stay in the tree
 * and render only when this is on. They do not call TTS while it is off.
 */
export function coachVoiceEnabled() {
  const value = process.env.NEXT_PUBLIC_COACH_VOICE?.trim().toLowerCase();
  return value === "1" || value === "true";
}
