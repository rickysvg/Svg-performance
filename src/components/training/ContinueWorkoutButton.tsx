import { continuePartialWorkoutAction } from "@/app/actions/workouts";
import { PendingSubmitButton } from "@/components/training/PendingWorkoutControl";

export function ContinueWorkoutButton({
  workoutId,
  label,
  className,
  testId,
  startToday = false,
  nextSession = false,
  planId,
  primary = false,
}: {
  workoutId: string;
  label: string;
  className: string;
  testId?: string;
  startToday?: boolean;
  nextSession?: boolean;
  planId?: string;
  /** Training's main Resume. The whole bar posts to the logger. */
  primary?: boolean;
}) {
  return (
    <form action={continuePartialWorkoutAction} className="relative z-30 block w-full scroll-mt-20">
      <input type="hidden" name="workoutId" value={workoutId} />
      <PendingSubmitButton
        label={label}
        data-resume-workout
        data-session-continue="partial"
        data-prime-coach-audio
        data-primary-train-cta={primary ? "" : undefined}
        data-start-today={startToday ? "" : undefined}
        data-next-session={nextSession ? "" : undefined}
        data-testid={testId}
        data-resume-plan={planId}
        className={`relative z-30 block w-full ${className}`}
      />
    </form>
  );
}
