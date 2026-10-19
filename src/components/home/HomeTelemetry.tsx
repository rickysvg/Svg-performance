import { TelemetryChart } from "@/components/design/TelemetryChart";
import {
  formatTelemetryNumber,
  type HomeTelemetrySnapshot,
} from "@/lib/home-telemetry";

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <article className="border border-[#cbf805]/25 bg-black/45 px-3 py-2">
      <p className="font-telemetry text-[10px] uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="font-telemetry mt-1 text-2xl leading-none text-[#CBF805]">{value}</p>
      <p className="font-telemetry mt-1 text-[10px] uppercase tracking-[0.14em] text-muted">{unit}</p>
    </article>
  );
}

function StreakGauge({ current, longest }: { current: number; longest: number }) {
  const target = Math.max(longest, current, 1);
  const ratio = Math.min(1, current / target);
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const dash = circ * ratio;
  return (
    <article className="flex items-center gap-3 border border-[#cbf805]/25 bg-black/45 px-3 py-2">
      <svg viewBox="0 0 72 72" className="h-16 w-16 shrink-0" aria-hidden>
        <circle cx="36" cy="36" r={radius} fill="none" stroke="#243024" strokeWidth="4" />
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke="#CBF805"
          strokeWidth="4"
          strokeDasharray={`${dash} ${circ - dash}`}
          transform="rotate(-90 36 36)"
        />
      </svg>
      <div className="min-w-0">
        <p className="hc-kicker">Streak</p>
        <p className="font-telemetry mt-1 text-3xl leading-none text-[#CBF805]">{current}</p>
        <p className="font-telemetry mt-1 text-[10px] uppercase tracking-[0.14em] text-muted">
          Best {longest}
        </p>
      </div>
    </article>
  );
}

export function HomeTelemetry({ data }: { data: HomeTelemetrySnapshot }) {
  return (
    <section className="hc-panel px-4 py-4" data-home-telemetry aria-labelledby="home-telemetry-title">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="hc-kicker">Telemetry</p>
          <h2 id="home-telemetry-title" className="mt-2 text-2xl">
            This week
          </h2>
        </div>
        <p className="font-telemetry text-[10px] uppercase tracking-[0.16em] text-muted">Mon–Sun</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Stat label="Load" value={formatTelemetryNumber(data.weekLoad)} unit="lb volume" />
        <Stat label="Rounds" value={String(data.weekRounds)} unit="sparring" />
        <Stat label="Sessions" value={String(data.weekSessions)} unit="logged" />
        <Stat label="Streak" value={String(data.streakCurrent)} unit={`best ${data.streakLongest}`} />
      </div>

      <div className="mt-4 space-y-4">
        <TelemetryChart
          title="Training load"
          description="Reps times load, by day"
          unit="lb"
          variant="bar"
          empty="No training load logged this week. Finish a workout to light this up."
          series={[
            {
              id: "load",
              label: "Load",
              color: "#CBF805",
              points: data.days.map((day) => ({
                label: day.label,
                detail: day.name,
                value: day.load,
              })),
            },
          ]}
        />
        <TelemetryChart
          title="Rounds"
          description="Sparring rounds you logged"
          unit="rounds"
          variant="bar"
          empty="No sparring rounds logged this week."
          series={[
            {
              id: "rounds",
              label: "Rounds",
              color: "#5ee0ff",
              points: data.days.map((day) => ({
                label: day.label,
                detail: day.name,
                value: day.rounds,
              })),
            },
          ]}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <StreakGauge current={data.streakCurrent} longest={data.streakLongest} />
        <article className="border border-[#cbf805]/25 bg-black/45 px-3 py-3">
          <p className="hc-kicker">Sessions</p>
          <p className="mt-2 text-sm text-muted">
            {data.weekSessions === 0
              ? "No sessions saved this week."
              : `${data.weekSessions} session${data.weekSessions === 1 ? "" : "s"} with logged work.`}
          </p>
          <ol className="mt-3 flex justify-between gap-1" aria-label="Sessions by day">
            {data.days.map((day) => (
              <li key={day.key} className="flex flex-col items-center gap-1">
                <span
                  className={`block h-6 w-3 ${day.sessions > 0 ? "bg-[#CBF805]" : "bg-[#243024]"}`}
                  aria-hidden
                />
                <span className="sr-only">
                  {day.name}: {day.sessions} session{day.sessions === 1 ? "" : "s"}
                </span>
                <span className="font-telemetry text-[10px] text-muted" aria-hidden>
                  {day.label}
                </span>
              </li>
            ))}
          </ol>
        </article>
      </div>
    </section>
  );
}
