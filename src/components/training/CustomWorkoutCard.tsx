import Link from "next/link";
import { exerciseCountLabel } from "@/lib/my-workout-plan";
import type { DayPlanView } from "@/lib/my-workouts";

export function CustomWorkoutCard({ plan }: { plan: DayPlanView }) {
  const href = plan.draftId ? `/training/log/${plan.draftId}` : `/training/my-workouts/day/${plan.id}`;
  const cta = plan.draftId ? "Resume" : plan.complete ? "Start again" : "Start";
  return (
    <article
      data-custom-session={plan.id}
      data-custom-mode={plan.mode}
      className="rounded-2xl border border-line bg-card p-5"
    >
      <p className="font-display text-xs uppercase tracking-wide text-accent">
        {plan.mode === "replace" ? "Your workout" : "Extra session"}
        {plan.complete ? " · Done" : ""}
      </p>
      <h3 className="mt-1 text-lg leading-tight">{plan.name}</h3>
      <p className="mt-1 text-sm text-muted">
        {exerciseCountLabel(plan.exerciseCount)}
        {plan.exerciseNames.length > 0 ? ` · ${plan.exerciseNames.slice(0, 3).join(" · ")}` : ""}
      </p>
      <Link
        href={href}
        data-start-custom
        className="touch-target mt-3 inline-flex w-full items-center justify-center rounded-full bg-accent font-semibold text-black"
      >
        {cta}
      </Link>
    </article>
  );
}
