import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { listWorkoutSessionsForUser } from "@/lib/workouts";
import { memberFacingTitle } from "@/lib/member-copy";
import { formatHistoryWhen } from "@/lib/workout-complete";
import { EmptyState } from "@/components/EmptyState";
import { difficultyLabel } from "@/lib/difficulty";
import { sessionHasLoggedWork } from "@/lib/logged-work";

export default async function HistoryPage() {
  const user = await requireUser();
  const profile = await getProfileForUser(user.id);
  const timeZone = await timeZoneForUser(user.id, profile?.timeZone ?? null);
  const sessions = await listWorkoutSessionsForUser(user.id);

  return (
    <main className="space-y-6">
      <div>
        <Link href="/training" className="text-sm text-accent underline-offset-4 hover:underline">
          Back to Training
        </Link>
        <h1 className="mt-2 text-2xl">Workout history</h1>
        <p className="mt-1 text-sm text-muted">
          Logged sessions persist after refresh. Open any row to correct a mistake.
        </p>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          title="No sessions yet"
          action={
            <Link href="/training" className="text-accent underline">
              Start a DEMO session
            </Link>
          }
        >
          Logged sessions persist after refresh. Open any row to correct a mistake.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {sessions.map((session) => {
            const finished = session.status === "complete" && sessionHasLoggedWork(session.sets);
            const label = finished ? "complete" : session.status === "complete" ? "draft" : session.status;
            return (
            <li key={session.id} className="flex items-stretch gap-2">
              <Link
                href={`/training/log/${session.id}`}
                className="block min-w-0 flex-1 rounded-2xl border border-line bg-card p-4 hover:border-accent"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{memberFacingTitle(session.title)}</p>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {formatHistoryWhen(new Date(session.performedAt), timeZone)} · {label} ·{" "}
                  {session.sets.length} sets
                  {difficultyLabel(session.difficultyRating)
                    ? ` · ${difficultyLabel(session.difficultyRating)}`
                    : finished
                      ? " · rate how it felt"
                      : ""}
                </p>
              </Link>
              {finished ? (
                <Link
                  href={`/training/log/${session.id}/done`}
                  className="touch-target inline-flex min-w-[4.5rem] items-center justify-center rounded-2xl border border-line px-3 text-sm"
                >
                  Share
                </Link>
              ) : null}
            </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
