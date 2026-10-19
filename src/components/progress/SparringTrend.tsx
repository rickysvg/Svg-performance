import Link from "next/link";
import { TelemetryChart } from "@/components/design/TelemetryChart";
import { SORE_SPOT_LABELS, sparringMinutes, type SparringLog } from "@/lib/outside-log";

function dayLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return dateKey;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function Pips({ value, label }: { value: number | null; label: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <div className="mt-1 flex gap-1" aria-label={value ? `${label} ${value} of 5` : `${label} not rated`}>
        {[1, 2, 3, 4, 5].map((score) => (
          <span
            key={score}
            className={`h-2.5 w-5 rounded-full ${value != null && score <= value ? "bg-accent" : "bg-line"}`}
          />
        ))}
      </div>
    </div>
  );
}

export function SparringTrend({ logs }: { logs: SparringLog[] }) {
  const rated = logs.filter((log) => log.sessionRating != null || log.bodyRating != null);
  return (
    <section className="hc-panel p-4" data-sparring-trend>
      <p className="hc-kicker">Ratings</p>
      <h2 className="mt-2 text-lg">Sparring and body</h2>
      <p className="mt-1 text-xs text-muted">
        Session is how it went. Body is how you felt after. Oldest is first.
      </p>
      {rated.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Log sparring with a session rating and a body rating to see the trend.{" "}
          <Link href="/sparring" className="text-accent underline">
            Open the sparring log
          </Link>
          .
        </p>
      ) : (
        <div className="mt-4">
          <TelemetryChart
            title="Ratings"
            description="Session and body, 1 to 5"
            unit="score"
            yDomain={{ min: 1, max: 5 }}
            empty="Log sparring with a session rating and a body rating to see the trend."
            series={[
              {
                id: "session",
                label: "Session",
                color: "#CBF805",
                points: rated.map((log) => ({
                  label: dayLabel(log.dateKey),
                  detail: log.weekday || log.dateKey,
                  value: log.sessionRating,
                })),
              },
              {
                id: "body",
                label: "Body",
                color: "#5ee0ff",
                points: rated.map((log) => ({
                  label: dayLabel(log.dateKey),
                  detail: log.weekday || log.dateKey,
                  value: log.bodyRating,
                })),
              },
            ]}
          />
        </div>
      )}
      {rated.length === 0 ? null : (
        <ol className="mt-4 space-y-3">
          {rated.map((log) => (
            <li key={log.dateKey} className="border-t border-line pt-3 first:border-0 first:pt-0">
              <p className="text-sm font-semibold">
                {log.weekday || log.dateKey}
                <span className="font-normal text-muted">
                  {" "}
                  · {log.rounds} × {log.minutesPerRound} min ({sparringMinutes(log)} min)
                </span>
              </p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <Pips value={log.sessionRating} label="Session" />
                <Pips value={log.bodyRating} label="Body" />
              </div>
              {log.soreSpots.length > 0 ? (
                <p className="mt-2 text-xs text-muted">
                  Sore: {log.soreSpots.map((spot) => SORE_SPOT_LABELS[spot]).join(", ")}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
