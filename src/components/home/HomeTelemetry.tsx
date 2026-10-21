import { TelemetryChart } from "@/components/design/TelemetryChart";
import {
  formatTelemetryNumber,
  trainingLoadForDay,
  type HomeTelemetrySnapshot,
} from "@/lib/home-telemetry";
import { streakRingRatio } from "@/lib/streaks";

function Stat({
  label,
  value,
  unit,
  compact = false,
}: {
  label: string;
  value: string;
  unit: string;
  compact?: boolean;
}) {
  return (
    <article className={`border border-[#cbf805]/25 bg-black/45 ${compact ? "px-2 py-1" : "px-3 py-2"}`}>
      <p className="font-telemetry text-[10px] uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className={`font-telemetry mt-0.5 leading-none text-[#CBF805] ${compact ? "text-xl" : "mt-1 text-2xl"}`}>
        {value}
      </p>
      <p className="font-telemetry mt-0.5 text-[10px] uppercase tracking-[0.14em] text-muted">{unit}</p>
    </article>
  );
}

function StreakGauge({
  current,
  longest,
  compact = false,
}: {
  current: number;
  longest: number;
  compact?: boolean;
}) {
  const ratio = streakRingRatio(current, longest);
  const radius = 28;
  const full = ratio >= 1;
  return (
    <article
      className={`flex items-center border border-[#cbf805]/25 bg-black/45 ${compact ? "gap-2 px-2 py-1.5" : "gap-3 px-3 py-2"}`}
    >
      <svg viewBox="0 0 72 72" className={`shrink-0 ${compact ? "h-12 w-12" : "h-16 w-16"}`} aria-hidden>
        <circle cx="36" cy="36" r={radius} fill="none" stroke="rgba(203,248,5,0.35)" strokeWidth="4" />
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke="#CBF805"
          strokeWidth="4"
          pathLength={100}
          strokeLinecap="round"
          strokeDasharray={full ? undefined : `${ratio * 100} ${100 - ratio * 100}`}
          transform="rotate(-90 36 36)"
          data-streak-ring={full ? "full" : ratio > 0 ? "partial" : "empty"}
        />
      </svg>
      <div className="min-w-0">
        <p className="hc-kicker">Streak</p>
        <p className={`font-telemetry leading-none text-[#CBF805] ${compact ? "mt-0.5 text-2xl" : "mt-1 text-3xl"}`}>
          {current}
        </p>
        <p className="font-telemetry mt-1 text-[10px] uppercase tracking-[0.14em] text-muted">
          Best {longest}
        </p>
      </div>
    </article>
  );
}

export function HomeTelemetry({
  data,
  title,
  compact = false,
}: {
  data: HomeTelemetrySnapshot;
  title: string;
  /** Tighter padding for the Progress page. Home keeps the roomier layout. */
  compact?: boolean;
}) {
  const trainingLoad = data.days.reduce((sum, day) => sum + trainingLoadForDay(day), 0);
  const hasBagLoad = data.days.some((day) => day.bagLoad > 0);
  return (
    <section
      className={`hc-panel hc-carbon ${compact ? "px-2.5 py-2" : "px-4 py-4"}`}
      data-home-telemetry
      aria-labelledby="home-telemetry-kicker home-telemetry-title"
    >
      <div className="flex items-end justify-between gap-3" data-coach-header>
        <div className="min-w-0">
          <p id="home-telemetry-kicker" className="hc-kicker">
            {title}
          </p>
          <h2 id="home-telemetry-title" className={compact ? "mt-0.5 text-xl" : "mt-2 text-2xl"}>
            This week
          </h2>
        </div>
        <p className="font-telemetry text-[10px] uppercase tracking-[0.16em] text-muted">Mon–Sun</p>
      </div>

      <div className={`grid grid-cols-2 ${compact ? "mt-2 gap-1.5" : "mt-4 gap-2"}`}>
        <Stat
          compact={compact}
          label="Load"
          value={formatTelemetryNumber(trainingLoad)}
          unit={hasBagLoad ? "lb + bag load" : "lb volume"}
        />
        <Stat compact={compact} label="Rounds" value={String(data.weekRounds)} unit="sparring" />
        <Stat compact={compact} label="Sessions" value={String(data.weekSessions)} unit="logged" />
        <Stat
          compact={compact}
          label="Streak"
          value={String(data.streakCurrent)}
          unit={`best ${data.streakLongest}`}
        />
      </div>

      <div className={compact ? "mt-2 space-y-2" : "mt-4 space-y-4"}>
        <TelemetryChart
          title="Training load"
          description="Reps times load, plus bagwork rounds × minutes × RPE"
          unit={hasBagLoad ? "load" : "lb"}
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
                value: trainingLoadForDay(day),
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

      <div className={`grid grid-cols-1 sm:grid-cols-2 ${compact ? "mt-2 gap-1.5" : "mt-4 gap-2"}`}>
        <StreakGauge compact={compact} current={data.streakCurrent} longest={data.streakLongest} />
        <article className={`border border-[#cbf805]/25 bg-black/45 ${compact ? "px-2 py-1.5" : "px-3 py-3"}`}>
          <p className="hc-kicker">Sessions</p>
          <p className={`text-sm text-muted ${compact ? "mt-1" : "mt-2"}`}>
            {data.weekSessions === 0
              ? "No sessions saved this week."
              : `${data.weekSessions} session${data.weekSessions === 1 ? "" : "s"} with logged work.`}
          </p>
          <ol className={`flex justify-between gap-1 ${compact ? "mt-1.5" : "mt-3"}`} aria-label="Sessions by day">
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
