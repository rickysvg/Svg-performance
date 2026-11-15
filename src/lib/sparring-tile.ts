/** Subtitle for the Sparring Log tile. A saved rating wins; otherwise invite today's log. */
export function sparringTileHint(
  sessionRating: number | null | undefined,
  locked = false,
) {
  if (locked) return "Locked";
  if (typeof sessionRating === "number" && sessionRating >= 1 && sessionRating <= 5) {
    return `Last session ${sessionRating}/5`;
  }
  return "Log today's rounds";
}
