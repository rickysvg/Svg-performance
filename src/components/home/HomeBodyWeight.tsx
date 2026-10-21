"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { saveBodyMetricAction, type BodyMetricActionState } from "@/app/actions/body-metrics";
import { StatusBanner } from "@/components/StatusBanner";
import { HomeSideStats } from "@/components/home/HomeSideStats";
import { MASS_DIAL, MassGauge } from "@/components/home/MassGauge";
import { massSpeedoClass, massUnitClass } from "@/components/home/mass-fonts";
import type { BodyFatReadout, HomeTrainingReadout } from "@/lib/home-side-stats";
import type { MassGauge as MassGaugeScale } from "@/lib/mass-caption";

function unitLabel(unit: string) {
  const normalized = unit === "kg" ? "lb" : unit || "lb";
  return normalized === "lb" ? "lbs" : normalized;
}

export function HomeBodyWeight({
  value,
  unit,
  caption,
  carbon = true,
  gauge = { t: 0, goalT: null },
  side = null,
}: {
  value: number | null;
  unit: string;
  caption: string;
  carbon?: boolean;
  gauge?: MassGaugeScale;
  side?: {
    bodyFat: BodyFatReadout;
    training: HomeTrainingReadout;
  } | null;
}) {
  const formId = useId();
  const [state, action, pending] = useActionState(
    saveBodyMetricAction,
    {} as BodyMetricActionState,
  );
  const recordedAt = new Date().toISOString();
  const initial = value == null ? "" : String(value);
  const [draft, setDraft] = useState(initial);
  const [sheet, setSheet] = useState(false);
  const showSide = side != null;

  useEffect(() => {
    if (state.success) setSheet(false);
  }, [state.success]);

  const saveButton = (
    <button
      type="button"
      data-weigh-in-open
      onClick={() => setSheet(true)}
      className="h-5 w-full rounded-full bg-accent px-3 text-[11px] uppercase leading-none tracking-wide text-black"
    >
      Save
    </button>
  );

  const captionLine = (
    <p className="text-center font-telemetry text-[10px] uppercase leading-none tracking-[0.16em] text-[#CBF805]/85">
      {caption.startsWith("▼") ? <span className="text-signal">{caption.slice(0, 1)}</span> : null}
      {caption.startsWith("▼") ? caption.slice(1) : caption}
    </p>
  );

  const dial = (
    <div
      className="relative shrink-0"
      style={{ width: MASS_DIAL.width, height: MASS_DIAL.height }}
    >
      <MassGauge gauge={gauge} live={value != null} />
      <label
        className="absolute z-10 grid items-baseline"
        style={{
          left: "50%",
          top: `${MASS_DIAL.baseline * 100}%`,
          transform: "translate(-50%, -100%)",
        }}
      >
        <input
          name="value"
          inputMode="decimal"
          required
          min={1}
          step="0.1"
          size={Math.max(draft.length, 1)}
          value={draft}
          placeholder="—"
          aria-label="Body weight in pounds"
          onChange={(event) => setDraft(event.target.value)}
          style={{ fieldSizing: "content", gridArea: "1 / 1", justifySelf: "center" }}
          className={`block w-auto min-w-[1ch] border-0 bg-transparent p-0 text-center text-3xl leading-none text-[#CBF805] outline-none tabular-nums ${massSpeedoClass}`}
        />
        <span
          data-mass-unit
          aria-hidden
          className={`${massUnitClass} text-[11px] font-semibold leading-none tracking-normal text-signal [text-shadow:0_0_1px_#07080a,0_0_6px_rgba(255,59,59,0.35)]`}
          style={{ gridArea: "1 / 1", justifySelf: "end", transform: "translateX(calc(100% + 2px))" }}
        >
          {unitLabel(unit)}
        </span>
      </label>
    </div>
  );

  const label = (
    <span className="-mb-1 block font-telemetry text-[10px] uppercase leading-none tracking-[0.22em] text-signal">
      Current Weight
    </span>
  );

  return (
    <form
      id={formId}
      action={action}
      data-mass-box
      className={carbon ? "hc-panel hc-carbon px-2.5 pt-1 pb-1" : "px-0 py-0.5"}
    >
      {showSide && side ? (
        <div className="relative">
          <div className="shrink-0" style={{ width: MASS_DIAL.width }}>
            {label}
            {dial}
            <div className="-mt-2">{captionLine}</div>
          </div>
          <div
            className="absolute inset-y-0 flex flex-col border-l border-white/15 pl-2"
            style={{ left: MASS_DIAL.width + 8, right: 0 }}
          >
            <HomeSideStats bodyFat={side.bodyFat} training={side.training} />
            <div className="mt-auto shrink-0">{saveButton}</div>
          </div>
        </div>
      ) : (
        <div>
          {label}
          <div className="flex items-end gap-3">
            {dial}
            <div className="mb-1 w-24 shrink-0">{saveButton}</div>
          </div>
          <div className="-mt-2" style={{ width: MASS_DIAL.width }}>
            {captionLine}
          </div>
        </div>
      )}
      <input type="hidden" name="kind" value="weight" />
      <input type="hidden" name="unit" value={unit === "kg" ? "lb" : unit || "lb"} />
      <input type="hidden" name="recordedAt" value={recordedAt} />
      <input type="hidden" name="notes" value="" />
      {sheet
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-6 sm:items-center">
              <button
                type="button"
                aria-label="Close weigh-in"
                className="absolute inset-0"
                onClick={() => setSheet(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${formId}-title`}
                data-weigh-in-sheet
                className="relative w-full max-w-sm rounded-3xl bg-card px-5 py-5"
              >
                <p
                  id={`${formId}-title`}
                  className="font-telemetry text-[10px] uppercase tracking-[0.22em] text-signal"
                >
                  Current weight
                </p>
                <p className="mt-1 font-display text-4xl leading-none text-[#CBF805]">
                  {draft || "—"}
                  <span className="ml-2 font-telemetry text-sm tracking-normal text-signal">
                    {unitLabel(unit)}
                  </span>
                </p>
                {showSide ? null : (
                  <label className="mt-4 block text-sm">
                    <span className="font-telemetry text-[10px] uppercase tracking-[0.16em] text-signal">
                      Body fat % <span className="tracking-normal text-white/45">optional</span>
                    </span>
                    <input
                      form={formId}
                      name="bodyFatPercent"
                      inputMode="decimal"
                      min={0.1}
                      max={70}
                      step="0.1"
                      placeholder="—"
                      aria-label="Body fat percent, optional"
                      className="mt-1 w-full rounded-2xl border border-line bg-white px-4 py-3 text-base text-black outline-none"
                    />
                  </label>
                )}
                <div className="mt-4">
                  <StatusBanner error={state.error} success={state.success} />
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    form={formId}
                    type="submit"
                    disabled={pending}
                    data-weigh-in-save
                    className="touch-target w-full rounded-full bg-accent text-base text-black disabled:opacity-60"
                  >
                    {pending ? "Saving…" : "Save weigh-in"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSheet(false)}
                    className="touch-target w-full rounded-full border border-line text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {!sheet && (state.error || state.success) ? (
        <div className="mt-2">
          <StatusBanner error={state.error} success={state.success} />
        </div>
      ) : null}
    </form>
  );
}
