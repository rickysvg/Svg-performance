import { TelemetryChart } from "@/components/design/TelemetryChart";

export function BodyWeightChart({
  points,
  unit,
}: {
  points: Array<{ id: string; label: string; value: number }>;
  unit: string;
}) {
  return (
    <div data-weight-chart>
      <TelemetryChart
        title="Body weight"
        description="Scale numbers you typed"
        unit={unit}
        empty="No weigh-ins yet. Log a number below and the line will draw."
        series={[
          {
            id: "weight",
            label: "Body weight",
            color: "#CBF805",
            points: points.map((point) => ({
              label: point.label,
              detail: point.label,
              value: point.value,
            })),
          },
        ]}
      />
    </div>
  );
}
