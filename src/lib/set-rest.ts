/** Rest between sets. Zero stays zero (a continuous block). Anything longer clamps. */
export const DEFAULT_SET_REST_SECONDS = 45;
export const MAX_SET_REST_SECONDS = 90;

export function clampSetRestSeconds(seconds: number) {
  if (!Number.isFinite(seconds)) return DEFAULT_SET_REST_SECONDS;
  const rounded = Math.round(seconds);
  if (rounded <= 0) return 0;
  return Math.min(MAX_SET_REST_SECONDS, rounded);
}
