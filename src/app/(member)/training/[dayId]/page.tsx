import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoBadge } from "@/components/DemoBadge";
import { requireUser } from "@/lib/session";
import { getProgramDayById } from "@/lib/programs";
import { startSessionAction } from "@/app/actions/workouts";

export default async function TrainingDayPage({
  params,
}: {
  params: Promise<{ dayId: string }>;
}) {
  await requireUser();
  const { dayId } = await params;
  let day;
  try {
    day = await getProgramDayById(dayId);
  } catch {
    notFound();
  }

  return (
    <main className="space-y-6">
      <Link href="/training" className="text-sm text-accent underline-offset-4 hover:underline">
        Back to Training
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">
            {day.program.title}
          </p>
          <h1 className="text-2xl font-semibold">{day.title}</h1>
          <p className="mt-1 text-sm text-muted">{day.focus}</p>
        </div>
        {day.program.isDemo ? <DemoBadge /> : null}
      </div>

      <ol className="space-y-4">
        {day.exercises.map((exercise, index) => (
          <li key={exercise.id} className="rounded-2xl border border-line bg-card p-5">
            <p className="text-xs text-muted">Exercise {index + 1}</p>
            <h2 className="text-lg font-semibold">{exercise.name}</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted">Sets</dt>
                <dd className="font-medium">{exercise.sets}</dd>
              </div>
              <div>
                <dt className="text-muted">Reps / time</dt>
                <dd className="font-medium">{exercise.reps}</dd>
              </div>
              <div>
                <dt className="text-muted">Load</dt>
                <dd className="font-medium">{exercise.loadText}</dd>
              </div>
              <div>
                <dt className="text-muted">Rest</dt>
                <dd className="font-medium">{exercise.restSeconds} seconds</dd>
              </div>
            </dl>
            {exercise.notes ? (
              <p className="mt-3 text-sm text-muted">{exercise.notes}</p>
            ) : null}
          </li>
        ))}
      </ol>

      <form action={startSessionAction}>
        <input type="hidden" name="programDayId" value={day.id} />
        <button
          type="submit"
          className="touch-target w-full rounded-full bg-accent font-semibold text-black"
        >
          Start and log this session
        </button>
      </form>
    </main>
  );
}
