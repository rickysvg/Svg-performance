import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoBadge } from "@/components/DemoBadge";
import { requireUser } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { getProgramDayById } from "@/lib/programs";
import { listWorkoutSessionsForUser } from "@/lib/workouts";
import { scaleBandFromPrefs, scaleCopy, scaleProgramDay } from "@/lib/training-scale";
import { WatchFormInline } from "@/components/training/WatchForm";
import { ExerciseThumb } from "@/components/training/ExerciseThumb";
import { EquipmentRow } from "@/components/training/EquipmentRow";
import { DaySessionMeta } from "@/components/training/DaySessionMeta";
import { startSessionAction } from "@/app/actions/workouts";
import {
  equipmentForExercises,
  estimateSessionMinutes,
  plannedSetLine,
  sessionKindLabel,
} from "@/lib/exercise-media";
import { lookupFormVideo } from "@/lib/form-videos";

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
    const raw = await getProgramDayById(dayId);
    day = scaleProgramDay(raw, {
      band: scaleBandFromPrefs({
        experienceLevel: profile?.experienceLevel,
        competitionStatus: profile?.competitionStatus,
      }),
      programSlug: raw.program.slug,
    });
  } catch {
    notFound();
  }

  const sessions = await listWorkoutSessionsForUser(user.id);
  const draft = sessions.find(
    (session) => session.status === "draft" && session.programDayId === day.id,
  );
  const equipment = equipmentForExercises(day.exercises.map((exercise) => exercise.name));
  const minutes = estimateSessionMinutes(day.exercises);
  const kind = sessionKindLabel({ title: day.title, focus: day.focus });
  const startLabel = draft ? "Continue" : "Start Now";

  return (
    <main className="-mx-4 flex min-h-[calc(100dvh-10rem)] flex-col">
      <header className="flex items-center gap-2 px-4 pb-2">
        <Link
          href="/training"
          aria-label="Close"
          className="touch-target inline-flex items-center justify-center text-2xl leading-none text-foreground"
        >
          ×
        </Link>
        <p className="min-w-0 flex-1 truncate text-center text-sm text-muted">
          {day.program.title}
        </p>
        <span className="inline-flex w-11 justify-end">
          {day.program.isDemo ? <DemoBadge /> : null}
        </span>
      </header>

      <section className="space-y-6 px-4 pb-8 pt-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold leading-tight">{day.title}</h1>
            <p className="mt-1 text-sm text-muted">{day.focus}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-accent">
              {scaleCopy(
                scaleBandFromPrefs({
                  experienceLevel: profile?.experienceLevel,
                  competitionStatus: profile?.competitionStatus,
                }),
              )}
            </p>
          </div>
          {draft ? (
            <Link
              href={`/training/log/${draft.id}`}
              className="shrink-0 pt-1 text-sm font-semibold text-accent"
            >
              Continue
            </Link>
          ) : (
            <form action={startSessionAction} className="shrink-0 pt-1">
              <input type="hidden" name="programDayId" value={day.id} />
              <button type="submit" className="text-sm font-semibold text-accent">
                Start Now
              </button>
            </form>
          )}
        </div>

        <DaySessionMeta
          kind={kind}
          minutes={minutes}
          exerciseCount={day.exercises.length}
        />

        <EquipmentRow chips={equipment} />
      </section>

      <ol className="flex-1 border-t border-line pb-32">
        {day.exercises.map((exercise) => {
          const form = lookupFormVideo(exercise.name, day.exercises);
          return (
            <li
              key={exercise.id}
              className="flex items-center gap-3.5 border-b border-line px-4 py-4"
            >
              <ExerciseThumb
                name={exercise.name}
                formVideoUrl={form.url}
                formVideoPending={form.pending}
              />
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold leading-snug">{exercise.name}</h2>
                <p className="mt-1 text-sm text-muted">
                  {plannedSetLine({
                    sets: exercise.sets,
                    reps: exercise.reps,
                    restSeconds: exercise.restSeconds,
                    logMode: exercise.logMode,
                    name: exercise.name,
                  })}
                </p>
                <WatchFormInline url={form.url} pending={form.pending} />
              </div>
            </li>
          );
        })}
      </ol>

      {draft ? (
        <div className="sticky bottom-28 z-10 mt-auto border-t border-line bg-background/95 px-4 py-3 pr-20 backdrop-blur">
          <Link
            href={`/training/log/${draft.id}`}
            className="touch-target flex w-full items-center justify-center rounded-full bg-accent text-base font-semibold text-black"
          >
            Continue
          </Link>
        </div>
      ) : (
        <form
          action={startSessionAction}
          className="sticky bottom-28 z-10 mt-auto border-t border-line bg-background/95 px-4 py-3 pr-20 backdrop-blur"
        >
          <input type="hidden" name="programDayId" value={day.id} />
          <button
            type="submit"
            className="touch-target w-full rounded-full bg-accent text-base font-semibold text-black"
          >
            {startLabel}
          </button>
        </form>
      )}
    </main>
  );
}
