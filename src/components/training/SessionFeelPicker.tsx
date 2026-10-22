"use client";

import { useActionState, useState } from "react";
import { rateFinishedWorkoutAction, type WorkoutActionState } from "@/app/actions/workouts";
import { DIFFICULTY_RATINGS } from "@/lib/difficulty";

export function SessionFeelPicker({
  workoutId,
  current,
}: {
  workoutId: string;
  current: string;
}) {
  const [state, action, pending] = useActionState(
    rateFinishedWorkoutAction,
    {} as WorkoutActionState,
  );
  const [confirmed, setConfirmed] = useState(current);
  const [pressed, setPressed] = useState<string | null>(null);
  const [seenSaved, setSeenSaved] = useState<string | undefined>(undefined);
  const [seenError, setSeenError] = useState<string | undefined>(undefined);

  if (state.savedRating !== seenSaved) {
    setSeenSaved(state.savedRating);
    if (state.savedRating) {
      setConfirmed(state.savedRating);
      setPressed(null);
    }
  }
  if (state.error !== seenError) {
    setSeenError(state.error);
    if (state.error) setPressed(null);
  }

  const selected = pressed ?? confirmed;

  return (
    <form action={action} className="mt-5 w-full text-left" data-session-feel="1">
      <input type="hidden" name="workoutId" value={workoutId} />
      <fieldset>
        <legend className="mb-2 w-full text-center text-[11px] uppercase tracking-[0.16em] text-white/55">
          How hard was that?
        </legend>
        <div className="grid grid-cols-5 gap-2">
        {DIFFICULTY_RATINGS.map((item) => {
          const on = selected === item.value;
          return (
            <button
              key={item.value}
              type="submit"
              name="difficultyRating"
              value={item.value}
              disabled={pending}
              aria-pressed={on}
              aria-label={item.label}
              data-difficulty={item.value}
              onClick={() => setPressed(item.value)}
              className={`flex min-h-14 w-full items-center justify-center rounded-2xl text-lg disabled:opacity-60 ${
                on ? "bg-[#cbf805] text-black" : "bg-white/10 text-white"
              }`}
            >
              <span className="font-display text-2xl leading-none" aria-hidden>
                {item.score}
              </span>
              <span className="sr-only">{item.label}</span>
            </button>
          );
        })}
        </div>
      </fieldset>
      {state.error ? (
        <p className="mt-2 text-center text-sm text-white" role="alert">
          {state.error}
        </p>
      ) : null}
      {pending ? (
        <p className="mt-2 text-center text-sm text-[#cbf805]" data-feel-saved="0">
          Saving…
        </p>
      ) : state.savedRating ? (
        <p className="mt-2 text-center text-sm text-[#cbf805]" data-feel-saved="1">
          Saved. Hit Done when you are ready.
        </p>
      ) : confirmed ? (
        <p className="mt-2 text-center text-sm text-white/70" data-feel-saved="1">
          Saved. Tap again to change, or hit Done.
        </p>
      ) : (
        <p className="mt-2 text-center text-xs text-white/50" data-feel-optional="1">
          Optional. One tap, or hit Done.
        </p>
      )}
    </form>
  );
}
