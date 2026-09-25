"use client";

import { useActionState } from "react";
import { saveWeeklyCommentAction, type CoachingActionState } from "@/app/actions/coaching";
import { StatusBanner } from "@/components/StatusBanner";

export function WeeklyCommentForm({ memberUserId }: { memberUserId: string }) {
  const [state, action, pending] = useActionState(
    saveWeeklyCommentAction,
    {} as CoachingActionState,
  );
  return (
    <form action={action} className="space-y-2">
      <StatusBanner error={state.error} success={state.success} />
      <input type="hidden" name="memberUserId" value={memberUserId} />
      <textarea
        name="body"
        rows={3}
        required
        className="w-full rounded-xl border border-line bg-background px-3 py-3 text-sm"
        placeholder="Write in your own words. Empty until you save. Do not paste a fake Ricky quote."
      />
      <button
        type="submit"
        disabled={pending}
        className="touch-target rounded-full bg-accent px-4 text-sm text-black disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save weekly comment"}
      </button>
    </form>
  );
}
