/** Rest between sets. Zero stays zero (a continuous block). Anything longer clamps. */
export const DEFAULT_SET_REST_SECONDS = 45;
export const MAX_SET_REST_SECONDS = 90;

export function clampSetRestSeconds(seconds: number) {
  if (!Number.isFinite(seconds)) return DEFAULT_SET_REST_SECONDS;
  const rounded = Math.round(seconds);
  if (rounded <= 0) return 0;
  return Math.min(MAX_SET_REST_SECONDS, rounded);
}

/**
 * Catalog rows used to seed heavy work at 90s. That default is 45s.
 * A rest written longer than the cap still clamps to 90s.
 */
export function catalogRestSeconds(seconds: number) {
  if (!Number.isFinite(seconds)) return DEFAULT_SET_REST_SECONDS;
  const rounded = Math.round(seconds);
  if (rounded === MAX_SET_REST_SECONDS) return DEFAULT_SET_REST_SECONDS;
  return clampSetRestSeconds(rounded);
}
