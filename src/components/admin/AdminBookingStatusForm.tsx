"use client";

import { useActionState } from "react";
import { setBookingStatusAction, type AdminActionState } from "@/app/actions/admin";
import { StatusBanner } from "@/components/StatusBanner";

export function AdminBookingStatusForm({
  requestId,
  status,
}: {
  requestId: string;
  status: string;
}) {
  const [state, action, pending] = useActionState(
    setBookingStatusAction,
    {} as AdminActionState,
  );
  return (
    <form action={action} className="mt-2 flex flex-wrap items-end gap-2">
      <StatusBanner error={state.error} success={state.success} />
      <input type="hidden" name="requestId" value={requestId} />
      <label className="block text-sm">
        Status
        <select
          name="status"
          defaultValue={status}
          className="mt-1 rounded-xl border border-line bg-background px-3 py-2"
        >
          <option value="open">open</option>
          <option value="seen">seen</option>
          <option value="closed">closed</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="touch-target rounded-full border border-line px-4 text-sm disabled:opacity-60"
      >
        {pending ? "Saving…" : "Update"}
      </button>
    </form>
  );
}
