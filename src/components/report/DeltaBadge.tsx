import { periodDelta, type MetricCard, type PeriodDelta } from "@/lib/report-history";

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
  const arrow = up ? "▲" : "▼";
  const text =
    resolvedMode === "percent" && delta.percent != null ? `${arrow}${delta.percent}%` : `${arrow}${delta.absolute}`;
  const words = up ? "Up" : "Down";
  const detail =
    resolvedMode === "percent" && delta.percent != null
      ? `${words} ${delta.percent} percent`
      : delta.percent == null
        ? `${words} ${delta.absolute}. No earlier total for a percent`
        : `${words} ${delta.absolute}`;
  return (
    <span className="font-telemetry text-sm leading-none" style={{ color }} aria-label={detail}>
      {text}
    </span>
  );
}
