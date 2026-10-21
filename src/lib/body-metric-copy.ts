/** Short confirmation after a typed body metric. No wearable disclaimer. */
export function bodyMetricSaveMessage(kind: string, bodyFatPercent: number | null) {
  if (kind === "weight" && bodyFatPercent != null) return "Weight & body fat saved.";
  return "Saved.";
}
