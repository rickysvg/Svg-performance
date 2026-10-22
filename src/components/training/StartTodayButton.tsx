"use client";

import Link from "next/link";
import { bikeLoggerHref } from "@/lib/timer-session";
import { todayStartLabel, type TodayStartAction } from "@/lib/today-start";

const buttonClass =
  "touch-target flex w-full items-center justify-center rounded-full bg-accent px-4 text-center font-display text-sm leading-tight text-black";

export function StartTodayButton({ action }: { action: TodayStartAction }) {
  const label = todayStartLabel(action);

  if (action.draftId) {
    return (
      <Link data-testid={`home-training-log-${action.draftId}`} href={`/training/log/${action.draftId}`} data-start-today data-prime-coach-audio className={buttonClass}>
        {label}
      </Link>
    );
  }

  if (action.dayId) {
    return (
      <Link
        href={action.startHref ?? action.logHref ?? bikeLoggerHref(action.dayId)}
        prefetch={false}
        data-testid="home-start-today"
        data-start-today
        data-open-bike-logger={action.logHref ? "today" : undefined}
        data-prime-coach-audio
        className={buttonClass}
      >
        {label}
      </Link>
    );
  }

  if (action.href) {
    return (
      <Link data-testid={`home-start-today-2-${action.href.split("/").filter(Boolean).join("-")}`} href={action.href} data-start-today data-prime-coach-audio className={buttonClass}>
        {label}
      </Link>
    );
  }

  return null;
}
