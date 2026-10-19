function inRange(value: number | null | undefined): value is number {
  return typeof value === "number" && value >= 1 && value <= 5;
}

/** Subtitle names the rating. A bare number is the session score. */
export function sparringTileHint(
  rating:
    | number
    | null
    | undefined
    | { sessionRating?: number | null; bodyRating?: number | null },
) {
  if (typeof rating === "number" || rating == null) {
    return inRange(rating) ? `Session ${rating}/5` : "Log today's rounds";
  }
  const parts: string[] = [];
  if (inRange(rating.bodyRating)) parts.push(`Body ${rating.bodyRating}/5`);
  if (inRange(rating.sessionRating)) parts.push(`Session ${rating.sessionRating}/5`);
  return parts.length > 0 ? parts.join(" · ") : "Log today's rounds";
}
