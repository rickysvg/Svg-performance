import type { ProgressPoint } from "@/lib/progress";
import { civilDayInstant } from "@/lib/performed-at";
import { APP_TIMEZONE } from "@/lib/timezone";

export function ProgressBars({
  points,
  timeZone,
}: {
  points: ProgressPoint[];
  timeZone?: string;
}) {
  const max = Math.max(...points.map((point) => point.volume), 1);
  return (
    <ol className="mt-4 space-y-3">
      {points.map((point, index) => {
        const dropped = index > 0 && point.volume < points[index - 1]!.volume;
        const width = Math.max(6, Math.round((point.volume / max) * 100));
        const zone = timeZone || APP_TIMEZONE;
        const date = civilDayInstant(new Date(point.performedAt), zone).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          timeZone: zone,
        });
        return (
          <li key={point.id}>
            <div className="mb-1 flex justify-between gap-3 text-xs text-muted">
              <span className="truncate">{date} · {point.label}</span>
              <span className={dropped ? "text-signal" : undefined}>{point.volume}</span>
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
