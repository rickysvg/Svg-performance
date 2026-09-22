"use client";

import { useActionState } from "react";
import {
  saveBodyMetricAction,
  type BodyMetricActionState,
} from "@/app/actions/body-metrics";
import { StatusBanner } from "@/components/StatusBanner";
import type { LoadUnit } from "@/lib/units";

function todayInputValue() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function BodyMetricForm({ preferredUnits }: { preferredUnits: LoadUnit }) {
  const [state, action, pending] = useActionState(
    saveBodyMetricAction,
    {} as BodyMetricActionState,
  );

  return (
    <form action={action} className="space-y-3 rounded-2xl border border-line bg-card p-5">
      <h2 className="text-lg font-semibold">Log a body metric</h2>
      <p className="text-sm text-muted">
        Type a number yourself. Polar and CSV import live on Heart rate. Sleep / lean / fat
        stay typed — no fake Apple Watch pairing.
      </p>
      <StatusBanner error={state.error} success={state.success} />
      <label className="block text-sm">
        Metric
        <select
          name="kind"
          defaultValue="weight"
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        >
          <option value="weight">Body weight</option>
          <option value="sleepHours">Sleep (hours, last night)</option>
          <option value="restingHr">Resting heart rate</option>
          <option value="leanMass">Lean body mass</option>
          <option value="bodyFat">Body fat %</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          Value
          <input
            name="value"
            type="number"
            min={0.1}
            step="0.1"
            required
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          />
        </label>
        <label className="block text-sm">
          Unit
          <select
            name="unit"
            defaultValue={preferredUnits}
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
          >
            <option value={preferredUnits}>{preferredUnits} (weight / lean mass)</option>
            {preferredUnits === "lb" ? <option value="kg">kg</option> : <option value="lb">lb</option>}
            <option value="hours">hours (sleep)</option>
            <option value="bpm">bpm (heart rate)</option>
            <option value="percent">percent (body fat)</option>
          </select>
        </label>
      </div>
      <label className="block text-sm">
        When
        <input
          name="recordedAt"
          type="datetime-local"
          defaultValue={todayInputValue()}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        />
      </label>
      <label className="block text-sm">
        Notes (optional)
        <input
          name="notes"
          maxLength={200}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent font-semibold text-black disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save metric"}
      </button>
    </form>
  );
}
