import { formatDeltaBadge, periodDelta, type MetricCard, type PeriodDelta } from "@/lib/report-history";

export function DeltaBadge({
  card,
  delta: given,
  mode,
}: {
  card?: MetricCard;
  delta?: PeriodDelta | null;
  mode?: "count" | "percent";
}) {
  if (card?.comparable === false) return null;
  const delta = given ?? (card ? periodDelta(card.current, card.baseline, card.places ?? 0) : null);
  const resolvedMode = mode ?? card?.mode ?? "count";
  if (!delta) return null;
  if (delta.direction === "flat") {
    return <span className="font-telemetry text-xs uppercase tracking-wide text-muted">Same</span>;
  }
  const up = delta.direction === "up";
  const color = up ? "#CBF805" : "#FF3B3B";
  const badge = formatDeltaBadge(delta, resolvedMode, card?.deltaFormat ?? "count");
  return (
    <span className="font-telemetry text-sm leading-none" style={{ color }} aria-label={badge.label}>
      {badge.text}
    </span>
  );
}
