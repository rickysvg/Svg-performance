import Link from "next/link";

export default function WorkoutNotFound() {
  return (
    <main className="space-y-4 py-10">
      <p className="font-display text-xs uppercase tracking-[0.06em]">
        Workout
      </p>
      <h1 className="text-3xl">Workout not found</h1>
      <p className="text-sm text-muted">
        That session does not exist, or it belongs to another member. Nothing
        here is shared across accounts.
      </p>
      <Link
        href="/training"
        className="touch-target inline-flex items-center rounded-full bg-accent px-5 text-sm text-black"
      >
        Back to Train
      </Link>
    </main>
  );
}
