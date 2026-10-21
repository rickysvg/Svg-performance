import { notFound } from "next/navigation";
import { deleteCustomBagWorkoutAction } from "@/app/actions/bagwork";
import { BagWorkoutDetail } from "@/components/bagwork/BagWorkoutDetail";
import { viewFromCustom } from "@/lib/bagwork";
import { getCustomBagWorkout } from "@/lib/bagwork-store";
import { requireUser } from "@/lib/session";

export default async function SavedBagWorkoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const row = await getCustomBagWorkout(user.id, id);
  if (!row) notFound();
  return (
    <div className="space-y-4">
      <BagWorkoutDetail view={viewFromCustom(row)} />
      <form action={deleteCustomBagWorkoutAction}>
        <input type="hidden" name="id" value={row.id} />
        <button type="submit" className="text-sm text-signal underline-offset-4 hover:underline">
          Delete workout
        </button>
      </form>
    </div>
  );
}
