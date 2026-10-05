import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { getOwnWorkoutSessionOrNull, getPreviousLoadsForUser } from "@/lib/workouts";
import { getWorkoutHrForLoggedSession, hrSourceLabel } from "@/lib/heart";
import { WorkoutLogForm } from "@/components/training/WorkoutLogForm";
import { DifficultyRatingForm } from "@/components/training/DifficultyRatingForm";
import { HrWorkoutForm } from "@/components/heart/HrWorkoutForm";
import { scaleBandFromPrefs, scaleProgramDay } from "@/lib/training-scale";
import { applyGymExerciseName, gymHistoryNames, rekeyGymRecord } from "@/lib/gym-exercise";
import { listExerciseNotesForUser } from "@/lib/exercise-notes";

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

  const session = await getOwnWorkoutSessionOrNull(sessionId, user.id);
  if (!session) {
    notFound();
  }

  const band = scaleBandFromPrefs({
    experienceLevel: profile?.experienceLevel,
    competitionStatus: profile?.competitionStatus,
  });
  const loggedSession = {
    ...session,
    sets: session.sets.map((set) => applyGymExerciseName(set, band)),
    programDay: session.programDay
      ? scaleProgramDay(session.programDay, {
          band,
          programSlug: session.programDay.program.slug,
        })
      : session.programDay,
  };
  const historyNames = gymHistoryNames([
    ...session.sets.map((set) => set.exerciseName),
    ...loggedSession.sets.map((set) => set.exerciseName),
    ...(session.programDay?.exercises.map((exercise) => exercise.name) ?? []),
    ...(loggedSession.programDay?.exercises.map((exercise) => exercise.name) ?? []),
  ]);
  const promptRating =
    session.status === "complete" &&
    (query.rate === "1" || !session.difficultyRating);
  const hrLog = await getWorkoutHrForLoggedSession(session.id, user.id);
  const performed = new Date(session.performedAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const startedInput = `${performed.getFullYear()}-${pad(performed.getMonth() + 1)}-${pad(performed.getDate())}T${pad(performed.getHours())}:${pad(performed.getMinutes())}`;

  return (
    <main className="space-y-6">
      {session.status === "complete" ? (
        <Link
          href={`/training/log/${session.id}/done`}
          className="touch-target flex items-center justify-center rounded-full bg-accent px-4 text-sm text-black"
        >
          Share workout card
        </Link>
      ) : null}
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
        previousLoads={rekeyGymRecord(
          await getPreviousLoadsForUser(user.id, historyNames, session.id),
          band,
        )}
        notes={rekeyGymRecord(
          await listExerciseNotesForUser(user.id, {
            exerciseNames: historyNames,
            programDayId: session.programDayId,
          }),
          band,
        )}
      />
    </main>
  );
}
