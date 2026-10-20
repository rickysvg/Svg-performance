"use client";

import { useActionState, useState } from "react";
import { saveBodyMetricAction, type BodyMetricActionState } from "@/app/actions/body-metrics";
import { StatusBanner } from "@/components/StatusBanner";
import { Digit, MassGauge, segmentGlyphs } from "@/components/home/MassGauge";
import type { MassFontId, MassGauge as MassGaugeScale } from "@/lib/mass-caption";

function inlineUnit(unit: string) {
  const normalized = unit === "kg" ? "lb" : unit || "lb";
  return normalized === "lb" ? "(lbs)" : `(${normalized})`;
}

export function HomeBodyWeight({
  value,
  unit,
  caption,
  carbon = true,
  variant = 1,
  speedoClassName = "",
  gauge = { t: 0, goalT: null },
}: {
  value: number | null;
  unit: string;
  caption: string;
  carbon?: boolean;
  variant?: MassFontId;
  speedoClassName?: string;
  gauge?: MassGaugeScale;
}) {
  const [state, action, pending] = useActionState(
    saveBodyMetricAction,
    {} as BodyMetricActionState,
  );
  const recordedAt = new Date().toISOString();
  const initial = value == null ? "" : String(value);
  const [draft, setDraft] = useState(initial);
  const glyphs = segmentGlyphs(draft);
  const figureWidth = `${Math.max(draft.length, 1) + 0.8}ch`;

  return (
    <form
      action={action}
      data-mass-box
      data-mass-font={variant}
      className={carbon ? "hc-panel hc-carbon px-3 py-2" : "px-0 py-1"}
    >
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <span className="hc-kicker absolute left-0 top-0 z-10">Mass</span>
          <MassGauge gauge={gauge} variant={variant} live={value != null} />
          <label className="relative z-10 flex items-end justify-center gap-1 pt-6">
            {variant === 1 ? (
              <span className="relative inline-flex items-end">
                <span aria-hidden className="inline-flex items-end">
                  {glyphs.map((glyph, index) => (
                    <DigitSlot key={`${glyph.char}-${index}`} char={glyph.char} ghost={glyph.ghost} />
                  ))}
                </span>
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
                  className="absolute inset-0 w-full bg-transparent text-3xl text-transparent caret-[#CBF805] outline-none placeholder:text-transparent"
                />
              </span>
            ) : (
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
                style={{ width: figureWidth }}
                className={`max-w-full bg-transparent text-3xl leading-none text-[#CBF805] outline-none tabular-nums ${speedoClassName}`}
              />
            )}
            <span className="mb-0.5 font-telemetry text-[10px] leading-none tracking-[0.16em] text-[#CBF805]/80">
              {inlineUnit(unit)}
            </span>
          </label>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="touch-target shrink-0 rounded-full bg-accent px-3 text-sm font-semibold text-black disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <input type="hidden" name="kind" value="weight" />
      <input type="hidden" name="unit" value={unit === "kg" ? "lb" : unit || "lb"} />
      <input type="hidden" name="recordedAt" value={recordedAt} />
      <input type="hidden" name="notes" value="" />
      <p className="mt-1 text-center font-telemetry text-[10px] uppercase leading-tight tracking-[0.16em] text-[#CBF805]/85">
        {caption}
      </p>
      <StatusBanner error={state.error} success={state.success} />
    </form>
  );
}

function DigitSlot({ char, ghost }: { char: string; ghost: boolean }) {
  return <Digit char={char} ghost={ghost} />;
}
