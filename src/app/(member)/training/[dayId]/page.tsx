import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoBadge } from "@/components/DemoBadge";
import { requireUser } from "@/lib/session";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { getProgramDayById } from "@/lib/programs";
import { listDraftSessionsForUser } from "@/lib/workouts";
import { scaleBandFromPrefs, scaleCopy, scaleProgramDay } from "@/lib/training-scale";
import { DEMO_PROGRAM_SLUG, DEMO_SKILL_PROGRAM_SLUG } from "@/lib/programs";
import { isPlyoStrengthDay } from "@/lib/mesocycle";
import { ExerciseThumb } from "@/components/training/ExerciseThumb";
import { EquipmentRow } from "@/components/training/EquipmentRow";
import { DaySessionMeta } from "@/components/training/DaySessionMeta";
import { SessionDetails } from "@/components/training/SessionDetails";
import { startSessionAction } from "@/app/actions/workouts";
import {
  equipmentForExercises,
  estimateSessionMinutes,
  plannedSetLine,
  sessionKindLabel,
} from "@/lib/exercise-media";
import { lookupFormVideo, showFormVideoPending } from "@/lib/form-videos";
import { listExerciseNotesForUser } from "@/lib/exercise-notes";
import { ExerciseNotepad } from "@/components/training/ExerciseNotepad";
import { CoachCredit } from "@/components/training/CoachCredit";
import { BagFocusList } from "@/components/training/BagFocusList";
import { RirHint } from "@/components/training/RirHint";
import { hasRirCue } from "@/lib/rir";
import { isDeloadWeek, DELOAD_LABEL } from "@/lib/training-cycle";
import { BikeZoneNote } from "@/components/training/BikeZoneNote";
import { bikeZoneForDayNumber } from "@/lib/train-extras";
import { plyoBlockFor, PLYO_MINUTES } from "@/lib/training-emphasis";

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

  const drafts = await listDraftSessionsForUser(user.id);
  const draft = drafts.find((session) => session.programDayId === day.id);
  const equipment = equipmentForExercises(day.exercises.map((exercise) => exercise.name));
  const minutes = estimateSessionMinutes(day.exercises);
  const kind = sessionKindLabel({ title: day.title, focus: day.focus });
  const startLabel = draft ? "Continue" : "Start Now";
  const tz = await timeZoneForUser(user.id, profile?.timeZone ?? null);
  const deload = isDeloadWeek(new Date(), tz);
  const zone = bikeZoneForDayNumber(day.dayNumber);
  const liftDay = day.program.slug === DEMO_PROGRAM_SLUG && isPlyoStrengthDay(day.dayNumber);
  const plyo = liftDay ? plyoBlockFor(profile?.trainingEmphasis) : [];
  const notes = await listExerciseNotesForUser(user.id, {
    exerciseNames: day.exercises.map((exercise) => exercise.name),
    programDayId: day.id,
  });
  const firstRir = day.exercises.find((exercise) => hasRirCue(exercise.loadText))?.id;

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

      <section className="space-y-4 px-4 pb-4 pt-3" data-session-phase="first">
        <p className="font-display text-xs uppercase tracking-wide text-accent">First</p>
        <div>
          <h1 className="text-2xl leading-tight">{day.title}</h1>
          <p className="mt-1 text-sm text-muted">{day.focus}</p>
          <p className="font-display mt-2 text-xs uppercase tracking-wide text-accent">
            {scaleCopy(
              scaleBandFromPrefs({
                experienceLevel: profile?.experienceLevel,
                competitionStatus: profile?.competitionStatus,
              }),
              day.program.slug === DEMO_SKILL_PROGRAM_SLUG ? day.dayNumber : undefined,
            )}
          </p>
        </div>

        <DaySessionMeta
          kind={kind}
          minutes={minutes}
          exerciseCount={day.exercises.length}
        />

        {deload ? (
          <p className="rounded-2xl bg-accent px-4 py-3 text-sm text-black">{DELOAD_LABEL}</p>
        ) : null}

        {draft ? (
          <Link
            href={`/training/log/${draft.id}`}
            className="touch-target flex w-full items-center justify-center rounded-full bg-accent text-base text-black"
          >
            Continue
          </Link>
        ) : (
          <form action={startSessionAction}>
            <input type="hidden" name="programDayId" value={day.id} />
            <button
              type="submit"
              className="touch-target w-full rounded-full bg-accent text-base text-black"
            >
              {startLabel}
            </button>
          </form>
        )}

        <SessionDetails>
          <Link href="/mobility/daily-warmup/play" className="block rounded-2xl border border-line px-4 py-3">
            <p className="font-display text-xs uppercase tracking-wide text-accent">Warm-up</p>
            <p className="font-semibold">Dynamic warm-up · 3–4 min</p>
          </Link>
          {zone ? <BikeZoneNote zone={zone} /> : null}
          {plyo.length > 0 ? (
            <div className="rounded-2xl border border-line px-4 py-3 text-sm">
              <p className="font-display text-xs uppercase tracking-wide text-accent">
                Plyo / power · {PLYO_MINUTES}
              </p>
              <ul className="mt-2 space-y-1">
                {plyo.map((drill) => (
                  <li key={drill.name}>
                    {drill.name} · {drill.prescription}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <EquipmentRow chips={equipment} />
        </SessionDetails>
      </section>

      <section data-session-phase="next" className="flex-1">
        <p className="px-4 pb-2 font-display text-xs uppercase tracking-wide text-accent">Next</p>
        <ol className="border-t border-line pb-32">
          {day.exercises.map((exercise, index) => {
            const form = lookupFormVideo(exercise.name, day.exercises);
            const planned = plannedSetLine({
              sets: exercise.sets,
              reps: exercise.reps,
              restSeconds: exercise.restSeconds,
              logMode: exercise.logMode,
              name: exercise.name,
              loadText: exercise.loadText,
            });
            return (
              <li
                key={exercise.id}
                {...(index === 0 ? { "data-first-controls": "" } : {})}
                className="flex items-start gap-3.5 border-b border-line px-4 py-4"
              >
                <ExerciseThumb
                  name={exercise.name}
                  formVideoUrl={form.url}
                  formVideoPending={form.pending}
                />
                <div className="min-w-0 flex-1">
                  <h2 className="leading-snug">{exercise.name}</h2>
                  <CoachCredit name={exercise.name} />
                  <p className="mt-1 text-sm text-muted">{planned}</p>
                  {exercise.id === firstRir ? <RirHint /> : null}
                  <BagFocusList notes={exercise.notes} />
                  {showFormVideoPending(form) ? (
                    <p className="mt-2 text-xs text-muted">Video pending coach review</p>
                  ) : null}
                  <ExerciseNotepad
                    exerciseName={exercise.name}
                    programDayId={day.id}
                    workoutId={draft?.id ?? ""}
                    logMode={exercise.logMode}
                    plannedLine={planned}
                    note={notes[exercise.name]}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section data-session-phase="finish" className="px-4 pb-4">
        <p className="font-display text-xs uppercase tracking-wide text-accent">Finish</p>
        <Link href="/mobility" className="mt-2 block rounded-2xl border border-line px-4 py-3">
          <p className="font-semibold">Mobility / cooldown</p>
          <p className="mt-1 text-sm text-muted">Hips, splits, neck, and the long holds after you train.</p>
        </Link>
      </section>

      {draft ? (
        <div
          data-start-bar
          className="sticky bottom-0 z-10 mt-auto border-t border-line bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur"
        >
          <Link
            href={`/training/log/${draft.id}`}
            className="touch-target flex w-full items-center justify-center rounded-full bg-accent text-base text-black"
          >
            Continue
          </Link>
        </div>
      ) : (
        <form
          action={startSessionAction}
          data-start-bar
          className="sticky bottom-0 z-10 mt-auto border-t border-line bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur"
        >
          <input type="hidden" name="programDayId" value={day.id} />
          <button
            type="submit"
            className="touch-target w-full rounded-full bg-accent text-base text-black"
          >
            {startLabel}
          </button>
        </form>
      )}
    </main>
  );
}
