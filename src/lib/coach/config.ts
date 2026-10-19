/**
 * In-workout coach voice cues.
 *
 * When this is false the logger does not speak cues or prefetch / request TTS,
 * the logger header hides Coach on / Coach off, and Profile hides
 * "Coach motivation during workouts".
 *
 * Set this to true to restore those surfaces. The cue, toggle, and setting
 * code stays in place. Coach chat, Today's Summary "Read it to me", coach
 * voices and personalities, and rest-timer sounds do not read this flag.
 */
export const COACH_WORKOUT_MOTIVATION_ENABLED = false;
