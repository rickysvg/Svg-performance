import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { getNutritionEntryForUser, listSavedMealsForUser } from "@/lib/nutrition";
import { NutritionEntryForm } from "@/components/nutrition/NutritionEntryForm";
import { deleteNutritionEntryAction } from "@/app/actions/nutrition";

export default async function NutritionEntryPage({
  params,
}: {
  params: Promise<{ entryId: string }>;
}) {
  const user = await requireUser();
  const { entryId } = await params;
  let entry;
  try {
    entry = await getNutritionEntryForUser(entryId, user.id);
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }
  const savedMeals = await listSavedMealsForUser(user.id);

  return (
    <main className="space-y-6">
      <Link href="/nutrition" className="text-sm text-accent underline-offset-4 hover:underline">
        Back to nutrition
      </Link>
      <NutritionEntryForm savedMeals={savedMeals} entry={entry} />
      <form action={deleteNutritionEntryAction}>
        <input type="hidden" name="entryId" value={entry.id} />
        <button type="submit" className="text-sm text-danger underline-offset-4 hover:underline">
          Delete this entry
        </button>
      </form>
    </main>
  );
}
