import Link from "next/link";
import { startSessionAction } from "@/app/actions/workouts";
import { todayStartLabel, type TodayStartAction } from "@/lib/today-start";

const buttonClass =
  "touch-target flex w-full items-center justify-center rounded-full bg-accent px-4 text-center font-display text-sm leading-tight text-black";

export function StartTodayButton({ action }: { action: TodayStartAction }) {
  const label = todayStartLabel(action);

  if (action.draftId) {
    return (
      <Link href={`/training/log/${action.draftId}`} data-start-today className={buttonClass}>
        {label}
      </Link>
    );
  }

  if (action.dayId) {
    return (
      <form action={startSessionAction} data-start-today>
        <input type="hidden" name="programDayId" value={action.dayId} />
        <button type="submit" className={buttonClass}>
          {label}
        </button>
      </form>
    );
  }

  if (action.href) {
    return (
      <Link href={action.href} data-start-today className={buttonClass}>
        {label}
      </Link>
    );
  }

  return null;
}
