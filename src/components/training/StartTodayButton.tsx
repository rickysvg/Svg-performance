"use client";

import { PendingWorkoutLink } from "@/components/training/PendingWorkoutControl";
import { bikeLoggerHref } from "@/lib/timer-session";
import { ContinueWorkoutButton } from "@/components/training/ContinueWorkoutButton";
import { todayStartLabel, type TodayStartAction } from "@/lib/today-start";

const buttonClass =
  "touch-target flex w-full items-center justify-center rounded-full bg-accent px-4 text-center font-display text-sm leading-tight text-black";

export function StartTodayButton({
  action,
  label,
}: {
  action: TodayStartAction;
  /** Short control label. The long plan line belongs on TodaySummary, not this button. */
  label?: string;
}) {
  const text = label ?? todayStartLabel(action);

  if (action.draftId && action.partial) {
    return (
      <ContinueWorkoutButton
        workoutId={action.draftId}
        label={text}
        className={buttonClass}
        testId="home-start-today"
        startToday
      />
    );
  }

  if (action.draftId) {
    return (
      <PendingWorkoutLink data-testid={`home-training-log-${action.draftId}`} href={`/training/log/${action.draftId}`} label={text} data-start-today data-prime-coach-audio className={buttonClass} />
    );
  }

  if (action.dayId) {
    return (
      <PendingWorkoutLink
        href={action.startHref ?? action.logHref ?? bikeLoggerHref(action.dayId)}
        prefetch={false}
        label={text}
        data-testid="home-start-today"
        data-start-today
        data-open-bike-logger={action.logHref ? "today" : undefined}
        data-prime-coach-audio
        className={buttonClass}
      />
    );
  }

  if (action.href) {
    return (
      <PendingWorkoutLink data-testid={`home-start-today-2-${action.href.split("/").filter(Boolean).join("-")}`} href={action.href} label={text} data-start-today data-prime-coach-audio className={buttonClass} />
    );
  }

  return null;
}
