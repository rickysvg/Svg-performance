"use client";

import { useActionState, useState } from "react";
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
  const [kind, setKind] = useState("weight");

  return (
    <form action={action} className="space-y-2 rounded-2xl border border-line bg-card p-3">
      <h2 className="text-lg">Log a body metric</h2>
      <p className="text-sm text-muted">
        Type a number yourself. Apple Health import and Polar live on Heart rate. Sleep /
        lean / fat stay typed — no fake Apple Watch pairing.
      </p>
      <StatusBanner error={state.error} success={state.success} />
      <label className="block text-sm">
        Metric
        <select
          name="kind"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-2"
        >
          <option value="weight">Body weight</option>
          <option value="sleepHours">Sleep (hours, last night)</option>
          <option value="restingHr">Resting heart rate</option>
          <option value="leanMass">Lean body mass</option>
          <option value="bodyFat">Body fat %</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm">
          Value
          <input
            data-testid="progress-value"
            name="value"
            type="number"
            min={0.1}
            step="0.1"
            required
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Unit
          <select
            name="unit"
            defaultValue="lb"
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-2"
          >
            <option value="lb">lb (weight / lean mass)</option>
            <option value="hours">hours (sleep)</option>
            <option value="bpm">bpm (heart rate)</option>
            <option value="percent">percent (body fat)</option>
          </select>
        </label>
      </div>
      {kind === "weight" ? (
        <label className="block text-sm">
          Body fat % (optional)
          <input
            name="bodyFatPercent"
            type="number"
            inputMode="decimal"
            min={0.1}
            max={70}
            step="0.1"
            placeholder="—"
            aria-label="Body fat percent, optional"
            className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-2"
          />
        </label>
      ) : null}
      <label className="block text-sm">
        When
        <input
          data-testid="progress-recorded-at"
          name="recordedAt"
          type="datetime-local"
          defaultValue={todayInputValue()}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        Notes (optional)
        <input
          data-testid="progress-notes"
          name="notes"
          maxLength={200}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-2"
        />
      </label>
      <button
        data-testid="progress-save-metric"
        type="submit"
        disabled={pending}
        className="h-9 w-full rounded-full bg-accent text-sm text-black disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save metric"}
      </button>
    </form>
  );
}
