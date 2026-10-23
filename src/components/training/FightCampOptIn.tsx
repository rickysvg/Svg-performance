"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  cancelFightCampAction,
  saveFightCampAction,
  type CampActionState,
} from "@/app/actions/fight-camp";
import { StatusBanner } from "@/components/StatusBanner";

/** One click on the row, including the label, toggles the switch once. */
export function toggleFightCampRow(input: { nextChecked: boolean; shown: boolean }) {
  if (!input.nextChecked && input.shown) return { open: false, cancel: true };
  return { open: input.nextChecked, cancel: false };
}

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

  const [trackedEnabled, setTrackedEnabled] = useState(enabled);
  if (enabled !== trackedEnabled) {
    setTrackedEnabled(enabled);
    if (enabled) setOptimisticOn(false);
  }

  const checked = open || shown;
  function applyToggle(nextChecked: boolean) {
    const next = toggleFightCampRow({ nextChecked, shown });
    if (!next.open) setOptimisticOn(false);
    setOpen(next.open);
    if (next.cancel) cancelRef.current?.requestSubmit();
  }

  return (
    <section className="space-y-3" data-fight-camp-opt-in={shown ? "on" : "off"}>
      <label
        data-fight-camp-row
        className="flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3"
        onClick={(event) => {
          event.preventDefault();
          applyToggle(!checked);
        }}
      >
        <span className="min-w-0">
          <span className="block font-semibold">I have a fight coming up</span>
          {shown && shownSummary ? (
            <span className="mt-0.5 block text-sm text-muted">{shownSummary}</span>
          ) : null}
          {!shown ? (
            <span className="mt-0.5 block text-xs text-muted">
              Turn this on, then save the fight. Camp starts once that fight is saved.
            </span>
          ) : null}
        </span>
        <span data-fight-camp-switch className="relative inline-flex h-8 w-14 shrink-0 items-center">
          <input
            type="checkbox"
            role="switch"
            data-testid="training-fight-camp"
            aria-label="I have a fight coming up"
            checked={checked}
            readOnly
            onKeyDown={(event) => {
              if (event.key !== " " && event.key !== "Enter") return;
              event.preventDefault();
              event.stopPropagation();
              applyToggle(!checked);
            }}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full bg-[#0c0e11] ring-1 ring-[#2a3124] transition peer-checked:bg-[#CBF805]/25 peer-checked:ring-[#CBF805]"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute left-1 h-6 w-6 rounded-full bg-[#9aa392] transition peer-checked:translate-x-6 peer-checked:bg-[#CBF805]"
          />
        </span>
      </label>

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
              className="mt-1 w-full rounded-2xl border border-line bg-[#0c0e11] px-4 py-3 text-base text-[#f3f4ef] caret-[#CBF805] focus:border-[#CBF805]"
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
              className="mt-1 w-full rounded-2xl border border-line bg-[#0c0e11] px-4 py-3 text-base text-[#f3f4ef] caret-[#CBF805] focus:border-[#CBF805]"
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
