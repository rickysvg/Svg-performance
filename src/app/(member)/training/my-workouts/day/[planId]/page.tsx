import Link from "next/link";
import { PendingWorkoutLink } from "@/components/training/PendingWorkoutControl";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getDayPlanForUser } from "@/lib/my-workouts";
import { exerciseCountLabel } from "@/lib/my-workout-plan";

/**
 * Read-only look at an applied workout. Opening this page does not create
 * a session, draft, or running timer. Start and Resume are the only controls
 * that do.
 */
export default async function DayPlanPreviewPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const user = await requireUser();
  const { planId } = await params;
  const plan = await getDayPlanForUser(user.id, planId);
  if (!plan) notFound();
  const startHref = plan.draftId
    ? `/training/log/${plan.draftId}`
    : `/training/my-workouts/day/${plan.id}/start`;
  const verb = plan.draftId ? "Resume" : plan.complete ? "Start again" : "Start";

  return (
    <main className="space-y-4" data-day-plan-preview>
      <Link href="/training" className="text-sm text-accent underline-offset-4 hover:underline">
        Training
      </Link>
      <p className="font-display text-xs uppercase tracking-wide text-accent">
        {plan.mode === "replace" ? "Your workout" : "Extra session"}
        {plan.complete ? " · Done" : ""}
      </p>
      <h1 className="text-2xl normal-case">{plan.name}</h1>
      <p className="text-sm text-muted">{exerciseCountLabel(plan.exerciseCount)}</p>
      <ul className="space-y-2">
        {plan.exercises.map((exercise, index) => (
          <li key={`${exercise.name}-${index}`} className="rounded-2xl border border-line bg-card px-4 py-3">
            <p className="font-medium">{exercise.name}</p>
            <p className="text-sm text-muted">
              {exercise.sets} × {exercise.reps}
              {exercise.loadText ? ` · ${exercise.loadText}` : ""}
            </p>
          </li>
        ))}
      </ul>
      <PendingWorkoutLink
        href={startHref}
        label={verb}
        prefetch={false}
        data-start-custom
        data-prime-coach-audio
        className="touch-target flex w-full items-center justify-center rounded-full bg-accent font-semibold text-black"
      />
    </main>
  );
}
