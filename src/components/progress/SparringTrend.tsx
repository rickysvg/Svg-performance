import { SORE_SPOT_LABELS, sparringMinutes, type SparringLog } from "@/lib/outside-log";

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
    <section className="rounded-2xl border border-line bg-card p-4" data-sparring-trend>
      <h2 className="text-lg">Sparring and body</h2>
      <p className="mt-1 text-xs text-muted">
        Session is how it went. Body is how you felt after. Oldest is first.
      </p>
      {rated.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Log sparring with a session rating and a body rating to see the trend.
        </p>
      ) : (
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
