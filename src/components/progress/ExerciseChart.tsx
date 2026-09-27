import Link from "next/link";
import type { ChartPoint, ChartRange } from "@/lib/exercise-charts";
import { UpgradePreview } from "@/components/upgrade/UpgradePreview";

const RANGES: Array<{ id: ChartRange; label: string; paid?: boolean }> = [
  { id: "4w", label: "4W" },
  { id: "12w", label: "12W" },
  { id: "1y", label: "1Y", paid: true },
  { id: "all", label: "All", paid: true },
];

export function ExerciseChart({
  exerciseName,
  unit,
  points,
  range,
  slug,
  locked,
  canStartTrial,
  trialDays,
}: {
  exerciseName: string;
  unit: string;
  points: ChartPoint[];
  range: ChartRange;
  slug: string;
  locked: boolean;
  canStartTrial: boolean;
  trialDays: number;
}) {
  const width = 320;
  const height = 160;
  const pad = 18;
  const values = points.map((point) => point.value);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const span = Math.max(1, max - min);
  const coords = points.map((point, index) => {
    const x =
      points.length === 1
        ? width / 2
        : pad + ((width - pad * 2) * index) / (points.length - 1);
    const y = height - pad - ((point.value - min) / span) * (height - pad * 2);
    return { ...point, x, y };
  });
  const path = coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  const fill = coords.length
    ? `${path} L${coords[coords.length - 1]!.x},${height - pad} L${coords[0]!.x},${height - pad} Z`
    : "";

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg">{exerciseName}</h2>
          <p className="mt-1 text-sm text-muted">Best set per week ({unit})</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {RANGES.map((item) => {
          const href = `/progress/records/${slug}?range=${item.id}`;
          const active = range === item.id && !locked;
          return (
            <Link
              key={item.id}
              href={href}
              className={`touch-target inline-flex items-center rounded-full border px-3 text-sm ${
                active ? "border-black bg-accent text-black" : "border-line bg-white"
              }`}
            >
              {item.label}
              {item.paid ? <span className="ml-1 text-[10px] uppercase">Pro</span> : null}
            </Link>
          );
        })}
      </div>
      {locked ? (
        <UpgradePreview
          kind="history"
          canStartTrial={canStartTrial}
          trialDays={trialDays}
          next={`/progress/records/${slug}`}
        />
      ) : points.length === 0 ? (
        <p className="text-sm text-muted">No loaded sets in this window yet.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-[#f4ffe0]">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full" role="img" aria-label={`${exerciseName} best set chart`}>
            <path d={fill} fill="#e6f7a3" />
            <path d={path} fill="none" stroke="#0a0a0a" strokeWidth="2" />
            {coords.map((point, index) => {
              const last = index === coords.length - 1;
              return (
                <circle
                  key={point.weekKey}
                  cx={point.x}
                  cy={point.y}
                  r={last ? 7 : 3.5}
                  fill={last ? "#CBF805" : "#0a0a0a"}
                  stroke="#0a0a0a"
                  strokeWidth={last ? 2 : 0}
                />
              );
            })}
          </svg>
          <div className="flex justify-between px-3 pb-3 text-[11px] text-muted">
            {coords.filter((_, index) => index === 0 || index === coords.length - 1 || index % 3 === 0).map((point) => (
              <span key={point.weekKey}>{point.label}</span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
