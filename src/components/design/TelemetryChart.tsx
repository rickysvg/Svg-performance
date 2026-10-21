export type TelemetryPoint = {
  label: string;
  /** Full name for the screen-reader table. */
  detail?: string;
  value: number | null;
  /** A drop from the previous point. Drawn as a small red marker. */
  mark?: "down";
};

export type TelemetrySeries = {
  id: string;
  label: string;
  color: string;
  points: TelemetryPoint[];
};

function domain(
  series: TelemetrySeries[],
  variant: "line" | "bar",
  yDomain?: { min: number; max: number },
) {
  const values = series.flatMap((item) =>
    item.points.map((point) => point.value).filter((value): value is number => value != null),
  );
  if (yDomain) return yDomain;
  if (values.length === 0) return { min: 0, max: 1 };
  if (variant === "bar") {
    return { min: 0, max: Math.max(...values, 1) };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return { min: min - 1, max: max + 1 };
  const pad = (max - min) * 0.16;
  return { min: min - pad, max: max + pad };
}

function linePaths(
  points: Array<{ x: number; y: number; value: number | null }>,
) {
  const paths: string[] = [];
  let current = "";
  for (const point of points) {
    if (point.value == null) {
      if (current) paths.push(current);
      current = "";
      continue;
    }
    current += current ? `L${point.x},${point.y}` : `M${point.x},${point.y}`;
  }
  if (current) paths.push(current);
  return paths;
}

export function TelemetryChart({
  title,
  description,
  unit,
  series,
  variant = "line",
  empty,
  yDomain,
}: {
  title: string;
  description?: string;
  unit: string;
  series: TelemetrySeries[];
  variant?: "line" | "bar";
  empty: string;
  yDomain?: { min: number; max: number };
}) {
  const width = 320;
  const height = 132;
  const padL = 8;
  const padR = 8;
  const padT = 12;
  const padB = 8;
  const labels = series[0]?.points ?? [];
  const hasValue = series.some((item) => item.points.some((point) => point.value != null && point.value !== 0));
  const y = domain(series, variant, yDomain);
  const span = Math.max(0.001, y.max - y.min);
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const count = Math.max(labels.length, 1);
  const xAt = (index: number) =>
    count === 1 ? padL + innerW / 2 : padL + (innerW * index) / (count - 1);
  const yAt = (value: number) => padT + innerH - ((value - y.min) / span) * innerH;

  const grid = [0, 0.5, 1].map((step) => {
    const value = y.min + (y.max - y.min) * step;
    return { y: yAt(value), value };
  });

  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 flex items-end justify-between gap-3" data-coach-header>
        <span>
          <span className="block font-display text-sm uppercase tracking-wide">{title}</span>
          {description ? <span className="mt-0.5 block text-xs text-muted">{description}</span> : null}
        </span>
        <span className="font-telemetry shrink-0 text-[10px] uppercase tracking-[0.16em] text-muted">
          {unit}
        </span>
      </figcaption>
      {hasValue ? (
        <div className="hc-plot hc-scan px-1 pt-1">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-32 w-full" aria-hidden>
            {grid.map((line) => (
              <line
                key={line.y}
                x1={padL}
                x2={width - padR}
                y1={line.y}
                y2={line.y}
                stroke="#243024"
                strokeWidth="1"
              />
            ))}
            {variant === "bar"
              ? series.map((item) => {
                  const gap = 8;
                  const slot = innerW / count;
                  const barW = Math.max(4, (slot - gap) / series.length);
                  return item.points.map((point, index) => {
                    if (point.value == null) return null;
                    const barH = ((point.value - y.min) / span) * innerH;
                    const seriesIndex = series.indexOf(item);
                    const x = padL + slot * index + gap / 2 + seriesIndex * barW;
                    return (
                      <rect
                        key={`${item.id}-${index}`}
                        x={x}
                        y={padT + innerH - barH}
                        width={barW - 2}
                        height={Math.max(point.value > 0 ? 2 : 0, barH)}
                        fill={item.color}
                        rx="1"
                      />
                    );
                  });
                })
              : series.map((item) => {
                  const coords = item.points.map((point, index) => ({
                    x: xAt(index),
                    y: point.value == null ? 0 : yAt(point.value),
                    value: point.value,
                    mark: point.mark,
                  }));
                  const paths = linePaths(coords);
                  return (
                    <g key={item.id}>
                      {paths.map((d) => (
                        <path
                          key={d}
                          d={d}
                          fill="none"
                          stroke={item.color}
                          strokeWidth="6"
                          strokeOpacity="0.22"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                      ))}
                      {paths.map((d) => (
                        <path
                          key={`${d}-core`}
                          d={d}
                          fill="none"
                          stroke={item.color}
                          strokeWidth="2"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                      ))}
                      {coords.map((point, index) =>
                        point.value == null ? null : (
                          <circle
                            key={index}
                            cx={point.x}
                            cy={point.y}
                            r={point.mark === "down" ? 3.4 : 2.6}
                            fill={point.mark === "down" ? "#FF3B3B" : item.color}
                          />
                        ),
                      )}
                    </g>
                  );
                })}
          </svg>
        </div>
      ) : (
        <div className="hc-plot flex h-32 items-center px-4" role="status">
          <p className="text-sm text-muted">{empty}</p>
        </div>
      )}
      {labels.length > 0 ? (
        <div className="mt-1 flex justify-between gap-1 px-1" aria-hidden>
          {labels.map((point, index) => {
            const show =
              labels.length <= 8 ||
              index === 0 ||
              index === labels.length - 1 ||
              index === Math.floor(labels.length / 2);
            return (
              <span
                key={`${point.label}-${index}`}
                className="min-w-0 flex-1 text-center font-telemetry text-[10px] text-muted"
              >
                {show ? point.label : ""}
              </span>
            );
          })}
        </div>
      ) : null}
      {series.length > 1 ? (
        <ul className="mt-2 flex flex-wrap gap-3">
          {series.map((item) => (
            <li key={item.id} className="flex items-center gap-1.5 text-xs text-muted">
              <span className="inline-block h-1.5 w-4" style={{ background: item.color }} aria-hidden />
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}
      <table className="sr-only">
        <caption>
          {title}
          {description ? `. ${description}` : ""}. Values in {unit}.
        </caption>
        <thead>
          <tr>
            <th>When</th>
            {series.map((item) => (
              <th key={item.id}>
                {item.label} ({unit})
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((point, index) => (
            <tr key={`${point.detail ?? point.label}-${index}`}>
              <th>{point.detail ?? point.label}</th>
              {series.map((item) => (
                <td key={item.id}>{item.points[index]?.value ?? "none"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
