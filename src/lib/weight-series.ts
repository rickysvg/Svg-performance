export type WeightSeriesPoint = {
  id: string;
  label: string;
  value: number;
  unit: string;
  recordedAt: string;
};

export type WeightRange = "7" | "30" | "90" | "all";

/** Keeps weigh-ins inside the window. All-time returns every point. */
export function filterWeightRange(points: WeightSeriesPoint[], range: WeightRange, now: Date) {
  if (range === "all") return points;
  const days = range === "7" ? 7 : range === "30" ? 30 : 90;
  const cutoff = now.getTime() - days * 86_400_000;
  return points.filter((point) => new Date(point.recordedAt).getTime() >= cutoff);
}
