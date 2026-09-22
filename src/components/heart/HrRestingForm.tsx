"use client";

import { useActionState } from "react";
import { saveRestingHrAction, type HeartActionState } from "@/app/actions/heart";
import { StatusBanner } from "@/components/StatusBanner";

function nowInput() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function HrRestingForm() {
  const [state, action, pending] = useActionState(saveRestingHrAction, {} as HeartActionState);
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-line bg-card p-5">
      <h2 className="font-semibold">Resting heart rate</h2>
      <p className="text-sm text-muted">Type a morning reading. Labeled manual.</p>
      <StatusBanner error={state.error} success={state.success} />
      <label className="block space-y-2 text-sm">
        <span>BPM</span>
        <input
          name="bpm"
          type="number"
          min={30}
          max={230}
          required
          className="w-full rounded-xl border border-line bg-background px-3 py-3"
        />
      </label>
      <label className="block space-y-2 text-sm">
        <span>When</span>
        <input
          name="recordedAt"
          type="datetime-local"
          defaultValue={nowInput()}
          className="w-full rounded-xl border border-line bg-background px-3 py-3"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent font-semibold text-black disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save resting HR"}
      </button>
    </form>
  );
}
