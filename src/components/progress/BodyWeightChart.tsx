"use client";

import { useState } from "react";
import { TelemetryChart } from "@/components/design/TelemetryChart";
import { filterWeightRange, type WeightRange, type WeightSeriesPoint } from "@/lib/weight-series";

const RANGES: Array<{ id: WeightRange; label: string }> = [
  { id: "7", label: "7D" },
  { id: "30", label: "30D" },
  { id: "90", label: "90D" },
  { id: "all", label: "All" },
];

export function BodyWeightChart({
  points,
  unit,
  now,
}: {
  points: WeightSeriesPoint[];
  unit: string;
  now: string;
}) {
  const [range, setRange] = useState<WeightRange>("30");
  const shown = filterWeightRange(points, range, new Date(now));
  return (
    <div data-weight-chart>
      <div className="mb-3 flex gap-1.5" role="group" aria-label="Body weight range">
        {RANGES.map((item) => {
          const active = item.id === range;
          return (
            <button
              data-testid={`progress-weight-chart-${item.id}`}
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => setRange(item.id)}
              className={`min-h-8 rounded-full border px-2.5 font-telemetry text-[10px] uppercase tracking-[0.14em] ${
                active ? "border-accent bg-accent text-black" : "border-line text-muted"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <TelemetryChart
        title="Body weight"
        description="Each saved weigh-in, oldest first"
        unit={unit}
        empty="No weigh-ins in this range. Log a number and the line will draw."
        series={[
          {
            id: "weight",
            label: "Body weight",
            color: "#CBF805",
            points: shown.map((point, index) => ({
              label: point.label,
              detail: point.label,
              value: point.value,
              mark: index > 0 && point.value < shown[index - 1]!.value ? "down" : undefined,
            })),
          },
        ]}
      />
    </div>
  );
}
