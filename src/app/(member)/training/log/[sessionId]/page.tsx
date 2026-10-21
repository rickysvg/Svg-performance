import Link from "next/link";
import { resumeWorkoutAction } from "@/app/actions/workouts";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getProfileForUser, timeZoneForUser } from "@/lib/profile";
import {
  getOwnWorkoutSessionOrNull,
  getPreviousLoadsForSlots,
  getPreviousLoadsForUser,
  reopenEmptyCompletion,
} from "@/lib/workouts";
import { getWorkoutHrForLoggedSession, hrSourceLabel } from "@/lib/heart";
import { WorkoutLogForm } from "@/components/training/WorkoutLogForm";
import { DifficultyRatingForm } from "@/components/training/DifficultyRatingForm";
import { HrWorkoutForm } from "@/components/heart/HrWorkoutForm";
import { scaleBandFromPrefs, scaleProgramDay } from "@/lib/training-scale";
import { activePlanWeekIndex } from "@/lib/fight-camp";
import { applyGymExerciseName, gymHistoryNames, rekeyGymRecord } from "@/lib/gym-exercise";
import { listExerciseNotesForUser } from "@/lib/exercise-notes";
import { alignWorkoutWithSwaps, listSwapsForDay } from "@/lib/exercise-swap-store";
import { listRemovalsForDay, listRemovalsForSession } from "@/lib/exercise-removal-store";
import {
  activeRemovals,
  hiddenNamesForRemovals,
  omitRemovedSlots,
} from "@/lib/exercise-removal";
import {
  applySwapsToExercises,
  retiredNamesFromSwaps,
  swapSlotsFor,
  trainingBlockKey,
} from "@/lib/exercise-swap";
import { normalizeWeightAccess } from "@/lib/weight-access";
import { resolveAiCoach } from "@/lib/coaches";
import { DeleteWorkoutButton } from "@/components/training/DeleteWorkoutButton";

