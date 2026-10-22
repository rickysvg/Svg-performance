import Link from "next/link";
import { startSessionAction } from "@/app/actions/workouts";
import { StartSubmit } from "@/components/training/StartTodayButton";
import type { NextTrainAction } from "@/lib/train-next";

const buttonClass =
  "touch-target flex w-full items-center justify-center rounded-full bg-accent px-4 text-center font-display text-base leading-tight text-black";

const stickyClass = "sticky top-0 z-30 md:top-14";

export function NextSessionCta({ action }: { action: NextTrainAction }) {
  const label = `Next: ${action.verb} ${action.title}`;

  if (action.draftId) {
    return (
      <Link
        data-testid={`training-log-${action.draftId}`}
        href={`/training/log/${action.draftId}`}
        data-next-session
        data-prime-coach-audio
        className={`${buttonClass} ${stickyClass}`}
      >
        {label}
      </Link>
    );
  }

  if (action.dayId) {
    return (
      <form data-testid="training-next-session" action={startSessionAction} data-next-session data-prime-coach-audio className={stickyClass}>
        <input type="hidden" name="programDayId" value={action.dayId} />
        <StartSubmit label={label} className={buttonClass} />
      </form>
    );
  }

  if (action.href) {
    return (
      <Link data-testid={`training-next-session-2-${action.href.split("/").filter(Boolean).join("-")}`} href={action.href} data-next-session data-prime-coach-audio className={`${buttonClass} ${stickyClass}`}>
        {label}
      </Link>
    );
  }

  return null;
}
