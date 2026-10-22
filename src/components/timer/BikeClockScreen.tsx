"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { bikeLoggerHref } from "@/lib/timer-session";
import { BikeSetTimer } from "@/components/training/BikeSetTimer";
import { BikeWorkoutChooser } from "@/components/training/BikeWorkoutSheet";
import {
  BIKE_CHOICE_EVENT,
  BIKE_CHOICE_STORAGE_KEY,
  bikeChoiceById,
  choiceFromToken,
  rememberBikeChoice,
  sessionWithChoice,
} from "@/lib/bike-chooser";
import { DEFAULT_BIKE_SESSION, type BikeSession } from "@/lib/bike-sessions";

function subscribeBikeChoice(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === BIKE_CHOICE_STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(BIKE_CHOICE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(BIKE_CHOICE_EVENT, onChange);
  };
}

function readBikeChoiceToken() {
  try {
    return window.localStorage.getItem(BIKE_CHOICE_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function emptyBikeChoiceToken() {
  return "";
}

export function BikeClockScreen({
  token = null,
  session = null,
  dayId = null,
  onClose,
  titleId,
}: {
  token?: string | null;
  session?: BikeSession | null;
  dayId?: string | null;
  onClose?: () => void;
  titleId?: string;
}) {
  const explicit = token ? choiceFromToken(token) : null;
  const storedToken = useSyncExternalStore(subscribeBikeChoice, readBikeChoiceToken, emptyBikeChoiceToken);
  const remembered = explicit ? null : choiceFromToken(storedToken);
  const active = explicit ?? remembered ?? (!session ? bikeChoiceById("tabata") : null);
  const base = session ?? DEFAULT_BIKE_SESSION;
  const running = active ? sessionWithChoice(base, active) : session;
  const workoutLabel = active?.name ?? session?.focus ?? session?.title ?? "Bike workout";
  const ready = explicit != null || storedToken !== "" || !session;

  return (
    <div className="space-y-4 pb-8" data-bike-clock={ready ? "ready" : "plan"}>
      <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-3 bg-background px-4 py-2">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            data-testid="chrome-round-timer-close"
            className="touch-target inline-flex items-center justify-center text-2xl leading-none"
            aria-label="Close timer"
          >
            ‹
          </button>
        ) : (
          <Link
            href="/training"
            className="touch-target inline-flex items-center justify-center text-2xl leading-none"
            aria-label="Back to Train"
          >
            ‹
          </Link>
        )}
        <h1 className="text-xl" id={titleId} data-timer-title>
          Bike
        </h1>
        <span className="w-8" aria-hidden />
      </div>

      <div>
        <p className="font-display text-xs uppercase tracking-wide text-accent">Bike</p>
        <p data-bike-clock-workout className="mt-1 font-display text-2xl uppercase leading-tight">
          {workoutLabel}
        </p>
      </div>

      {running ? (
        <BikeSetTimer
          key={`${active?.id ?? "plan"}-${running.workSeconds}-${running.restSeconds}-${running.roundsPerSet}-${running.repeatRounds ?? 1}`}
          session={running}
          canStart
          onSetComplete={() => {}}
        />
      ) : null}

      <BikeWorkoutChooser
        choice={active}
        seed={
          running
            ? {
                workSeconds: running.workSeconds,
                restSeconds: running.restSeconds,
                roundsPerSet: running.roundsPerSet,
              }
            : null
        }
        onApply={rememberBikeChoice}
      />

      {dayId ? (
        <Link
          href={bikeLoggerHref(dayId)}
          prefetch={false}
          data-testid="chrome-form-3"
          className="text-sm font-semibold text-muted underline"
        >
          Log this session
        </Link>
      ) : null}
    </div>
  );
}
