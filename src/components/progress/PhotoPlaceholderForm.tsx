"use client";

import { useActionState } from "react";
import {
  savePhotoPlaceholderAction,
  type BodyMetricActionState,
} from "@/app/actions/body-metrics";
import { StatusBanner } from "@/components/StatusBanner";

function todayDateValue() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function PhotoPlaceholderForm() {
  const [state, action, pending] = useActionState(
    savePhotoPlaceholderAction,
    {} as BodyMetricActionState,
  );

  return (
    <form action={action} className="mt-4 space-y-3">
      <StatusBanner error={state.error} success={state.success} />
      <p className="text-xs text-muted">
        Placeholder only. No camera roll, no file upload, no wearable photo sync.
      </p>
      <label className="block text-sm">
        Slot
        <select
          name="slot"
          defaultValue="front"
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        >
          <option value="front">Front</option>
          <option value="side">Side</option>
          <option value="back">Back</option>
        </select>
      </label>
      <label className="block text-sm">
        Check-in date
        <input
          name="recordedAt"
          type="date"
          defaultValue={todayDateValue()}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        />
      </label>
      <label className="block text-sm">
        Caption (optional)
        <input
          name="caption"
          maxLength={120}
          placeholder="Example: week 1 check-in"
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full border border-line font-medium disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save placeholder date"}
      </button>
    </form>
  );
}
