"use client";

import { useActionState } from "react";
import { saveBodyMetricAction, type BodyMetricActionState } from "@/app/actions/body-metrics";
import { StatusBanner } from "@/components/StatusBanner";
import type { MassFontId } from "@/lib/mass-caption";

function inlineUnit(unit: string) {
  const normalized = unit === "kg" ? "lb" : unit || "lb";
  return normalized === "lb" ? "(lbs)" : `(${normalized})`;
}

export function HomeBodyWeight({
  value,
  unit,
  caption,
  carbon = true,
  fontClassName = "font-telemetry",
  fontId = 1,
}: {
  value: number | null;
  unit: string;
  caption: string;
  carbon?: boolean;
  fontClassName?: string;
  fontId?: MassFontId;
}) {
  const [state, action, pending] = useActionState(
    saveBodyMetricAction,
    {} as BodyMetricActionState,
  );
  const recordedAt = new Date().toISOString();
  const shown = value == null || value === undefined ? "" : String(value);
  const figureWidth = `${Math.max(shown.length, 1) + 0.6}ch`;

  return (
    <form
      action={action}
      data-mass-box
      data-mass-font={fontId}
      className={carbon ? "hc-panel hc-carbon px-3 py-2" : "px-0 py-1"}
    >
      <div className="flex items-end justify-between gap-3">
        <label className="min-w-0">
          <span className="hc-kicker">Mass</span>
          <span className="mt-1 flex items-baseline gap-1">
            <input
              name="value"
              inputMode="decimal"
              required
              min={1}
              step="0.1"
              defaultValue={shown}
              placeholder="—"
              aria-label="Body weight in pounds"
              style={{ width: figureWidth }}
              className={`max-w-full bg-transparent text-3xl leading-none text-[#CBF805] outline-none tabular-nums ${fontClassName}`}
            />
            <span className={`text-base leading-none text-[#CBF805] ${fontClassName}`}>{inlineUnit(unit)}</span>
          </span>
        </label>
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
      <p className="mt-1 text-[11px] leading-tight text-muted">{caption}</p>
      <StatusBanner error={state.error} success={state.success} />
    </form>
  );
}
