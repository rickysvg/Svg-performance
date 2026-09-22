"use client";

import { useActionState } from "react";
import { rateWorkoutAction, type WorkoutActionState } from "@/app/actions/workouts";
import { StatusBanner } from "@/components/StatusBanner";
import { DIFFICULTY_RATINGS } from "@/lib/difficulty";

export function DifficultyRatingForm({
  workoutId,
  current,
  celebrate,
}: {
  workoutId: string;
  current?: string;
  celebrate?: string;
}) {
  const [state, action, pending] = useActionState(
    rateWorkoutAction,
    {} as WorkoutActionState,
  );

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-accent/40 bg-card p-5">
      <h2 className="text-lg font-semibold">How did that session feel?</h2>
      <p className="text-sm text-muted">
        Pick one before you go. This is how the work felt — not a grade and not a shame score.
      </p>
      <StatusBanner error={state.error} />
      <input type="hidden" name="workoutId" value={workoutId} />
      {celebrate ? <input type="hidden" name="celebrate" value={celebrate} /> : null}
      <fieldset className="grid gap-2">
        {DIFFICULTY_RATINGS.map((item) => (
          <label
            key={item.value}
            className="flex items-center gap-3 rounded-xl border border-line px-3 py-3 text-sm"
          >
            <input
              type="radio"
              name="difficultyRating"
              value={item.value}
              required
              defaultChecked={current === item.value}
              className="h-5 w-5 accent-accent"
            />
            {item.label}
          </label>
        ))}
      </fieldset>
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent font-semibold text-black disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save rating"}
      </button>
    </form>
  );
}
