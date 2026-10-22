import { continuePartialWorkoutAction } from "@/app/actions/workouts";

export function ContinueWorkoutButton({
  workoutId,
  label,
  className,
  testId,
  startToday = false,
  nextSession = false,
}: {
  workoutId: string;
  label: string;
  className: string;
  testId?: string;
  startToday?: boolean;
  nextSession?: boolean;
}) {
  return (
    <form action={continuePartialWorkoutAction} className="w-full">
      <input type="hidden" name="workoutId" value={workoutId} />
      <button
        type="submit"
        data-resume-workout
        data-session-continue="partial"
        data-prime-coach-audio
        data-start-today={startToday ? "" : undefined}
        data-next-session={nextSession ? "" : undefined}
        data-testid={testId}
        className={className}
      >
        {label}
      </button>
    </form>
  );
}
