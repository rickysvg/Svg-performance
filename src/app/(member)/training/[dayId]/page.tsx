import Link from "next/link";
import { notFound } from "next/navigation";
import { memberFacingTitle } from "@/lib/member-copy";
import { requireUser } from "@/lib/session";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import { getProgramDayById } from "@/lib/programs";
import { listResumableSessionsForUser, sessionMatchesPlannedDay } from "@/lib/workouts";
import { openLogsByProgramDay } from "@/lib/today-start";
import { calendarPlanDoses } from "@/lib/calendar";
import { dayKey } from "@/lib/timezone";
import { ContinueWorkoutButton } from "@/components/training/ContinueWorkoutButton";
import { scaleBandFromPrefs, scaleCopy, scaleProgramDay } from "@/lib/training-scale";
import { activePlanWeekIndex, campPlanWeekIndex } from "@/lib/fight-camp";
import { DEMO_PROGRAM_SLUG, DEMO_SKILL_PROGRAM_SLUG } from "@/lib/programs";
import { isPlyoStrengthDay } from "@/lib/mesocycle";
import { ExerciseThumb } from "@/components/training/ExerciseThumb";
import { EquipmentRow } from "@/components/training/EquipmentRow";
import { DaySessionMeta } from "@/components/training/DaySessionMeta";
import { SessionDetails } from "@/components/training/SessionDetails";
import { halvedSetCount } from "@/lib/recovery-ease";
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
import { bagFocusLines } from "@/lib/bag-themes";
import { MethodExplainer } from "@/components/training/MethodExplainer";
import { RirHint } from "@/components/training/RirHint";
import { hasRirCue } from "@/lib/rir";
import { isDeloadWeekIndex, DELOAD_LABEL } from "@/lib/training-cycle";
import { BikeZoneNote } from "@/components/training/BikeZoneNote";
import { bikeZoneForDayNumber } from "@/lib/train-extras";
import { beginnerPlyoBlock, floorPlyoBlock, plyoBlockFor, PLYO_MINUTES } from "@/lib/training-emphasis";
import { normalizeWeightAccess } from "@/lib/weight-access";
import { WeightAccessToggle } from "@/components/training/WeightAccessToggle";
import { ExerciseCardMenu } from "@/components/training/ExerciseCardMenu";
import { RemoveToast } from "@/components/training/RemoveToast";
import { listSwapsForDay } from "@/lib/exercise-swap-store";
import { listRemovalsForDay } from "@/lib/exercise-removal-store";
import { applySwapsToExercises, swapSlotsFor, trainingBlockKey } from "@/lib/exercise-swap";
import { omitRemovedSlots } from "@/lib/exercise-removal";
import { mobilityBookendsForSession } from "@/lib/mobility-train";
import { TrainDayMobility } from "@/components/training/TrainDayMobility";
import { RoundTimerButton } from "@/components/timer/RoundTimerButton";
import { bikeSessionForLogger, isBikeIntervalName } from "@/lib/bike-sessions";
import { textIsBikeWorkout, timerEntryModeFromText, type TimerEntryMode } from "@/lib/timer-session";

