"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { startSessionAction } from "@/app/actions/workouts";
import { todayStartLabel, type TodayStartAction } from "@/lib/today-start";

const buttonClass =
  "touch-target flex w-full items-center justify-center rounded-full bg-accent px-4 text-center font-display text-sm leading-tight text-black";

export function StartTodayButton({ action }: { action: TodayStartAction }) {
  const label = todayStartLabel(action);

  if (action.draftId) {
    return (
      <Link href={`/training/log/${action.draftId}`} data-start-today data-prime-coach-audio className={buttonClass}>
        {label}
      </Link>
    );
  }

  if (action.dayId) {
    return (
      <form action={startSessionAction} data-start-today data-prime-coach-audio>
        <input type="hidden" name="programDayId" value={action.dayId} />
        <StartSubmit label={label} className={buttonClass} />
      </form>
    );
  }

  if (action.href) {
    return (
      <Link href={action.href} data-start-today data-prime-coach-audio className={buttonClass}>
        {label}
      </Link>
    );
  }

  return null;
}

export function StartSubmit({ label, className }: { label: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      data-start-pending={pending ? "" : undefined}
      className={className}
    >
      {pending ? "Starting…" : label}
    </button>
  );
}
