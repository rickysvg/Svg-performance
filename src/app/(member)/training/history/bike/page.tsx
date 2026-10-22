import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listWorkoutSessionsForUser } from "@/lib/workouts";
import { bikeHistoryFromSessions } from "@/lib/bike-chooser";
import { EmptyState } from "@/components/EmptyState";

function when(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function BikeHistoryPage() {
  const user = await requireUser();
  const sessions = await listWorkoutSessionsForUser(user.id);
  const rows = bikeHistoryFromSessions(sessions);

  return (
    <main className="space-y-6" data-bike-history>
      <div>
        <Link href="/training/history" className="text-sm text-accent underline-offset-4 hover:underline">
          Back to history
        </Link>
        <h1 className="mt-2 text-2xl">Bike history</h1>
        <p className="mt-1 text-sm text-muted">
          Past bike sessions from your logged workouts. Date, recipe, and whether you finished.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No bike sessions yet"
          action={
            <Link href="/training" className="text-accent underline">
              Start a session
            </Link>
          }
        >
          Finish a bike day and it will show up here with the work, rest, sprints, and rounds.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                data-testid={`training-history-bike-log-${row.sessionId}`}
                href={`/training/log/${row.sessionId}`}
                data-bike-history-row
                className="block rounded-2xl border border-line bg-card p-4 hover:border-accent"
              >
                <p className="text-sm text-muted">{when(row.performedAt)}</p>
                <p className="font-display mt-1 text-lg uppercase leading-tight tracking-wide">{row.workoutName}</p>
                <p className="mt-1 text-sm">{row.recipe}</p>
                <p className="mt-2 text-sm text-muted">
                  {row.workSeconds != null && row.restSeconds != null
                    ? `${row.workSeconds}s work / ${row.restSeconds}s rest · `
                    : ""}
                  {row.sprints != null ? `${row.sprints} sprints · ` : ""}
                  {row.rounds != null ? `${row.rounds} ${row.rounds === 1 ? "round" : "rounds"}` : ""}
                  {row.restBetweenRoundsSeconds > 0 ? ` · ${row.restBetweenRoundsSeconds}s between` : ""}
                  {" · "}
                  <span className={row.completed ? "text-accent" : "text-signal"}>
                    {row.completed
                      ? "Completed"
                      : row.doneSets > 0
                        ? `${row.doneSets} of ${row.totalSets} completed`
                        : "Not completed"}
                  </span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
