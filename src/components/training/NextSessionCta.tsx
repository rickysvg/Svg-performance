import Link from "next/link";
import { bikeLoggerHref } from "@/lib/timer-session";
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
      <Link
        href={action.startHref ?? bikeLoggerHref(action.dayId)}
        prefetch={false}
        data-testid="training-next-session"
        data-next-session
        data-prime-coach-audio
        className={`${buttonClass} ${stickyClass}`}
      >
        {label}
      </Link>
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
