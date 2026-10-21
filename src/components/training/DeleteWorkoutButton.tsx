"use client";

import { useState } from "react";
import { deleteWorkoutAction } from "@/app/actions/workouts";

export function DeleteWorkoutButton({
  workoutId,
  compact = false,
}: {
  workoutId: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        data-delete-workout
        onClick={() => setOpen(true)}
        className={
          compact
            ? "touch-target inline-flex min-w-[4.5rem] items-center justify-center rounded-2xl border border-danger/40 px-3 text-sm text-danger"
            : "touch-target text-sm text-danger underline-offset-4 hover:underline"
        }
      >
        Delete
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-6 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-workout-title"
            data-delete-confirm
            className="w-full max-w-sm rounded-3xl bg-card px-5 py-5"
          >
            <p id="delete-workout-title" className="font-display text-lg uppercase tracking-wide text-danger">
              Delete this workout?
            </p>
            <p className="mt-2 text-sm text-muted">This can&apos;t be undone.</p>
            <div className="mt-5 flex flex-col gap-2">
              <form action={deleteWorkoutAction}>
                <input type="hidden" name="workoutId" value={workoutId} />
                <button
                  type="submit"
                  data-delete-confirm-submit
                  className="touch-target w-full rounded-full bg-danger text-base font-semibold text-white"
                >
                  Delete
                </button>
              </form>
              <button
                type="button"
                data-delete-cancel
                onClick={() => setOpen(false)}
                className="touch-target w-full rounded-full border border-line text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
