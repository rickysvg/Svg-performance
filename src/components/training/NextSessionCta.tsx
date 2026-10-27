import { PendingWorkoutLink } from "@/components/training/PendingWorkoutControl";
import { bikeLoggerHref } from "@/lib/timer-session";
import { ContinueWorkoutButton } from "@/components/training/ContinueWorkoutButton";
import type { NextTrainAction } from "@/lib/train-next";

const buttonClass =
  "touch-target flex w-full items-center justify-center rounded-full bg-accent px-4 text-center font-display text-base leading-tight text-black";

const stickyClass = "sticky top-0 z-30 md:top-14";

export function NextSessionCta({ action }: { action: NextTrainAction }) {
  const label = `Next: ${action.verb} ${action.title}${action.progress ? ` · ${action.progress}` : ""}`;

  if (action.draftId && action.partial) {
    return (
      <ContinueWorkoutButton
        workoutId={action.draftId}
        label={label}
        className={`${buttonClass} ${stickyClass}`}
        testId="training-next-session"
        nextSession
      />
    );
  }

  if (action.draftId) {
    return (
      <PendingWorkoutLink
        data-testid={`training-log-${action.draftId}`}
        href={`/training/log/${action.draftId}`}
        label={label}
        data-next-session
        data-prime-coach-audio
        className={`${buttonClass} ${stickyClass}`}
      />
    );
  }

  if (action.dayId) {
    return (
      <PendingWorkoutLink
        href={action.startHref ?? bikeLoggerHref(action.dayId)}
        prefetch={false}
        label={label}
        data-testid="training-next-session"
        data-next-session
        data-prime-coach-audio
        className={`${buttonClass} ${stickyClass}`}
      />
    );
  }

  if (action.href) {
    return (
      <PendingWorkoutLink data-testid={`training-next-session-2-${action.href.split("/").filter(Boolean).join("-")}`} href={action.href} label={label} data-next-session data-prime-coach-audio className={`${buttonClass} ${stickyClass}`} />
    );
  }

  return null;
}
