export function ZoneChart({
  zone1,
  zone2,
  zone3,
  zone4,
  zone5,
}: {
  zone1: number;
  zone2: number;
  zone3: number;
  zone4: number;
  zone5: number;
}) {
  const rows = [
    { label: "Zone 1", value: zone1 },
    { label: "Zone 2", value: zone2 },
    { label: "Zone 3", value: zone3 },
    { label: "Zone 4", value: zone4 },
    { label: "Zone 5", value: zone5 },
  ];
  return (
    <ol className="mt-3 space-y-2">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span>{row.label}</span>
            <span>{row.value}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.max(row.value > 0 ? 6 : 0, row.value)}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
