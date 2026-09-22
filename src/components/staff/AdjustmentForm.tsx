"use client";

import { useActionState } from "react";
import { addAdjustmentAction, type CoachingActionState } from "@/app/actions/coaching";
import { StatusBanner } from "@/components/StatusBanner";

export function AdjustmentForm({ memberUserId }: { memberUserId: string }) {
  const [state, action, pending] = useActionState(
    addAdjustmentAction,
    {} as CoachingActionState,
  );
  return (
    <form action={action} className="space-y-2">
      <StatusBanner error={state.error} success={state.success} />
      <input type="hidden" name="memberUserId" value={memberUserId} />
      <input
        name="body"
        required
        className="w-full rounded-xl border border-line bg-background px-3 py-3 text-sm"
        placeholder="Simple adjustment (load, volume, rest). Not a medical plan."
      />
      <button
        type="submit"
        disabled={pending}
        className="text-sm text-accent underline disabled:opacity-60"
      >
        {pending ? "Saving…" : "Log adjustment"}
      </button>
    </form>
  );
}
