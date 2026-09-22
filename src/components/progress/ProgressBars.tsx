import type { ProgressPoint } from "@/lib/progress";

export function ProgressBars({ points }: { points: ProgressPoint[] }) {
  const max = Math.max(...points.map((point) => point.volume), 1);
  return (
    <ol className="mt-4 space-y-3">
      {points.map((point) => {
        const width = Math.max(6, Math.round((point.volume / max) * 100));
        const date = new Date(point.performedAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        });
        return (
          <li key={point.id}>
            <div className="mb-1 flex justify-between gap-3 text-xs text-muted">
              <span className="truncate">{date} · {point.label}</span>
              <span>{point.volume}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${width}%` }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
