import Link from "next/link";
import { exerciseCountLabel } from "@/lib/my-workout-plan";
import type { DayPlanView } from "@/lib/my-workouts";

export function CustomWorkoutCard({ plan }: { plan: DayPlanView }) {
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
      <h3 className="mt-1 text-lg normal-case leading-tight">{plan.name}</h3>
      <p className="mt-1 text-sm text-muted">
        {exerciseCountLabel(plan.exerciseCount)}
        {plan.exerciseNames.length > 0 ? ` · ${plan.exerciseNames.slice(0, 3).join(" · ")}` : ""}
      </p>
      {plan.draftId && !plan.complete ? (
        <Link
          data-testid={`training-resume-custom-${plan.id}`}
          href={`/training/log/${plan.draftId}`}
          data-resume-plan={plan.id}
          className="touch-target mt-3 inline-flex w-full items-center justify-center rounded-full bg-accent text-sm font-semibold text-black"
        >
          Resume
        </Link>
      ) : null}
      <Link
        data-testid={`training-view-custom-${plan.id}`}
        href={`/training/my-workouts/day/${plan.id}`}
        data-preview-custom
        className="touch-target mt-3 inline-flex w-full items-center justify-center rounded-full border border-line text-sm font-semibold"
      >
        View
      </Link>
    </article>
  );
}
