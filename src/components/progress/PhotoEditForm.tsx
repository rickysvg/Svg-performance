"use client";

import { useActionState } from "react";
import {
  updateProgressPhotoAction,
  type BodyMetricActionState,
} from "@/app/actions/body-metrics";
import { StatusBanner } from "@/components/StatusBanner";

function dateValue(value: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export function PhotoEditForm({
  photoId,
  caption,
  recordedAt,
}: {
  photoId: string;
  caption: string;
  recordedAt: Date;
}) {
  const [state, action, pending] = useActionState(
    updateProgressPhotoAction,
    {} as BodyMetricActionState,
  );

  return (
    <form action={action} className="space-y-3">
      <StatusBanner error={state.error} success={state.success} />
      <input type="hidden" name="photoId" value={photoId} />
      <label className="block text-sm">
        Date taken
        <input
          name="recordedAt"
          type="date"
          defaultValue={dateValue(recordedAt)}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        />
      </label>
      <label className="block text-sm">
        Caption
        <input
          name="caption"
          maxLength={120}
          defaultValue={caption}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full border border-line font-medium disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save caption and date"}
      </button>
    </form>
  );
}
