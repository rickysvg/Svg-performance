"use client";

import { useActionState } from "react";
import { saveBodyMetricAction, type BodyMetricActionState } from "@/app/actions/body-metrics";
import { StatusBanner } from "@/components/StatusBanner";

export function HomeBodyWeight({
  value,
  unit,
}: {
  value: number | null;
  unit: string;
}) {
  const [state, action, pending] = useActionState(
    saveBodyMetricAction,
    {} as BodyMetricActionState,
  );
  const recordedAt = new Date().toISOString();

  return (
    <form action={action} className="rounded-[1.75rem] border border-line bg-card px-4 py-4">
      <div className="flex items-end justify-between gap-3">
        <label className="min-w-0 flex-1">
          <span className="text-sm font-medium">Body weight</span>
          <span className="mt-1 flex items-baseline gap-2">
            <input
              name="value"
              inputMode="decimal"
              required
              min={1}
              step="0.1"
              defaultValue={value ?? ""}
              placeholder="—"
              aria-label="Body weight in pounds"
              className="w-full min-w-0 bg-transparent font-display text-4xl leading-none outline-none"
            />
            <span className="shrink-0 text-sm text-muted">{unit}</span>
          </span>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="touch-target shrink-0 rounded-full bg-accent px-4 text-sm font-semibold text-black disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <input type="hidden" name="kind" value="weight" />
      <input type="hidden" name="unit" value={unit === "kg" ? "lb" : unit || "lb"} />
      <input type="hidden" name="recordedAt" value={recordedAt} />
      <input type="hidden" name="notes" value="" />
      <p className="mt-2 text-xs text-muted">Typed by you. Change the number and save.</p>
      <StatusBanner error={state.error} success={state.success} />
    </form>
  );
}
