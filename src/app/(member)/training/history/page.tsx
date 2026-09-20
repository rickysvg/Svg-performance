import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listWorkoutSessionsForUser } from "@/lib/workouts";
import { DemoBadge } from "@/components/DemoBadge";

export default async function HistoryPage() {
  const user = await requireUser();
  const sessions = await listWorkoutSessionsForUser(user.id);

  return (
    <main className="space-y-6">
      <div>
        <Link href="/training" className="text-sm text-accent underline-offset-4 hover:underline">
          Back to Training
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Workout history</h1>
        <p className="mt-1 text-sm text-muted">
          Logged sessions persist after refresh. Open any row to correct a mistake.
        </p>
      </div>

      {sessions.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card p-5 text-sm text-muted">
          No sessions yet. Start one from the DEMO program.
        </p>
      ) : (
        <ul className="space-y-3">
          {sessions.map((session) => (
            <li key={session.id}>
              <Link
                href={`/training/log/${session.id}`}
                className="block rounded-2xl border border-line bg-card p-4 hover:border-accent"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{session.title}</p>
                  {session.title.startsWith("DEMO") ? <DemoBadge /> : null}
                </div>
                <p className="mt-1 text-sm text-muted">
                  {new Date(session.performedAt).toLocaleString()} · {session.status} ·{" "}
                  {session.sets.length} sets
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
