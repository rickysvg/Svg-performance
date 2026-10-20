export type WeightSeriesPoint = {
  id: string;
  label: string;
  value: number;
  unit: string;
  recordedAt: string;
};

export type WeightRange = "7" | "30" | "90" | "all";

/** Oldest first. Weigh-ins on or after `now` minus `days`. */
export function weightValuesSince(
  points: Array<{ value: number; recordedAt: Date }>,
  now: Date,
  days = 7,
) {
  const cutoff = now.getTime() - days * 86_400_000;
  return [...points]
    .filter((point) => point.recordedAt.getTime() >= cutoff)
    .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime())
    .map((point) => point.value);
}

/** Keeps weigh-ins inside the window. All-time returns every point. */
export function filterWeightRange(points: WeightSeriesPoint[], range: WeightRange, now: Date) {
  if (range === "all") return points;
  const days = range === "7" ? 7 : range === "30" ? 30 : 90;
  const cutoff = now.getTime() - days * 86_400_000;
  return points.filter((point) => new Date(point.recordedAt).getTime() >= cutoff);
}
