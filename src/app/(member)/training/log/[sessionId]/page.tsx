import { notFound } from "next/navigation";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { getPreviousLoadsForUser, getWorkoutSessionForUser } from "@/lib/workouts";
import { getWorkoutHrForLoggedSession, hrSourceLabel } from "@/lib/heart";
import { WorkoutLogForm } from "@/components/training/WorkoutLogForm";
import { DifficultyRatingForm } from "@/components/training/DifficultyRatingForm";
import { HrWorkoutForm } from "@/components/heart/HrWorkoutForm";

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

  let session;
  try {
    session = await getWorkoutSessionForUser(sessionId, user.id);
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  const promptRating =
    session.status === "complete" &&
    (query.rate === "1" || !session.difficultyRating);
  const hrLog = await getWorkoutHrForLoggedSession(session.id, user.id);
  const performed = new Date(session.performedAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const startedInput = `${performed.getFullYear()}-${pad(performed.getMonth() + 1)}-${pad(performed.getDate())}T${pad(performed.getHours())}:${pad(performed.getMinutes())}`;

  return (
    <main className="space-y-6">
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
            <h2 className="font-semibold">Workout heart rate</h2>
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
        session={session}
        previousLoads={await getPreviousLoadsForUser(
          user.id,
          session.sets.map((set) => set.exerciseName),
          session.id,
        )}
      />
    </main>
  );
}
