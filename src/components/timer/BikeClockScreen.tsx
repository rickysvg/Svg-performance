"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { finishBikeLoggerAction, logBikeTimerAction } from "@/app/actions/workouts";
import { bikeLoggerHref } from "@/lib/timer-session";
import { BikeSetTimer } from "@/components/training/BikeSetTimer";
import { BikeWorkoutChooser } from "@/components/training/BikeWorkoutSheet";
import {
  BIKE_CHOICE_EVENT,
  BIKE_CHOICE_STORAGE_KEY,
  bikeChoiceById,
  bikeTimerRoundCount,
  choiceFromToken,
  choiceToken,
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

function sessionRoundCount(session: BikeSession) {
  const repeats = Math.max(1, Math.round(session.repeatRounds ?? 1));
  return Math.max(1, Math.round(session.roundsPerSet) * repeats);
}

export function BikeClockScreen({
  token = null,
  session = null,
  dayId = null,
  workoutSessionId = null,
  onClose,
  titleId,
}: {
  token?: string | null;
  session?: BikeSession | null;
  dayId?: string | null;
  /** Open logger to write when this clock has no program day. */
  workoutSessionId?: string | null;
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
  const rounds = active ? bikeTimerRoundCount(active) : running ? sessionRoundCount(running) : 1;
  const [finished, setFinished] = useState(0);
  const [notes, setNotes] = useState("");
  const [rpe, setRpe] = useState("");

  return (
    <div className="space-y-4 pb-8" data-bike-clock={ready ? "ready" : "plan"}>
      <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-3 bg-background px-4 py-2">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            data-testid="round-timer-button-on-close-sheet-close"
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
          onFinishedRounds={setFinished}
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

      {workoutSessionId && running ? (
        <form action={finishBikeLoggerAction}>
          <input type="hidden" name="workoutId" value={workoutSessionId} />
          <input type="hidden" name="workout" value={active ? choiceToken(active) : ""} />
          <input type="hidden" name="bikeName" value={running.focus || running.title || workoutLabel} />
          <input type="hidden" name="workSeconds" value={running.workSeconds} />
          <input type="hidden" name="restSeconds" value={running.restSeconds} />
          <input type="hidden" name="roundsPerSet" value={running.roundsPerSet} />
          <input type="hidden" name="repeatRounds" value={running.repeatRounds ?? 1} />
          <input type="hidden" name="rounds" value={rounds} />
          <button
            type="submit"
            data-testid="chrome-form-3"
            className="touch-target inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#CBF805] text-sm font-semibold text-black"
          >
            Log this session
          </button>
        </form>
      ) : active && finished >= 1 ? (
        <form action={logBikeTimerAction} data-bike-clock-log="">
          <input type="hidden" name="workout" value={choiceToken(active)} />
          <input type="hidden" name="rounds" value={finished} />
          {dayId ? <input type="hidden" name="programDayId" value={dayId} /> : null}
          <label className="block text-sm">
            Notes
            <textarea
              name="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              onInput={(event) => setNotes(event.currentTarget.value)}
              maxLength={500}
              rows={2}
              placeholder="Optional"
              className="mt-1 w-full rounded-2xl border border-line bg-card px-3 py-2"
            />
          </label>
          <label className="mt-3 block text-sm">
            RPE
            <input
              name="rpe"
              value={rpe}
              onChange={(event) => setRpe(event.target.value.replace(/[^\d]/g, "").slice(0, 2))}
              onInput={(event) => setRpe(event.currentTarget.value.replace(/[^\d]/g, "").slice(0, 2))}
              inputMode="numeric"
              placeholder="1–10, optional"
              className="mt-1 w-full rounded-2xl border border-line bg-card px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="touch-target mt-3 w-full rounded-full bg-accent text-sm uppercase tracking-wide text-black"
          >
            {`Log ${finished} bike rounds`}
          </button>
        </form>
      ) : (
        <p className="text-sm text-muted" data-bike-clock-log="waiting">
          Finish a round before logging.
        </p>
      )}

      {!workoutSessionId && dayId ? (
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
