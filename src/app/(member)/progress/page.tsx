import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { listWorkoutSessionsForUser } from "@/lib/workouts";
import { buildProgressSummary } from "@/lib/progress";
import { ProgressBars } from "@/components/progress/ProgressBars";
import { EmptyState } from "@/components/EmptyState";

export default async function ProgressPage() {
  const user = await requireUser();
  const [profile, sessions] = await Promise.all([
    getProfileForUser(user.id),
    listWorkoutSessionsForUser(user.id),
  ]);
  const units = profile?.preferredUnits ?? "lb";
  const summary = buildProgressSummary(sessions, units);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Progress</h1>
        <p className="mt-1 text-sm text-muted">
          Built only from workouts you logged. Volume is reps × load, converted
          to your preferred unit ({units}).
        </p>
      </div>

      {summary.sessionCount === 0 ? (
        <EmptyState
          title="Nothing to chart yet"
          action={
            <Link href="/training" className="text-accent underline">
              Log a DEMO session
            </Link>
          }
        >
          Progress is built only from workouts you save.
        </EmptyState>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3">
            <article className="rounded-2xl border border-line bg-card p-4">
              <p className="text-xs uppercase text-muted">Sessions</p>
              <p className="mt-1 text-2xl font-semibold">{summary.sessionCount}</p>
            </article>
            <article className="rounded-2xl border border-line bg-card p-4">
              <p className="text-xs uppercase text-muted">Last session</p>
              <p className="mt-1 text-sm font-semibold">
                {summary.lastSessionTitle}
              </p>
            </article>
          </section>

          <section className="rounded-2xl border border-line bg-card p-5">
            <h2 className="font-semibold">Session volume ({units})</h2>
            <ProgressBars points={summary.points} />
          </section>

          <section className="rounded-2xl border border-line bg-card p-5">
            <h2 className="font-semibold">Best logged load</h2>
            {summary.exerciseBests.length === 0 ? (
              <p className="mt-2 text-sm text-muted">
                Add a load on a set to see bests here.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {summary.exerciseBests.map((best) => (
                  <li
                    key={best.exerciseName}
                    className="flex justify-between gap-3 border-b border-line/60 py-2 last:border-0"
                  >
                    <span>{best.exerciseName}</span>
                    <span className="text-accent">
                      {best.bestLoad} {best.unit}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
