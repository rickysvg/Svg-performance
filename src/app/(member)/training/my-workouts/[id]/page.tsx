import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { ForbiddenError } from "@/lib/errors";
import { getSavedWorkoutForUser } from "@/lib/my-workouts";
import { normalizeWeightAccess } from "@/lib/weight-access";
import { SavedWorkoutEditor } from "@/components/training/SavedWorkoutEditor";

export default async function EditSavedWorkoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const profile = await getProfileForUser(user.id);
  let workout: Awaited<ReturnType<typeof getSavedWorkoutForUser>>;
  try {
    workout = await getSavedWorkoutForUser(id, user.id);
  } catch (error) {
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }
  return (
    <main className="space-y-4">
      <Link href="/training/my-workouts" className="text-sm text-accent underline-offset-4 hover:underline">
        My Workouts
      </Link>
      <h1 className="text-2xl">Edit workout</h1>
      <SavedWorkoutEditor
        id={workout.id}
        name={workout.name}
        exercises={workout.exercises}
        weightAccess={normalizeWeightAccess(profile?.weightAccess)}
      />
    </main>
  );
}
