import Link from "next/link";
import { BagBodyMap } from "@/components/bagwork/BagBodyMap";
import { BagRoundSetup } from "@/components/bagwork/BagRoundSetup";
import type { BagworkView } from "@/lib/bagwork";

export function BagWorkoutDetail({ view }: { view: BagworkView }) {
  const workMinutes = Math.max(1, Math.round(view.suggested.workSeconds / 60));
  const restMinutes = Math.max(1, Math.round(view.suggested.restSeconds / 60));
  return (
    <main className="space-y-5">
      <div>
        <Link href="/bagwork" className="text-sm text-accent underline-offset-4 hover:underline">
          All bag workouts
        </Link>
        <div className="mt-3 flex gap-1" aria-hidden>
          <span className="block h-0.5 w-6 rounded-full bg-accent" />
          <span className="block h-0.5 w-2 rounded-full bg-signal" />
        </div>
        <h1 className="font-display mt-2 text-3xl uppercase tracking-wide">{view.name}</h1>
        {view.custom ? (
          <p className="mt-1 text-sm text-muted">Your workout. It stays on the picker.</p>
        ) : null}
      </div>

      <p className="rounded-2xl border border-line bg-card px-4 py-3 text-sm" data-bag-recommendation>
        {view.recommendation}
      </p>

      {view.description ? <p className="text-sm">{view.description}</p> : null}

      <ul className="space-y-2" data-bag-cues>
        {view.cues.map((cue) => (
          <li key={cue} className="rounded-2xl border border-line bg-card px-4 py-3 text-sm">
            {cue}
          </li>
        ))}
      </ul>

      <BagBodyMap regions={view.regions} side={view.side} />

      <BagRoundSetup
        workoutKey={view.key}
        rounds={view.suggested.rounds}
        workMinutes={workMinutes}
        restMinutes={restMinutes}
      />

      {view.custom ? (
        <Link href={`/bagwork/saved/${view.key.slice("saved:".length)}/edit`} className="inline-flex text-sm text-accent underline">
          Edit workout
        </Link>
      ) : null}
    </main>
  );
}
