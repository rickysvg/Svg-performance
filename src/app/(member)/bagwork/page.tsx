import Link from "next/link";
import { RoundTimerButton } from "@/components/timer/RoundTimerButton";
import { requireUser } from "@/lib/session";
import { BAG_WORKOUTS } from "@/lib/bagwork";
import { listCustomBagWorkouts } from "@/lib/bagwork-store";

export default async function BagworkPage() {
  const user = await requireUser();
  const custom = await listCustomBagWorkouts(user.id);

  return (
    <main className="space-y-6">
      <div>
        <div className="flex gap-1" aria-hidden>
          <span className="block h-0.5 w-6 rounded-full bg-accent" />
          <span className="block h-0.5 w-2 rounded-full bg-signal" />
        </div>
        <h1 className="font-display mt-2 text-3xl uppercase tracking-wide">Bagwork</h1>
        <p className="mt-1 text-sm text-muted">
          Pick a bag workout. Rounds are yours to set. This is separate from the strength week.
        </p>
      </div>

      <RoundTimerButton label="Start rounds" />

      <section className="space-y-2" data-bagwork-picker>
        {BAG_WORKOUTS.map((workout) => (
          <Link
            key={workout.slug}
            href={`/bagwork/${workout.slug}`}
            className="block rounded-2xl border border-line bg-card px-4 py-3 hover:border-accent"
          >
            <span className="font-display block text-lg uppercase leading-tight tracking-wide">
              {workout.name}
            </span>
            <span className="mt-1 block text-sm text-muted">{workout.recommendation}</span>
          </Link>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-lg">Your workouts</h2>
          <Link href="/bagwork/new" className="text-sm text-accent underline">
            Create
          </Link>
        </div>
        {custom.length === 0 ? (
          <p className="rounded-2xl border border-line bg-card px-4 py-3 text-sm text-muted">
            No custom workouts yet. Name one, describe it, and tap the body map.
          </p>
        ) : (
          <ul className="space-y-2" data-custom-bag-list>
            {custom.map((workout) => (
              <li key={workout.id}>
                <Link
                  href={`/bagwork/saved/${workout.id}`}
                  className="block rounded-2xl border border-line bg-card px-4 py-3 hover:border-accent"
                >
                  <span className="font-display block text-lg uppercase leading-tight tracking-wide">
                    {workout.name}
                  </span>
                  {workout.description ? (
                    <span className="mt-1 block text-sm text-muted">{workout.description}</span>
                  ) : (
                    <span className="mt-1 block text-sm text-muted">Custom bag workout</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
