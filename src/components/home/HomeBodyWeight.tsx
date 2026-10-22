"use client";

import { useActionState, useId, useState } from "react";
import { createPortal } from "react-dom";
import { saveBodyMetricAction, type BodyMetricActionState } from "@/app/actions/body-metrics";
import { StatusBanner } from "@/components/StatusBanner";
import { Toast } from "@/components/Toast";
import { HomeSideStats } from "@/components/home/HomeSideStats";
import { MASS_DIAL, MassGauge } from "@/components/home/MassGauge";
import { massSpeedoClass, massUnitClass } from "@/components/home/mass-fonts";
import { clampOneDecimalDraft, formatOneDecimal } from "@/lib/body-metrics";
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
  bodyFatValue,
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
  /** Latest saved body fat. Progress passes this so the weigh-in form can show and edit it. */
  bodyFatValue?: number | null;
}) {
  const formId = useId();
  const [state, action, pending] = useActionState(
    saveBodyMetricAction,
    {} as BodyMetricActionState,
  );
  const recordedAt = new Date().toISOString();
  const initial = value == null ? "" : formatOneDecimal(value);
  const savedFat = side?.bodyFat.value ?? bodyFatValue ?? null;
  const savedFatText = savedFat == null ? "" : savedFat.toFixed(1);
  const [draft, setDraft] = useState(initial);
  const [fatDraft, setFatDraft] = useState(savedFatText);
  const [sheet, setSheet] = useState(false);
  const [closedFor, setClosedFor] = useState<number | undefined>();
  const [closedNotice, setClosedNotice] = useState<number | string | undefined>();
  const showSide = side != null;
  const showFatField = bodyFatValue !== undefined && !showSide;
  const notice = state.error || state.success;
  const noticeKey = state.savedAt ?? (state.error ? `error:${state.error}` : undefined);
  const showNotice = Boolean(!sheet && notice && noticeKey !== undefined && noticeKey !== closedNotice);
  if (state.savedAt && sheet && closedFor !== state.savedAt) {
    setClosedFor(state.savedAt);
    setSheet(false);
  }

  const saveButton = (
    <button
      type="button"
      data-weigh-in-open
      onClick={() => setSheet(true)}
      className="box-border h-9 w-full shrink-0 appearance-none rounded-full bg-accent px-2.5 py-0 text-[10px] uppercase leading-none tracking-wide text-black"
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
          data-weight-value={draft}
          onChange={(event) => setDraft(clampOneDecimalDraft(event.target.value))}
          style={{ fieldSizing: "content", gridArea: "1 / 1", justifySelf: "center" }}
          className={`mass-weight-input block w-auto min-w-[4.5ch] overflow-visible border-0 bg-transparent p-0 text-center leading-none text-[#CBF805] outline-none tabular-nums ${
            draft.length >= 5 ? "text-[1.65rem]" : "text-3xl"
          } ${massSpeedoClass}`}
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
      data-testid="home-mass-box"
      id={formId}
      action={action}
      data-mass-box
      className={carbon ? "hc-panel hc-carbon px-2.5 pt-1 pb-1.5" : "px-0 py-0.5"}
    >
      {showSide && side ? (
        <div data-mass-row className="flex items-stretch gap-1">
          <div
            data-mass-dial-col
            className="flex shrink-0 flex-col items-center justify-center"
            style={{ width: MASS_DIAL.width }}
          >
            <div className="w-full text-center">{label}</div>
            {dial}
            <div className="-mt-2 w-full">{captionLine}</div>
          </div>
          {/* Block stack sized to the dial. A nested flex column lets Safari
              clip Save; a tall button leaves a hole under the weight. */}
          <div className="min-w-0 flex-1 border-l border-white/15 pl-1">
            <HomeSideStats
              bodyFat={side.bodyFat}
              training={side.training}
              fatDraft={fatDraft}
              onFatDraft={setFatDraft}
            />
            <div className="mt-0.5">{saveButton}</div>
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
          {showFatField ? (
            <label className="mt-2 block text-sm">
              <span className="font-telemetry text-[10px] uppercase tracking-[0.16em] text-signal">
                Body fat % <span className="tracking-normal text-white/45">optional</span>
              </span>
              <input
                name="bodyFatPercent"
                inputMode="decimal"
                min={0.1}
                max={70}
                step="0.1"
                value={fatDraft}
                placeholder="—"
                aria-label="Body fat percent, optional"
                data-progress-body-fat-field
                onChange={(event) => setFatDraft(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-line bg-white px-4 py-3 text-base text-black outline-none"
              />
            </label>
          ) : null}
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
                data-testid="home-weigh-in-sheet"
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
                <p className="mt-2 font-display text-2xl leading-none text-[#CBF805]" data-weigh-sheet-fat>
                  {fatDraft.trim() ? fatDraft.trim() : "—"}
                  <span className="ml-2 font-telemetry text-sm tracking-normal text-signal">body fat %</span>
                </p>
                <div className="mt-4">
                  <StatusBanner error={state.error} success={state.success} />
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    data-testid="home-save-weigh-in"
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
      {showNotice && notice ? (
        <Toast
          closeTestId="home-weigh-toast-close"
          key={String(noticeKey)}
          message={notice}
          tone={state.error ? "danger" : "lime"}
          onDismiss={() => setClosedNotice(noticeKey)}
          attrs={{ "data-weigh-toast": "" }}
        />
      ) : null}
    </form>
  );
}
