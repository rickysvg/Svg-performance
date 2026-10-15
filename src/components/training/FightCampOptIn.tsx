"use client";

import { useActionState, useRef, useState } from "react";
import {
  cancelFightCampAction,
  saveFightCampAction,
  type CampActionState,
} from "@/app/actions/fight-camp";
import { StatusBanner } from "@/components/StatusBanner";

export function FightCampOptIn({
  enabled,
  todayKey,
  fightDate = "",
  weightClass = "",
  summary = "",
}: {
  enabled: boolean;
  todayKey: string;
  fightDate?: string;
  weightClass?: string;
  summary?: string;
}) {
  const [open, setOpen] = useState(enabled);
  const [saveState, saveAction, savePending] = useActionState(
    saveFightCampAction,
    {} as CampActionState,
  );
  const [, cancelAction, cancelPending] = useActionState(
    cancelFightCampAction,
    {} as CampActionState,
  );
  const cancelRef = useRef<HTMLFormElement>(null);

  return (
    <section className="space-y-3" data-fight-camp-opt-in={enabled ? "on" : "off"}>
      <div className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3">
        <div className="min-w-0">
          <p className="font-semibold">I have a fight coming up</p>
          {enabled && summary ? <p className="mt-0.5 text-sm text-muted">{summary}</p> : null}
        </div>
        <input
          type="checkbox"
          role="switch"
          aria-label="I have a fight coming up"
          checked={open}
          disabled={cancelPending || savePending}
          onChange={(event) => {
            if (!event.target.checked && enabled) {
              cancelRef.current?.requestSubmit();
              return;
            }
            setOpen(event.target.checked);
          }}
          className="h-7 w-7 shrink-0 accent-[#CBF805]"
        />
      </div>

      <form ref={cancelRef} action={cancelAction} className="hidden">
        <input type="hidden" name="next" value="/training" />
      </form>

      {open && !enabled ? (
        <form action={saveAction} className="space-y-3 rounded-2xl border border-line bg-card px-4 py-4">
          <StatusBanner error={saveState.error} />
          <input type="hidden" name="next" value="/training" />
          <input type="hidden" name="discipline" value="" />
          <label className="block text-sm">
            Fight date
            <input
              name="fightDate"
              type="date"
              required
              min={todayKey}
              defaultValue={fightDate}
              className="mt-1 w-full rounded-2xl border border-line bg-white px-4 py-3 text-base"
            />
          </label>
          <label className="block text-sm">
            Weight class
            <input
              name="weightClass"
              required
              maxLength={40}
              defaultValue={weightClass}
              placeholder="170 lb class"
              className="mt-1 w-full rounded-2xl border border-line bg-white px-4 py-3 text-base"
            />
          </label>
          <button
            type="submit"
            disabled={savePending}
            className="touch-target w-full rounded-full bg-[#CBF805] text-black disabled:opacity-60"
          >
            {savePending ? "Saving…" : "Save fight"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
