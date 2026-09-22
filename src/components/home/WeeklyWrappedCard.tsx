import Link from "next/link";
import type { WeeklyWrapped } from "@/lib/wrapped";

export function WeeklyWrappedCard({ wrap }: { wrap: WeeklyWrapped }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Weekly wrap</p>
          <h2 className="mt-1 text-lg font-semibold">Last 7 days</h2>
        </div>
        <Link href="/progress#personal-records" className="text-sm text-accent underline">
          PRs
        </Link>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted">Days trained</dt>
          <dd className="text-xl font-semibold">{wrap.daysTrained}</dd>
        </div>
        <div>
          <dt className="text-muted">Workouts logged</dt>
          <dd className="text-xl font-semibold">{wrap.workoutsLogged}</dd>
        </div>
        <div>
          <dt className="text-muted">Meals logged</dt>
          <dd className="text-xl font-semibold">{wrap.mealsLogged}</dd>
        </div>
        <div>
          <dt className="text-muted">Lessons completed</dt>
          <dd className="text-xl font-semibold">{wrap.lessonsCompleted}</dd>
        </div>
      </dl>
      <p className="mt-3 text-sm text-muted">
        {wrap.ratedWorkouts > 0
          ? `Average rated feel: ${wrap.avgDifficultyLabel} (${wrap.avgDifficulty} of 5).`
          : "No difficulty ratings in this window yet."}
      </p>
      <p className="mt-2 text-xs text-muted">{wrap.copy}</p>
    </section>
  );
}
