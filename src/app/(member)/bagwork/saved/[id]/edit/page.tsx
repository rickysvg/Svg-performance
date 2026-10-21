import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomBagForm } from "@/components/bagwork/CustomBagForm";
import { getCustomBagWorkout } from "@/lib/bagwork-store";
import { requireUser } from "@/lib/session";

export default async function EditBagWorkoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const row = await getCustomBagWorkout(user.id, id);
  if (!row) notFound();
  return (
    <main className="space-y-5">
      <div>
        <Link href={`/bagwork/saved/${row.id}`} className="text-sm text-accent underline-offset-4 hover:underline">
          Back to {row.name}
        </Link>
        <h1 className="font-display mt-2 text-3xl uppercase tracking-wide">Edit workout</h1>
      </div>
      <CustomBagForm id={row.id} name={row.name} description={row.description} regions={row.regions} />
    </main>
  );
}
