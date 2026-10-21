"use client";

import { useActionState, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { saveMyWorkoutAction, type SavedWorkoutActionState } from "@/app/actions/my-workouts";
import type { SavedExercise } from "@/lib/my-workout-plan";

export function SaveWorkoutButton({
  workoutId,
  defaultName,
  exercises,
  tone = "light",
}: {
  workoutId: string;
  defaultName: string;
  exercises?: SavedExercise[];
  tone?: "light" | "dark";
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [state, action, pending] = useActionState(saveMyWorkoutAction, {} as SavedWorkoutActionState);

  return (
    <>
      <button
        type="button"
        data-save-my-workout
        onClick={() => {
          setName(defaultName);
          setOpen(true);
        }}
        className={`touch-target w-full rounded-full border text-sm font-semibold ${
          tone === "dark" ? "border-white/40 text-white" : "border-line"
        }`}
      >
        Save as my workout
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 px-4 pb-6 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-my-workout-title"
            data-save-my-workout-sheet
            className="w-full max-w-sm rounded-3xl bg-card px-5 py-5 text-foreground"
          >
            <p id="save-my-workout-title" className="font-display text-lg uppercase tracking-wide">
              Save as my workout
            </p>
            <p className="mt-2 text-sm text-muted">
              Saves this exercise list, in order, with sets, reps, rest, RIR, and load notes.
            </p>
            {state.saved ? (
              <div className="mt-4 space-y-3" data-saved-my-workout>
                <p className="text-sm font-semibold">Saved to My Workouts.</p>
                <Link href="/training/my-workouts" className="block text-sm font-semibold text-accent underline">
                  Open My Workouts
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="touch-target w-full rounded-full border border-line text-sm"
                >
                  Close
                </button>
              </div>
            ) : (
              <form action={action} className="mt-4 space-y-3">
                <input type="hidden" name="workoutId" value={workoutId} />
                {exercises ? (
                  <input type="hidden" name="exercises" value={JSON.stringify(exercises)} />
                ) : null}
                <label className="block text-sm">
                  <span className="font-medium">Name</span>
                  <input
                    name="name"
                    data-save-my-workout-name
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={80}
                    className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
                  />
                </label>
                {state.error ? (
                  <p className="text-sm text-danger" role="alert">
                    {state.error}
                  </p>
                ) : null}
                <button
                  type="submit"
                  data-save-my-workout-submit
                  disabled={pending}
                  className="touch-target w-full rounded-full bg-accent font-semibold text-black disabled:opacity-60"
                >
                  {pending ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="touch-target w-full rounded-full border border-line text-sm"
                >
                  Cancel
                </button>
              </form>
            )}
          </div>
        </div>,
        document.body,
      )
        : null}
    </>
  );
}
