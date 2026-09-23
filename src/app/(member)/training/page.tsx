import Link from "next/link";
import { DemoBadge } from "@/components/DemoBadge";
import { requireUser } from "@/lib/session";
import { findDemoProgram } from "@/lib/programs";
import { listWorkoutSessionsForUser } from "@/lib/workouts";
import { startSessionAction } from "@/app/actions/workouts";
import { WatchFormInline } from "@/components/training/WatchForm";
import { canUseFeature } from "@/lib/entitlements";

export default async function TrainingPage() {
  const user = await requireUser();
  const program = await findDemoProgram();
  const sessions = await listWorkoutSessionsForUser(user.id);
  const conditioning = await canUseFeature(user.id, "conditioning");

  return (
    <main className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Training</h1>
          <p className="mt-1 text-sm text-muted">
            One coach-style template for this preview. It is not your official
            assigned program.
          </p>
        </div>
        <DemoBadge />
      </div>
      <p className="text-sm">
        <Link href="/training/calendar" className="font-semibold text-accent underline-offset-4 hover:underline">
          Calendar
        </Link>
        <span className="text-muted"> — this week’s DEMO days in a list</span>
      </p>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="font-semibold">Fighter Conditioning</h2>
        {conditioning ? (
          <p className="mt-2 text-sm text-muted">
            Shared combat S&amp;C / mobility blocks publish here when ready. This DEMO
            starter stays labeled DEMO and is not a 1:1 assigned fight camp.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Structured fighter conditioning is on the $49 / $59 plan.{" "}
            <Link href="/pricing" className="text-accent underline">
              See App Plans
            </Link>
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-accent/40 bg-card p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-accent">
          DEMO program
        </p>
        <h2 className="mt-1 text-xl font-semibold">
          {program?.title ?? "DEMO program not loaded yet"}
        </h2>
        <p className="mt-2 text-sm text-muted">
          {program?.description ??
            "This hosted preview has no seeded DEMO days yet. Your account is fine. An admin can run the laptop seed, or we can load the template later. It is not a live billing or Gymdesk issue."}
        </p>
      </section>

      <div className="space-y-4">
        {(program?.days ?? []).map((day) => (
          <article key={day.id} className="rounded-2xl border border-line bg-card p-5">
            <h3 className="text-lg font-semibold">{day.title}</h3>
            <p className="text-sm text-muted">{day.focus}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {day.exercises.map((exercise) => (
                <li key={exercise.id} className="flex justify-between gap-3 border-b border-line/60 py-2 last:border-0">
                  <span>
                    <span className="font-medium">{exercise.name}</span>
                    <span className="block text-muted">
                      {exercise.sets} × {exercise.reps} · {exercise.loadText} · rest {exercise.restSeconds}s
                    </span>
                  </span>
                  <WatchFormInline url={exercise.formVideoUrl} pending={exercise.formVideoPending} />
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href={`/training/${day.id}`}
                className="touch-target inline-flex items-center rounded-full border border-line px-4 text-sm"
              >
                View details
              </Link>
              <form action={startSessionAction}>
                <input type="hidden" name="programDayId" value={day.id} />
                <button
                  type="submit"
                  className="touch-target rounded-full bg-accent px-4 text-sm font-semibold text-black"
                >
                  Start this session
                </button>
              </form>
            </div>
          </article>
        ))}
      </div>

      <p className="text-sm">
        <Link href="/training/calendar" className="text-accent underline-offset-4 hover:underline">
          Calendar
        </Link>
        {" · "}
        <Link href="/training/history" className="text-accent underline-offset-4 hover:underline">
          Workout history ({sessions.length})
        </Link>
      </p>
    </main>
  );
}
