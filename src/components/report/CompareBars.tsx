import type { ReactNode } from "react";
import type { ChartPoint, SparringChartPoint } from "@/lib/report-history";

const LIME = "#CBF805";
const DOWN = "#FF3B3B";
const GHOST = "#5c6560";
const PRO = "#f3f4ef";
const UNSPECIFIED = "#8d9384";

function PlotFrame({
  title,
  description,
  unit,
  empty,
  children,
  legend,
  table,
}: {
  title: string;
  description?: string;
  unit: string;
  empty: boolean;
  children: ReactNode;
  legend: ReactNode;
  table: ReactNode;
}) {
  return (
    <figure className="min-w-0 rounded-2xl border border-[#cbf805]/20 bg-black/50 px-3 py-3">
      <figcaption className="mb-2 flex items-end justify-between gap-3">
        <span>
          <span className="block font-display text-sm uppercase tracking-wide">{title}</span>
          {description ? <span className="mt-0.5 block text-xs text-muted">{description}</span> : null}
        </span>
        <span className="font-telemetry shrink-0 text-[10px] uppercase tracking-[0.16em] text-muted">{unit}</span>
      </figcaption>
      {empty ? (
        <p className="flex h-28 items-center text-sm text-muted" role="status">
          Nothing logged in either period.
        </p>
      ) : (
        <div className="hc-plot px-1 pt-1">{children}</div>
      )}
      {legend}
      {table}
    </figure>
  );
}

export function CompareBars({
  title,
  description,
  unit,
  points,
}: {
  title: string;
  description?: string;
  unit: string;
  points: ChartPoint[];
}) {
  const width = 320;
  const height = 132;
  const padL = 8;
  const padR = 8;
  const padT = 16;
  const padB = 4;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const max = Math.max(1, ...points.flatMap((point) => [point.current, point.baseline]));
  const count = Math.max(points.length, 1);
  const slot = innerW / count;
  const barW = Math.max(8, Math.min(28, slot * 0.62));
  const empty = points.every((point) => point.current === 0 && point.baseline === 0);
  return (
    <PlotFrame
      title={title}
      description={description}
      unit={unit}
      empty={empty}
      legend={
        <ul className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-4" style={{ background: LIME }} aria-hidden />
            This period
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-4" style={{ background: GHOST }} aria-hidden />
            Comparison
          </li>
        </ul>
      }
      table={
        <table className="sr-only">
          <caption>
            {title}. This period and the comparison, in {unit}.
          </caption>
          <thead>
            <tr>
              <th>When</th>
              <th>This period</th>
              <th>Comparison</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={`${point.detail}-${point.label}`}>
                <th>{point.detail}</th>
                <td>{point.current}</td>
                <td>{point.baseline}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <svg viewBox={`0 0 ${width} ${height}`} className="h-32 w-full" role="img" aria-hidden>
        {points.map((point, index) => {
          const x = padL + slot * index + (slot - barW) / 2;
          const ghostH = (point.baseline / max) * innerH;
          const currentH = (point.current / max) * innerH;
          const limeW = Math.max(4, barW * 0.72);
          return (
            <g key={`${point.label}-${index}`}>
              <rect
                x={x}
                y={padT + innerH - ghostH}
                width={barW}
                height={Math.max(point.baseline > 0 ? 2 : 0, ghostH)}
                fill={GHOST}
                rx="1"
              />
              <rect
                x={x + (barW - limeW) / 2}
                y={padT + innerH - currentH}
                width={limeW}
                height={Math.max(point.current > 0 ? 2 : 0, currentH)}
                fill={point.current < point.baseline ? LIME : LIME}
                rx="1"
              />
              {point.current > 0 ? (
                <text
                  x={x + barW / 2}
                  y={Math.max(10, padT + innerH - currentH - 3)}
                  textAnchor="middle"
                  fill={point.current < point.baseline ? DOWN : LIME}
                  fontSize="9"
                >
                  {point.current}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between gap-1">
        {points.map((point, index) => (
          <span key={`${point.label}-${index}`} className="min-w-0 flex-1 text-center font-telemetry text-[10px] text-muted">
            {point.label}
          </span>
        ))}
      </div>
    </PlotFrame>
  );
}

export function SparringBars({
  title,
  description,
  points,
}: {
  title: string;
  description?: string;
  points: SparringChartPoint[];
}) {
  const width = 320;
  const height = 132;
  const padL = 8;
  const padR = 8;
  const padT = 16;
  const padB = 4;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const totals = points.map((point) => point.amateur + point.pro + point.unspecified);
  const max = Math.max(1, ...totals, ...points.map((point) => point.baseline));
  const count = Math.max(points.length, 1);
  const slot = innerW / count;
  const barW = Math.max(8, Math.min(28, slot * 0.62));
  const empty = points.every((point) => point.amateur + point.pro + point.unspecified === 0 && point.baseline === 0);
  return (
    <PlotFrame
      title={title}
      description={description}
      unit="rounds"
      empty={empty}
      legend={
        <ul className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-4" style={{ background: LIME }} aria-hidden />
            Amateur
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-4 bg-[#f3f4ef]" aria-hidden />
            Pro
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-4" style={{ background: UNSPECIFIED }} aria-hidden />
            Unspecified
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-4" style={{ background: GHOST }} aria-hidden />
            Comparison
          </li>
        </ul>
      }
      table={
        <table className="sr-only">
          <caption>{title}. Amateur, pro, unspecified, and the comparison total.</caption>
          <thead>
            <tr>
              <th>When</th>
              <th>Amateur</th>
              <th>Pro</th>
              <th>Unspecified</th>
              <th>Comparison</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={`${point.detail}-${point.label}`}>
                <th>{point.detail}</th>
                <td>{point.amateur}</td>
                <td>{point.pro}</td>
                <td>{point.unspecified}</td>
                <td>{point.baseline}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <svg viewBox={`0 0 ${width} ${height}`} className="h-32 w-full" aria-hidden>
        {points.map((point, index) => {
          const x = padL + slot * index + (slot - barW) / 2;
          const ghostH = (point.baseline / max) * innerH;
          const segments = [
            { value: point.unspecified, fill: UNSPECIFIED },
            { value: point.amateur, fill: LIME },
            { value: point.pro, fill: PRO },
          ];
          let stacked = 0;
          return (
            <g key={`${point.label}-${index}`}>
              <rect
                x={x}
                y={padT + innerH - ghostH}
                width={barW}
                height={Math.max(point.baseline > 0 ? 2 : 0, ghostH)}
                fill={GHOST}
                rx="1"
              />
              {segments.map((segment) => {
                if (segment.value <= 0) return null;
                const h = (segment.value / max) * innerH;
                const y = padT + innerH - stacked - h;
                stacked += h;
                return (
                  <rect
                    key={segment.fill}
                    x={x + barW * 0.18}
                    y={y}
                    width={barW * 0.64}
                    height={Math.max(2, h)}
                    fill={segment.fill}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between gap-1">
        {points.map((point, index) => (
          <span key={`${point.label}-${index}`} className="min-w-0 flex-1 text-center font-telemetry text-[10px] text-muted">
            {point.label}
          </span>
        ))}
      </div>
    </PlotFrame>
  );
}
