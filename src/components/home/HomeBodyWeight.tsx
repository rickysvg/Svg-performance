"use client";

import { useActionState, useState } from "react";
import { saveBodyMetricAction, type BodyMetricActionState } from "@/app/actions/body-metrics";
import { StatusBanner } from "@/components/StatusBanner";
import { MASS_DIAL, MassGauge } from "@/components/home/MassGauge";
import { massSpeedoClass } from "@/components/home/mass-fonts";
import type { MassGauge as MassGaugeScale } from "@/lib/mass-caption";

function inlineUnit(unit: string) {
  const normalized = unit === "kg" ? "lb" : unit || "lb";
  return normalized === "lb" ? "(lbs)" : `(${normalized})`;
}

export function HomeBodyWeight({
  value,
  unit,
  caption,
  carbon = true,
  gauge = { t: 0, goalT: null },
}: {
  value: number | null;
  unit: string;
  caption: string;
  carbon?: boolean;
  gauge?: MassGaugeScale;
}) {
  const [state, action, pending] = useActionState(
    saveBodyMetricAction,
    {} as BodyMetricActionState,
  );
  const recordedAt = new Date().toISOString();
  const initial = value == null ? "" : String(value);
  const [draft, setDraft] = useState(initial);
  const figureWidth = `${Math.max(draft.length, 1)}ch`;

  return (
    <form action={action} data-mass-box className={carbon ? "hc-panel hc-carbon px-3 py-2" : "px-0 py-1"}>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <span className="hc-kicker mb-1 block">Mass</span>
          <div
            className="relative max-w-full"
            style={{
              width: MASS_DIAL.width,
              aspectRatio: `${MASS_DIAL.width} / ${MASS_DIAL.height}`,
            }}
          >
            <MassGauge gauge={gauge} live={value != null} />
            <label
              className="absolute z-10"
              style={{
                left: "50%",
                top: `${MASS_DIAL.baseline * 100}%`,
                transform: "translate(-50%, -100%)",
              }}
            >
              <span className="inline-flex items-end">
                <input
                  name="value"
                  inputMode="decimal"
                  required
                  min={1}
                  step="0.1"
                  value={draft}
                  placeholder="—"
                  aria-label="Body weight in pounds"
                  onChange={(event) => setDraft(event.target.value)}
                  style={{ width: figureWidth, textAlign: "center" }}
                  className={`block bg-transparent text-center text-3xl leading-none text-[#CBF805] outline-none tabular-nums ${massSpeedoClass}`}
                />
                <span className="mb-1 ml-1 font-telemetry text-[10px] leading-none tracking-[0.16em] text-[#CBF805] [text-shadow:0_0_4px_#07080a]">
                  {inlineUnit(unit)}
                </span>
              </span>
            </label>
          </div>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="touch-target mb-0.5 shrink-0 rounded-full bg-accent px-3 text-sm font-semibold text-black disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <input type="hidden" name="kind" value="weight" />
      <input type="hidden" name="unit" value={unit === "kg" ? "lb" : unit || "lb"} />
      <input type="hidden" name="recordedAt" value={recordedAt} />
      <input type="hidden" name="notes" value="" />
      <p className="mt-0.5 text-center font-telemetry text-[10px] uppercase leading-tight tracking-[0.16em] text-[#CBF805]/85">
        {caption}
      </p>
      <StatusBanner error={state.error} success={state.success} />
    </form>
  );
}
