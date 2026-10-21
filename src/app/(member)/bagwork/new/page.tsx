import Link from "next/link";
import { CustomBagForm } from "@/components/bagwork/CustomBagForm";
import { requireUser } from "@/lib/session";

export default async function NewBagWorkoutPage() {
  await requireUser();
  return (
    <main className="space-y-5">
      <div>
        <Link href="/bagwork" className="text-sm text-accent underline-offset-4 hover:underline">
          All bag workouts
        </Link>
        <h1 className="font-display mt-2 text-3xl uppercase tracking-wide">Custom workout</h1>
        <p className="mt-1 text-sm text-muted">
          Name it, describe it, and tap the regions it emphasizes. It shows up on the picker.
        </p>
      </div>
      <CustomBagForm />
    </main>
  );
}
