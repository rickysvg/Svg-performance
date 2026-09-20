import Link from "next/link";
import { DemoBadge } from "@/components/DemoBadge";
import { requireUser } from "@/lib/session";
import { getDemoProgram } from "@/lib/programs";
import { listWorkoutSessionsForUser } from "@/lib/workouts";
import { startSessionAction } from "@/app/actions/workouts";

export default async function TrainingPage() {
  const user = await requireUser();
  const program = await getDemoProgram();
  const sessions = await listWorkoutSessionsForUser(user.id);

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

      <section className="rounded-2xl border border-accent/40 bg-card p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-accent">
          DEMO program
        </p>
        <h2 className="mt-1 text-xl font-semibold">{program.title}</h2>
        <p className="mt-2 text-sm text-muted">{program.description}</p>
      </section>

      <div className="space-y-4">
        {program.days.map((day) => (
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
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-3">
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
        <Link href="/training/history" className="text-accent underline-offset-4 hover:underline">
          Workout history ({sessions.length})
        </Link>
      </p>
    </main>
  );
}
