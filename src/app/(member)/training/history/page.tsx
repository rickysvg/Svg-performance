import Link from "next/link";
import { requireUser } from "@/lib/session";
import { loggedSetCount, listWorkoutSessionsForUser } from "@/lib/workouts";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { formatDateTime } from "@/lib/timezone";
import { countLabel } from "@/lib/exercise-log-mode";
import { EmptyState } from "@/components/EmptyState";
import { difficultyLabel } from "@/lib/difficulty";

export default async function HistoryPage() {
  const user = await requireUser();
  const profile = await getProfileForUser(user.id);
  const timeZone = await timeZoneForUser(user.id, profile?.timeZone ?? null);
  const sessions = (await listWorkoutSessionsForUser(user.id)).filter(
    (session) => session.status === "complete" || loggedSetCount(session.sets) > 0,
  );

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
              Start a session
            </Link>
          }
        >
          Logged sessions persist after refresh. Open any row to correct a mistake.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {sessions.map((session) => (
            <li key={session.id} className="flex items-stretch gap-2">
              <Link
                href={`/training/log/${session.id}`}
                className="block min-w-0 flex-1 rounded-2xl border border-line bg-card p-4 hover:border-accent"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{session.title.replace(/^DEMO\s+[—-]\s+/i, "")}</p>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {formatDateTime(new Date(session.performedAt), timeZone)} · {session.status} ·{" "}
                  {countLabel(loggedSetCount(session.sets), "set")}
                  {difficultyLabel(session.difficultyRating)
                    ? ` · ${difficultyLabel(session.difficultyRating)}`
                    : session.status === "complete"
                      ? " · rate how it felt"
                      : ""}
                </p>
              </Link>
              {session.status === "complete" ? (
                <Link
                  href={`/training/log/${session.id}/done`}
                  className="touch-target inline-flex min-w-[4.5rem] items-center justify-center rounded-2xl border border-line px-3 text-sm"
                >
                  Share
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
