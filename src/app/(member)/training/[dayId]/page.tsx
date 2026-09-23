import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoBadge } from "@/components/DemoBadge";
import { requireUser } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { getProgramDayById } from "@/lib/programs";
import { sessionLengthHint, trainingLocationHint } from "@/lib/onboarding";
import { WatchFormInline } from "@/components/training/WatchForm";
import { ExerciseThumb } from "@/components/training/ExerciseThumb";
import { EquipmentRow } from "@/components/training/EquipmentRow";
import { startSessionAction } from "@/app/actions/workouts";
import { equipmentForExercises, plannedSetLine } from "@/lib/exercise-media";

export default async function TrainingDayPage({
  params,
}: {
  params: Promise<{ dayId: string }>;
}) {
  const user = await requireUser();
  const profile = await getProfileForUser(user.id);
  const { dayId } = await params;
  let day;
  try {
    day = await getProgramDayById(dayId);
  } catch {
    notFound();
  }

  const equipment = equipmentForExercises(day.exercises.map((exercise) => exercise.name));
  const lengthHint = sessionLengthHint(profile?.sessionLengthMin ?? null);
  const locationHint = trainingLocationHint(profile?.trainingLocation ?? "");

  return (
    <main className="-mx-4 flex min-h-[calc(100dvh-10rem)] flex-col">
      <header className="flex items-center gap-2 px-4 pb-4">
        <Link
          href="/training"
          aria-label="Close"
          className="touch-target inline-flex items-center justify-center text-2xl leading-none text-foreground"
        >
          ×
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-xs uppercase tracking-wide text-muted">
            {day.program.title}
          </p>
          <h1 className="truncate text-lg font-semibold">{day.title}</h1>
        </div>
        <span className="inline-flex w-11 justify-end">
          {day.program.isDemo ? <DemoBadge /> : null}
        </span>
      </header>

      <div className="space-y-2 px-4 pb-4">
        <p className="text-sm text-muted">{day.focus}</p>
        {lengthHint ? <p className="text-xs text-muted">{lengthHint}</p> : null}
        {locationHint ? <p className="text-xs text-muted">{locationHint}</p> : null}
        <EquipmentRow chips={equipment} />
      </div>

      <ol className="flex-1 border-t border-line pb-32">
        {day.exercises.map((exercise) => (
          <li
            key={exercise.id}
            className="flex items-center gap-3 border-b border-line py-3 pr-4"
          >
            <span className="h-14 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
            <ExerciseThumb name={exercise.name} />
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-semibold">{exercise.name}</h2>
              <p className="mt-0.5 text-sm text-muted">
                {plannedSetLine({
                  sets: exercise.sets,
                  reps: exercise.reps,
                  restSeconds: exercise.restSeconds,
                })}
              </p>
              {exercise.notes ? (
                <p className="mt-1 line-clamp-2 text-xs text-muted">{exercise.notes}</p>
              ) : null}
              <WatchFormInline url={exercise.formVideoUrl} pending={exercise.formVideoPending} />
            </div>
          </li>
        ))}
      </ol>

      <form
        action={startSessionAction}
        className="sticky bottom-28 z-10 mt-auto border-t border-line bg-background/95 px-4 py-3 pr-20 backdrop-blur"
      >
        <input type="hidden" name="programDayId" value={day.id} />
        <button
          type="submit"
          className="touch-target w-full rounded-full bg-accent text-base font-semibold text-black"
        >
          Start Now
        </button>
      </form>
    </main>
  );
}
