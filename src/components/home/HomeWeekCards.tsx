import Link from "next/link";
import { formatTelemetryNumber, type TelemetryDay } from "@/lib/home-telemetry";
import { weightValuesSince } from "@/lib/weight-series";

function formatWeight(value: number) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}

function WeightSpark({
  weights,
  now,
}: {
  weights: Array<{ value: number; recordedAt: Date }>;
  now: Date;
}) {
  const values = weightValuesSince(weights, now, 7);
  const latest = values.at(-1);
  const width = 128;
  const height = 36;
  const pad = 4;
  let coords: Array<{ x: number; y: number; drop: boolean }> = [];
  if (values.length > 0) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    coords = values.map((value, index) => ({
      x: values.length === 1 ? width / 2 : pad + ((width - pad * 2) * index) / (values.length - 1),
      y: pad + (1 - (value - min) / span) * (height - pad * 2),
      drop: index > 0 && value < values[index - 1]!,
    }));
  }
  const line = coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");

  return (
    <Link
      href="/progress"
      className="hc-panel hc-carbon flex min-h-[7.5rem] flex-col px-3 py-2.5"
      aria-label={latest == null ? "Weight, 7 days. Log your weight" : `Weight, 7 days. Latest ${formatWeight(latest)} pounds`}
    >
      <span className="font-telemetry text-[10px] uppercase tracking-[0.14em] text-muted">Weight - 7 days</span>
      <span className="mt-1 font-telemetry text-xl leading-none text-[#CBF805]">
        {latest == null ? "—" : formatWeight(latest)}
        {latest == null ? null : <span className="ml-1 text-[10px] text-signal">lbs</span>}
      </span>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-auto h-9 w-full" aria-hidden>
        {coords.length === 0 ? (
          <line
            x1="4"
            x2={width - 4}
            y1={height / 2}
            y2={height / 2}
            stroke="#CBF805"
            strokeOpacity="0.35"
            strokeDasharray="3 3"
            strokeLinecap="round"
          />
        ) : (
          <>
            {coords.length > 1 ? (
              <path d={line} fill="none" stroke="#CBF805" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
            ) : null}
            {coords.map((point, index) => (
              <circle
                key={index}
                cx={point.x}
                cy={point.y}
                r={point.drop ? 2.6 : 1.8}
                fill={point.drop ? "#FF3B3B" : "#CBF805"}
              />
            ))}
          </>
        )}
      </svg>
      {latest == null ? <span className="mt-1 text-[10px] text-muted">Log your weight</span> : null}
    </Link>
  );
}

function WeekLoad({ days, todayKey }: { days: TelemetryDay[]; todayKey: string }) {
  const hasLoad = days.some((day) => day.load > 0);
  const values = days.map((day) => (hasLoad ? day.load : day.sessions));
  const total = values.reduce((sum, value) => sum + value, 0);
  const max = Math.max(...values, 0);
  const empty = total === 0;
  const readout = empty ? "—" : hasLoad ? formatTelemetryNumber(total) : String(total);

  return (
    <Link
      href="/progress"
      className="hc-panel hc-carbon flex min-h-[7.5rem] flex-col px-3 py-2.5"
      aria-label={empty ? "This week. No sessions logged" : `This week. ${readout} ${hasLoad ? "pounds of training load" : "sessions"}`}
    >
      <span className="font-telemetry text-[10px] uppercase tracking-[0.14em] text-muted">This week</span>
      <span className="mt-1 font-telemetry text-xl leading-none text-[#CBF805]">
        {readout}
        {empty ? null : (
          <span className="ml-1 text-[10px] text-muted">{hasLoad ? "lb" : "sessions"}</span>
        )}
      </span>
      <span className="mt-auto flex items-end justify-between gap-1 pt-2" aria-hidden>
        {days.map((day, index) => {
          const value = values[index] ?? 0;
          const today = day.key === todayKey;
          const height = empty ? 8 : Math.max(4, Math.round((value / max) * 28));
          return (
            <span key={day.key} className="flex flex-1 flex-col items-center gap-1">
              <span
                className="block w-full max-w-3 rounded-[2px]"
                style={{
                  height,
                  background: today ? "transparent" : value > 0 ? "#CBF805" : "#243024",
                  boxShadow: today ? "inset 0 0 0 1.5px #CBF805" : undefined,
                }}
              />
              <span className={`font-telemetry text-[9px] ${today ? "text-[#CBF805]" : "text-muted"}`}>{day.label}</span>
            </span>
          );
        })}
      </span>
      {empty ? <span className="mt-1 text-[10px] text-muted">No sessions yet</span> : null}
    </Link>
  );
}

export function HomeWeekCards({
  weights,
  days,
  todayKey,
  now,
}: {
  weights: Array<{ value: number; recordedAt: Date }>;
  days: TelemetryDay[];
  todayKey: string;
  now: Date;
}) {
  return (
    <div className="grid grid-cols-2 gap-2" data-home-sparks>
      <WeightSpark weights={weights} now={now} />
      <WeekLoad days={days} todayKey={todayKey} />
    </div>
  );
}
