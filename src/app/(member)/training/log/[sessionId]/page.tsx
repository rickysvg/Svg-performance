import { notFound } from "next/navigation";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { getWorkoutSessionForUser } from "@/lib/workouts";
import { WorkoutLogForm } from "@/components/training/WorkoutLogForm";
import { DifficultyRatingForm } from "@/components/training/DifficultyRatingForm";

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

  return (
    <main className="space-y-6">
      {promptRating ? (
        <DifficultyRatingForm
          workoutId={session.id}
          current={session.difficultyRating}
          celebrate={query.celebrate}
        />
      ) : null}
      <WorkoutLogForm session={session} />
    </main>
  );
}
