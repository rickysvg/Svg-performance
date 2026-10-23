import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listWorkoutSessionsForUser } from "@/lib/workouts";
import { bikeHistoryFromSessions } from "@/lib/bike-chooser";
import { EmptyState } from "@/components/EmptyState";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { formatMemberDate } from "@/lib/timezone";

export default async function BikeHistoryPage() {
  const user = await requireUser();
  const profile = await getProfileForUser(user.id);
  const timeZone = await timeZoneForUser(user.id, profile?.timeZone ?? null);
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
          Finish a bike day and it will show up here with the work, rest, rounds, and sets.
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
                <p className="text-sm text-muted">{formatMemberDate(row.performedAt, timeZone)}</p>
                <p className="font-display mt-1 text-lg uppercase leading-tight tracking-wide">{row.workoutName}</p>
                <p className="mt-1 text-sm">{row.recipe}</p>
                <p className="mt-2 text-sm text-muted">
                  {row.sprints != null
                    ? `${
                        row.sprints *
                        ((row.restBetweenRoundsSeconds > 0 ||
                          ((row.rounds ?? 1) > 1 && row.workoutName.includes("×")))
                          ? Math.max(1, row.rounds ?? 1)
                          : 1)
                      } rounds · `
                    : ""}
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
