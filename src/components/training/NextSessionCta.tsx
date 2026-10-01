import Link from "next/link";
import { startSessionAction } from "@/app/actions/workouts";
import type { NextTrainAction } from "@/lib/train-next";

const buttonClass =
  "touch-target flex w-full items-center justify-center rounded-full bg-accent px-4 text-center font-display text-base leading-tight text-black";

const stickyClass = "sticky top-0 z-30 md:top-14";

export function NextSessionCta({ action }: { action: NextTrainAction }) {
  const label = `Next: ${action.verb} ${action.title}`;

  if (action.draftId) {
    return (
      <Link
        href={`/training/log/${action.draftId}`}
        data-next-session
        className={`${buttonClass} ${stickyClass}`}
      >
        {label}
      </Link>
    );
  }

  if (action.dayId) {
    return (
      <form action={startSessionAction} data-next-session className={stickyClass}>
        <input type="hidden" name="programDayId" value={action.dayId} />
        <button type="submit" className={buttonClass}>
          {label}
        </button>
      </form>
    );
  }

  if (action.href) {
    return (
      <Link href={action.href} data-next-session className={`${buttonClass} ${stickyClass}`}>
        {label}
      </Link>
    );
  }

  return null;
}