export default async function TrainingDayPage({
  params,
  searchParams,
}: {
  params: Promise<{ dayId: string }>;
  searchParams: Promise<{ half?: string }>;
}) {
  const user = await requireUser();
  const profile = await getProfileForUser(user.id);
  const { dayId } = await params;
  const { half } = await searchParams;
  const easedHalf = half === "1";
  const band = scaleBandFromPrefs({
    experienceLevel: profile?.experienceLevel,
    competitionStatus: profile?.competitionStatus,
  });
  const tz = await timeZoneForUser(user.id, profile?.timeZone ?? null);
  const now = new Date();
  const planned = await activePlanWeekIndex(user.id, now, tz, profile?.onboardingCompletedAt ?? null);
  const weekIndex = planned.weekIndex;
  const camp = planned.camp;
  const campWeek = camp && camp.weightClass.trim() ? campPlanWeekIndex(camp) : null;
  let day;
  try {
    const raw = await getProgramDayById(dayId);
    const weightAccess = normalizeWeightAccess(profile?.weightAccess);
    day = scaleProgramDay(raw, {
      band,
      programSlug: raw.program.slug,
      weightAccess,
      weekIndex,
      campPhase: camp?.phase ?? null,
    });
  } catch {
    notFound();
  }

  const [resumable, planByDay] = await Promise.all([
    listResumableSessionsForUser(user.id),
    calendarPlanDoses(user.id, now),
  ]);
  const open = openLogsByProgramDay(resumable, dayKey(now, tz), tz, planByDay).get(day.id);
  const openSession = open ? resumable.find((session) => session.id === open.id) : undefined;
  const matched =
    open && openSession && sessionMatchesPlannedDay(openSession, day) ? open : undefined;
  const draft = matched ? openSession : undefined;
  const swaps = await listSwapsForDay({
    userId: user.id,
    programSlug: day.program.slug,
    dayNumber: day.dayNumber,
  });
  const swapped = applySwapsToExercises(day.exercises, swaps, {
    sessionId: draft?.id,
    blockKey: trainingBlockKey(now, tz, profile?.onboardingCompletedAt ?? null, weekIndex),
    includePending: !draft,
  });
  const removals = await listRemovalsForDay({
    userId: user.id,
    programSlug: day.program.slug,
    dayNumber: day.dayNumber,
  });
  const omitted = omitRemovedSlots(day.exercises, swapped, removals, {
    sessionId: draft?.id,
    includePending: !draft,
  });
  const exercises = easedHalf
    ? omitted.shown.map((exercise) => ({ ...exercise, sets: halvedSetCount(exercise.sets) }))
    : omitted.shown;
  const startHref = `/training/${day.id}/start${easedHalf ? "?half=1" : ""}`;
  const slots = swapSlotsFor(omitted.programmed, omitted.shown);
  const equipment = equipmentForExercises(exercises.map((exercise) => exercise.name));
  const minutes = estimateSessionMinutes(exercises);
  const kind = sessionKindLabel({ title: day.title, focus: day.focus });
  const startLabel = matched?.partial ? "Continue" : matched ? "Resume" : "Start Now";
  const deload = campWeek == null && isDeloadWeekIndex(weekIndex);
  const zone = bikeZoneForDayNumber(day.dayNumber);
  const liftDay = day.program.slug === DEMO_PROGRAM_SLUG && isPlyoStrengthDay(day.dayNumber);
  const weightAccess = normalizeWeightAccess(profile?.weightAccess);
  const plyo = liftDay
    ? band === "beginner"
      ? beginnerPlyoBlock()
      : weightAccess === "none"
        ? floorPlyoBlock()
        : plyoBlockFor(profile?.trainingEmphasis)
    : [];
  const notes = await listExerciseNotesForUser(user.id, {
    exerciseNames: exercises.map((exercise) => exercise.name),
    programDayId: day.id,
  });
  const firstRir = exercises.find((exercise) => hasRirCue(exercise.loadText))?.id;
  const bookend = mobilityBookendsForSession({
    kind,
    title: day.title,
    subtitle: day.focus,
    label: day.title,
  });
  const bikeExercise = exercises.find((exercise) => isBikeIntervalName(exercise.name));
  const bikeCopy = textIsBikeWorkout(
    `${day.title} ${day.focus} ${exercises.map((exercise) => exercise.name).join(" ")}`,
  );
  const bikeSession = bikeExercise
    ? bikeSessionForLogger(bikeExercise.name, {
        reps: bikeExercise.reps,
        restSeconds: bikeExercise.restSeconds,
      })
    : bikeCopy
      ? bikeSessionForLogger("Assault bike intervals", {
          reps: exercises[0]?.reps,
          restSeconds: exercises[0]?.restSeconds,
        })
      : null;
  const entryMode: TimerEntryMode | null = bikeSession
    ? "bike"
    : timerEntryModeFromText(`${day.title} ${day.focus} ${exercises.map((exercise) => exercise.name).join(" ")}`);
  const roundMode = entryMode && entryMode !== "bike" ? entryMode : null;

  return (
    <main className="-mx-4 flex min-h-[calc(100dvh-10rem)] flex-col">
      <RemoveToast />
      <header className="flex items-center gap-2 px-4 pb-2">
        <Link
          href="/training"
          aria-label="Close"
          className="touch-target inline-flex items-center justify-center text-2xl leading-none text-foreground"
        >
          ×
        </Link>
        <p className="min-w-0 flex-1 truncate text-center text-sm text-muted">
          {memberFacingTitle(day.program.title)}
        </p>
        <RoundTimerButton
          mode={roundMode}
          bikeSession={bikeSession}
          bikeDayId={bikeSession ? day.id : null}
        />
      </header>

      <section className="space-y-4 px-4 pb-4 pt-3" data-session-phase="first">
        <p className="font-display text-xs uppercase tracking-wide text-accent">First</p>
        <div>
          <h1 className="text-2xl leading-tight">{memberFacingTitle(day.title)}</h1>
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
          exerciseCount={exercises.length}
        />
        <MethodExplainer />

        {deload ? (
          <p className="rounded-2xl bg-accent px-4 py-3 text-sm text-black">{DELOAD_LABEL}</p>
        ) : null}

        {matched?.partial ? (
          <div className="space-y-2">
            {matched.progress ? (
              <p data-session-progress className="text-sm font-semibold text-accent">
                {matched.progress}
              </p>
            ) : null}
            <ContinueWorkoutButton
              workoutId={matched.id}
              label="Continue"
              className="touch-target flex w-full items-center justify-center rounded-full bg-accent text-base text-black"
            />
          </div>
        ) : draft ? (
          <Link
            href={`/training/log/${draft.id}`}
            data-prime-coach-audio
            data-session-continue="draft"
            className="touch-target flex w-full items-center justify-center rounded-full bg-accent text-base text-black"
          >
            Resume
          </Link>
        ) : (
          <Link
            href={startHref}
            prefetch={false}
            data-prime-coach-audio
            className="touch-target flex w-full items-center justify-center rounded-full bg-accent text-base text-black"
          >
            {startLabel}
          </Link>
        )}

        <SessionDetails>
          <WeightAccessToggle access={weightAccess} nextPath={`/training/${day.id}`} />
          {bookend ? <TrainDayMobility bookend={bookend} /> : null}
          <Link href="/mobility/daily-warmup/play" className="block rounded-2xl border border-line px-4 py-3">
            <p className="font-display text-xs uppercase tracking-wide text-accent">Warm-up</p>
            <p className="font-semibold">Dynamic warm-up · 3–4 min</p>
          </Link>
          {zone && weightAccess === "gym" ? <BikeZoneNote zone={zone} /> : null}
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
          {exercises.map((exercise, index) => {
            const slot = slots[index];
            const form = lookupFormVideo(exercise.name, exercises);
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
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="leading-snug">{exercise.name}</h2>
                    <ExerciseCardMenu
                      programSlug={day.program.slug}
                      dayNumber={day.dayNumber}
                      programDayId={day.id}
                      originalName={slot?.programmedName ?? exercise.name}
                      currentName={exercise.name}
                      source={{
                        sets: exercise.sets,
                        reps: exercise.reps,
                        loadText: exercise.loadText ?? "",
                        restSeconds: exercise.restSeconds,
                        logMode: exercise.logMode,
                        notes: exercise.notes,
                      }}
                      weightAccess={weightAccess}
                      workoutSessionId={draft?.id}
                      canRemove={exercises.length > 1}
                    />
                  </div>
                  <CoachCredit name={exercise.name} />
                  <p className="mt-1 text-sm text-muted">{planned}</p>
                  {exercise.notes && !bagFocusLines(exercise.notes) ? (
                    <p className="mt-1 text-sm text-muted">{exercise.notes}</p>
                  ) : null}
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
            data-prime-coach-audio
            className="touch-target flex w-full items-center justify-center rounded-full bg-accent text-base text-black"
          >
            Continue
          </Link>
        </div>
      ) : (
        <div
          data-start-bar
          className="sticky bottom-0 z-10 mt-auto border-t border-line bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur"
        >
          <Link
            href={startHref}
            prefetch={false}
            data-prime-coach-audio
            className="touch-target flex w-full items-center justify-center rounded-full bg-accent text-base text-black"
          >
            {startLabel}
          </Link>
        </div>
      )}
    </main>
  );
}
