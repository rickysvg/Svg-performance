"use client";

import { useActionState } from "react";
import {
  uploadProgressPhotoAction,
  type BodyMetricActionState,
} from "@/app/actions/body-metrics";
import { StatusBanner } from "@/components/StatusBanner";

function todayDateValue() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function PhotoUploadForm() {
  const [state, action, pending] = useActionState(
    uploadProgressPhotoAction,
    {} as BodyMetricActionState,
  );

  return (
    <form action={action} className="mt-4 space-y-3">
      <StatusBanner error={state.error} success={state.success} />
      <label className="block text-sm">
        Photo
        <input
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3 text-sm"
        />
      </label>
      <label className="block text-sm">
        Date taken
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
        className="touch-target w-full rounded-full bg-accent font-semibold text-black disabled:opacity-60"
      >
        {pending ? "Uploading…" : "Upload photo"}
      </button>
    </form>
  );
}
