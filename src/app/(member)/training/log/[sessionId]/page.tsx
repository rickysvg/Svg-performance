import { notFound } from "next/navigation";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { getWorkoutSessionForUser } from "@/lib/workouts";
import { WorkoutLogForm } from "@/components/training/WorkoutLogForm";

export default async function WorkoutLogPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const user = await requireUser();
  const { sessionId } = await params;

  let session;
  try {
    session = await getWorkoutSessionForUser(sessionId, user.id);
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  return (
    <main className="space-y-6">
      <WorkoutLogForm session={session} />
    </main>
  );
}
