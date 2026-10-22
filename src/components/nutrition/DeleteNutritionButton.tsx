"use client";

import { useState } from "react";
import { deleteNutritionEntryAction } from "@/app/actions/nutrition";
import { onSheetBackdropMouseDown, useSheetBehavior } from "@/components/useSheetBehavior";

export function DeleteNutritionButton({ entryId }: { entryId: string }) {
  const [open, setOpen] = useState(false);
  const panelRef = useSheetBehavior(() => setOpen(false), open);

  return (
    <>
      <button
        type="button"
        data-delete-nutrition
        onClick={() => setOpen(true)}
        className="text-sm text-danger underline-offset-4 hover:underline"
      >
        Delete this entry
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-6 sm:items-center"
          onMouseDown={(event) => onSheetBackdropMouseDown(event, () => setOpen(false))}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            data-delete-confirm
            className="w-full max-w-sm rounded-3xl bg-card px-5 py-5 outline-none"
          >
            <p className="font-display text-lg uppercase tracking-wide text-danger">Delete this meal?</p>
            <p className="mt-2 text-sm text-muted">This removes the food log. It can&apos;t be undone.</p>
            <div className="mt-5 flex flex-col gap-2">
              <form action={deleteNutritionEntryAction}>
                <input type="hidden" name="entryId" value={entryId} />
                <button
                  type="submit"
                  className="touch-target w-full rounded-full bg-danger text-base font-semibold text-white"
                >
                  Delete
                </button>
              </form>
              <button
                type="button"
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