export default async function WorkoutLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ celebrate?: string; rate?: string }>;
}) {
  const user = await requireUser();
  const { sessionId } = await params;
  const query = await searchParams;
  const profile = await getProfileForUser(user.id);

  const loaded = await getOwnWorkoutSessionOrNull(sessionId, user.id);
  if (!loaded) {
    notFound();
  }
  const opened = await reopenEmptyCompletion(loaded);
  const tz = await timeZoneForUser(user.id, profile?.timeZone ?? null);
  const scale = {
    experienceLevel: profile?.experienceLevel,
    competitionStatus: profile?.competitionStatus,
    weightAccess: profile?.weightAccess,
  };
  if (opened.programDay && opened.status !== "complete") {
    await alignWorkoutWithSwaps(opened, scale, tz, profile?.onboardingCompletedAt ?? null);
  }
  const session = (await getOwnWorkoutSessionOrNull(sessionId, user.id)) ?? opened;
  const band = scaleBandFromPrefs(scale);
  const planned = await activePlanWeekIndex(
    user.id,
    new Date(),
    tz,
    profile?.onboardingCompletedAt ?? null,
  );
  const scaledDay = session.programDay
    ? scaleProgramDay(
        {
          ...session.programDay,
          exercises: [...session.programDay.exercises].sort((a, b) => a.sortOrder - b.sortOrder),
        },
        {
          band,
          programSlug: session.programDay.program.slug,
          weightAccess: profile?.weightAccess,
          weekIndex: planned.weekIndex,
          campPhase: planned.camp?.phase ?? null,
        },
      )
    : null;
  const swaps =
    session.programDay && scaledDay
      ? await listSwapsForDay({
          userId: user.id,
          programSlug: session.programDay.program.slug,
          dayNumber: session.programDay.dayNumber,
        })
      : [];
  const swappedExercises = scaledDay
    ? applySwapsToExercises(scaledDay.exercises, swaps, {
        sessionId: session.id,
        blockKey: trainingBlockKey(
          new Date(),
          tz,
          profile?.onboardingCompletedAt ?? null,
          planned.weekIndex,
        ),
        includePending: false,
      })
    : [];
  const removals = session.programDay
    ? await listRemovalsForDay({
        userId: user.id,
        programSlug: session.programDay.program.slug,
        dayNumber: session.programDay.dayNumber,
      })
    : await listRemovalsForSession(user.id, session.id);
  const removalScope = { sessionId: session.id, includePending: false };
  const omitted = scaledDay
    ? omitRemovedSlots(scaledDay.exercises, swappedExercises, removals, removalScope)
    : { programmed: [], shown: [] };
  const shownExercises = omitted.shown;
  const swapSlots = swapSlotsFor(omitted.programmed, omitted.shown);
  const removedNames = hiddenNamesForRemovals(
    activeRemovals(removals, removalScope),
    shownExercises.map((exercise) => exercise.name),
  );
  const removed = new Set(removedNames);
  const shownNames = new Set(shownExercises.map((exercise) => exercise.name));
  const loggedSets = session.sets
    .filter((set) => !removed.has(set.exerciseName))
    .map((set) => (shownNames.has(set.exerciseName) ? set : applyGymExerciseName(set, band)));
  const loggedSession = {
    ...session,
    sets: loggedSets,
    programDay:
      session.programDay && scaledDay
        ? {
            ...scaledDay,
            exercises: shownExercises,
          }
        : session.programDay,
  };
  const historyNames = gymHistoryNames([
    ...session.sets.map((set) => set.exerciseName),
    ...loggedSets.map((set) => set.exerciseName),
    ...(session.programDay?.exercises.map((exercise) => exercise.name) ?? []),
    ...shownExercises.map((exercise) => exercise.name),
  ]);
  const promptRating =
    session.status === "complete" &&
    (query.rate === "1" || !session.difficultyRating);
  const hrLog = await getWorkoutHrForLoggedSession(session.id, user.id);
  const performed = new Date(session.performedAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const startedInput = `${performed.getFullYear()}-${pad(performed.getMonth() + 1)}-${pad(performed.getDate())}T${pad(performed.getHours())}:${pad(performed.getMinutes())}`;
  const [slotLoads, namedLoads, exerciseNotes] = await Promise.all([
    getPreviousLoadsForSlots(
      user.id,
      [...session.sets, ...loggedSession.sets].map((set) => ({
        exerciseName: set.exerciseName,
        prescriptionKey: set.prescriptionKey,
      })),
      session.id,
    ),
    getPreviousLoadsForUser(user.id, historyNames, session.id),
    listExerciseNotesForUser(user.id, {
      exerciseNames: historyNames,
      programDayId: session.programDayId,
    }),
  ]);
  const previousLoads = {
    ...rekeyGymRecord(namedLoads, band),
    ...rekeyGymRecord(slotLoads, band),
  };
  const notes = rekeyGymRecord(exerciseNotes, band);

  return (
    <main data-hypercar-logger className="space-y-6">
      <header className="hc-panel hc-carbon flex items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="hc-kicker">Logger</p>
          <p className="mt-1 font-display text-xl">
            {session.status === "complete" ? "Saved" : "Live session"}
          </p>
        </div>
        <p className="font-telemetry text-xs uppercase tracking-[0.16em] text-[#CBF805]">
          {session.status === "complete" ? "Hold" : "Armed"}
        </p>
      </header>
      {session.status === "complete" ? (
        <div className="space-y-2">
          <form action={resumeWorkoutAction}>
            <input type="hidden" name="workoutId" value={session.id} />
            <button
              type="submit"
              data-resume-workout="1"
              className="touch-target flex w-full items-center justify-center rounded-full bg-accent px-4 text-sm text-black"
            >
              Resume workout
            </button>
          </form>
          <Link
            href={`/training/log/${session.id}/done`}
            className="touch-target flex items-center justify-center rounded-full border border-line px-4 text-sm"
          >
            Share workout card
          </Link>
          <DeleteWorkoutButton workoutId={session.id} />
        </div>
      ) : (
        <DeleteWorkoutButton workoutId={session.id} />
      )}
      {promptRating ? (
        <DifficultyRatingForm
          workoutId={session.id}
          current={session.difficultyRating}
          celebrate={query.celebrate}
        />
      ) : null}
      {session.status === "complete" ? (
        hrLog ? (
          <section className="rounded-2xl border border-line bg-card p-5">
            <h2>Workout heart rate</h2>
            <p className="mt-1 text-lg font-semibold">
              {hrLog.avgBpm} avg · {hrLog.maxBpm} max
            </p>
            <p className="mt-1 text-sm text-muted">{hrSourceLabel(hrLog.source)}</p>
          </section>
        ) : (
          <HrWorkoutForm workoutSessionId={session.id} defaultStartedAt={startedInput} />
        )
      ) : null}
      <WorkoutLogForm
        session={loggedSession}
        previousLoads={previousLoads}
        notes={notes}
        coachId={resolveAiCoach(profile?.aiCoachId).id}
        coachMotivation={profile?.coachMotivation !== false}
        timeZone={tz}
        swap={{
          programSlug: session.programDay?.program.slug ?? "",
          dayNumber: session.programDay?.dayNumber ?? 0,
          weightAccess: normalizeWeightAccess(profile?.weightAccess),
          slots: swapSlots,
          retiredNames: retiredNamesFromSwaps(
            swaps,
            shownExercises.map((exercise) => exercise.name),
          ),
          removedNames,
        }}
      />
    </main>
  );
}
