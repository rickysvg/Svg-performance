"use client";

import { useActionState } from "react";
import { saveBookingNextStepsAction, type CoachingActionState } from "@/app/actions/coaching";
import { StatusBanner } from "@/components/StatusBanner";

export function BookingNextStepsForm({
  requestId,
  defaultValue = "",
}: {
  requestId: string;
  defaultValue?: string;
}) {
  const [state, action, pending] = useActionState(
    saveBookingNextStepsAction,
    {} as CoachingActionState,
  );
  return (
    <form action={action} className="mt-2 space-y-2">
      <StatusBanner error={state.error} success={state.success} />
      <input type="hidden" name="requestId" value={requestId} />
      <textarea
        name="nextSteps"
        rows={3}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-line bg-background px-3 py-2 text-sm"
        placeholder="Agreed next steps after the call. Member sees this on Book."
      />
      <button
        type="submit"
        disabled={pending}
        className="text-sm text-accent underline disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save next steps"}
      </button>
    </form>
  );
}
