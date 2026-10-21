"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveHomeBodyFatAction, type BodyMetricActionState } from "@/app/actions/body-metrics";
import {
  formatBodyFatDelta,
  type BodyFatReadout,
  type HomeTrainingReadout,
} from "@/lib/home-side-stats";

function fatLabel(bodyFat: BodyFatReadout) {
  if (bodyFat.value == null) {
    return "Body fat not logged. Tap to add. Opens body fat entry.";
  }
  const value = `${bodyFat.value.toFixed(1)} percent`;
  if (bodyFat.delta == null || bodyFat.direction === "none") {
    return `Body fat ${value}. Opens body fat entry.`;
  }
  const change =
    bodyFat.direction === "up" ? "up" : bodyFat.direction === "down" ? "down" : "unchanged";
  return `Body fat ${value}, ${change} ${Math.abs(bodyFat.delta).toFixed(1)} from the previous entry. Opens body fat entry.`;
}

function trainingLabel(training: HomeTrainingReadout) {
  if (training.mode === "fight") {
    if (training.days === 0) return "Fight day. Opens Progress.";
    const unit = training.days === 1 ? "day" : "days";
    return `${training.days} ${unit} to fight. Opens Progress.`;
  }
  const unit = training.days === 1 ? "day" : "days";
  return `Training streak ${training.days} ${unit}. Opens Progress.`;
}

function deltaClass(direction: BodyFatReadout["direction"]) {
  if (direction === "up") return "text-[#FF3B3B]";
  if (direction === "down") return "text-[#CBF805]";
  return "text-white/55";
}

export function HomeSideStats({
  bodyFat,
  training,
}: {
  bodyFat: BodyFatReadout;
  training: HomeTrainingReadout;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [state, action, pending] = useActionState(saveHomeBodyFatAction, {} as BodyMetricActionState);
  const fatEmpty = bodyFat.value == null;
  const fight = training.mode === "fight";
  const trainingUnit =
    fight && training.days === 0 ? "today" : training.days === 1 ? "day" : "days";
  const fatDelta =
    fatEmpty ? "Tap to add" : bodyFat.delta == null ? "Logged" : formatBodyFatDelta(bodyFat.delta);

  useEffect(() => {
    if (!state.success) return;
    setOpen(false);
    router.refresh();
  }, [state.success, router]);

  const labelClass =
    "line-clamp-2 block min-h-[1.35rem] font-telemetry text-[8px] uppercase leading-tight tracking-[0.08em] text-signal";

  return (
    <div className="flex w-full min-w-0 items-stretch" data-home-side-stats>
      <button
        type="button"
        data-home-body-fat={fatEmpty ? "empty" : "filled"}
        aria-label={fatLabel(bodyFat)}
        onClick={() => {
          setDraft(bodyFat.value == null ? "" : bodyFat.value.toFixed(1));
          setOpen(true);
        }}
        className="min-w-0 flex-1 text-left"
      >
        <span className={labelClass}>Body fat</span>
        <span className="mt-0.5 flex items-baseline gap-0.5">
          <span
            className={`font-display text-lg leading-none tracking-normal ${fatEmpty ? "text-white/75" : "text-[#CBF805]"}`}
          >
            {fatEmpty ? "—" : bodyFat.value!.toFixed(1)}
          </span>
          {fatEmpty ? null : (
            <span className="font-telemetry text-[9px] leading-none text-[#CBF805]">%</span>
          )}
        </span>
        <span
          className={`mt-0.5 block font-telemetry text-[8px] uppercase leading-tight tracking-[0.04em] ${
            fatEmpty ? "text-[#CBF805]" : deltaClass(bodyFat.direction)
          }`}
        >
          {fatDelta}
        </span>
      </button>
      <div className="mx-1.5 w-px shrink-0 self-stretch bg-white/30" aria-hidden />
      <Link
        href="/progress"
        data-home-training={training.mode}
        aria-label={trainingLabel(training)}
        className="min-w-0 flex-1"
      >
        <span className={labelClass}>{fight ? "Days to fight" : "Streak"}</span>
        <span className="mt-0.5 block font-display text-lg leading-none tracking-normal text-[#CBF805]">
          {training.days}
        </span>
        <span className="mt-0.5 block font-telemetry text-[8px] uppercase leading-none tracking-[0.08em] text-white/55">
          {trainingUnit}
        </span>
      </Link>
      {open
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-3 pb-4">
              <button
                type="button"
                aria-label="Close body fat entry"
                className="absolute inset-0"
                onClick={() => setOpen(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="home-body-fat-title"
                data-body-fat-sheet
                className="hc-panel hc-carbon relative w-full max-w-sm px-3 py-3"
              >
                <p
                  id="home-body-fat-title"
                  className="font-telemetry text-[10px] uppercase tracking-[0.22em] text-signal"
                >
                  Body fat %
                </p>
                <form action={action} className="mt-2">
                  <input
                    name="bodyFatPercent"
                    inputMode="decimal"
                    required
                    min={0.1}
                    max={70}
                    step="0.1"
                    value={draft}
                    placeholder="—"
                    aria-label="Body fat percent"
                    onChange={(event) => setDraft(event.target.value)}
                    className="w-full border-0 border-b border-[#CBF805]/50 bg-transparent p-0 font-display text-4xl leading-none text-[#CBF805] outline-none placeholder:text-white/35"
                  />
                  {state.error ? <p className="mt-2 text-xs text-signal">{state.error}</p> : null}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="submit"
                      disabled={pending}
                      data-body-fat-save
                      className="h-8 flex-1 rounded-full bg-accent text-sm text-black disabled:opacity-60"
                    >
                      {pending ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="h-8 flex-1 rounded-full border border-white/25 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
