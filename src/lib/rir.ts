/** Reps in reserve. Stored inside ProgramExercise.loadText so the seed can carry it. */

const RIR_PATTERN = /\b(\d+\s*-\s*\d+|\d+\+)\s*RIR\b/i;
const PERCENT_PATTERN = /~\d+%\s+of\s+a\s+\d+-rep max/i;

export const RIR_PLAIN =
  "RIR is reps in reserve: how many clean reps you could still do after the set. 0-2 RIR is near hard. A higher RIR means leave more in the tank. Power work stays fast, so it uses a higher RIR.";

export function effortLoadText(rir: string, note: string, percent?: string) {
  const band = `${rir.replace(/\s+/g, "")} RIR`;
  const parts = [band, percent, note].filter((part) => part && part.trim());
  return parts.join(" · ");
}

export function rirFromLoadText(loadText?: string | null): string | null {
  const match = loadText?.match(RIR_PATTERN);
  if (!match) return null;
  return `${match[1].replace(/\s+/g, "")} RIR`;
}

export function percentFromLoadText(loadText?: string | null): string | null {
  const match = loadText?.match(PERCENT_PATTERN);
  return match ? match[0] : null;
}

export function hasRirCue(loadText?: string | null) {
  return rirFromLoadText(loadText) != null;
}

/** Keep a stored RIR / percent cue when a scaler rewrites the coaching note. */
export function mergeLoadText(original: string, next?: string) {
  if (!next) return original;
  if (rirFromLoadText(next) || !rirFromLoadText(original)) return next;
  return [rirFromLoadText(original), percentFromLoadText(original), next].filter(Boolean).join(" · ");
}
