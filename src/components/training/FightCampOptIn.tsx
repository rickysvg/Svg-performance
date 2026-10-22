"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [open, setOpen] = useState(enabled);
  const [optimisticOn, setOptimisticOn] = useState(false);
  const [optimisticSummary, setOptimisticSummary] = useState("");
  const [saveState, saveAction, savePending] = useActionState(
    saveFightCampAction,
    {} as CampActionState,
  );
  const [cancelState, cancelAction] = useActionState(
    cancelFightCampAction,
    {} as CampActionState,
  );
  const cancelRef = useRef<HTMLFormElement>(null);
  const shown = (enabled || optimisticOn) && !saveState.error && !cancelState.error;
  const shownSummary = shown ? optimisticSummary || summary : "";

  useEffect(() => {
    if (saveState.saved || cancelState.saved) router.refresh();
  }, [saveState.saved, cancelState.saved, router]);

  useEffect(() => {
    if (enabled) setOptimisticOn(false);
  }, [enabled]);

  return (
    <section className="space-y-3" data-fight-camp-opt-in={shown ? "on" : "off"}>
      <div className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3">
        <div className="min-w-0">
          <p className="font-semibold">I have a fight coming up</p>
          {shown && shownSummary ? <p className="mt-0.5 text-sm text-muted">{shownSummary}</p> : null}
          {!shown ? (
            <p className="mt-0.5 text-xs text-muted">
              Turn this on, then save the fight. Camp starts once that fight is saved.
            </p>
          ) : null}
        </div>
        <input
          type="checkbox"
          role="switch"
          aria-label="I have a fight coming up"
          checked={open || shown}
          onChange={(event) => {
            if (!event.target.checked && shown) {
              setOptimisticOn(false);
              setOpen(false);
              cancelRef.current?.requestSubmit();
              return;
            }
            setOpen(event.target.checked);
          }}
          className="h-7 w-7 shrink-0 accent-[#CBF805]"
        />
      </div>

      <form data-testid="training-form" ref={cancelRef} action={cancelAction} className="hidden">
        <input type="hidden" name="next" value="/training" />
      </form>

      {open && !enabled ? (
        <form
          data-testid="training-form-2"
          action={saveAction}
          className={
            shown
              ? "hidden"
              : "space-y-3 rounded-2xl border border-line bg-card px-4 py-4"
          }
          onSubmit={(event) => {
            const data = new FormData(event.currentTarget);
            const date = String(data.get("fightDate") ?? "");
            const weight = String(data.get("weightClass") ?? "").trim();
            if (!date || !weight) return;
            setOptimisticSummary(`${date} · ${weight}`);
            setOptimisticOn(true);
          }}
        >
          <StatusBanner error={saveState.error ?? cancelState.error} />
          <input type="hidden" name="next" value="/training" />
          <input type="hidden" name="discipline" value="" />
          <label className="block text-sm">
            Fight date
            <input
              data-testid="training-fight-date"
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
              data-testid="training-weight-class"
              name="weightClass"
              required
              maxLength={40}
              defaultValue={weightClass}
              placeholder="170 lb class"
              className="mt-1 w-full rounded-2xl border border-line bg-white px-4 py-3 text-base"
            />
          </label>
          <p className="text-xs text-muted">Camp turns on as soon as this fight is saved.</p>
          <button
            data-testid="training-save-fight"
            type="submit"
            className="touch-target w-full rounded-full bg-[#CBF805] text-black"
          >
            {savePending && !optimisticOn ? "Saving…" : "Save fight"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
