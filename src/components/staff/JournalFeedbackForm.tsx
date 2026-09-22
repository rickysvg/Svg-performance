"use client";

import { useActionState } from "react";
import { addJournalFeedbackAction, type CoachingActionState } from "@/app/actions/coaching";
import { StatusBanner } from "@/components/StatusBanner";

export function JournalFeedbackForm({ entryId }: { entryId: string }) {
  const [state, action, pending] = useActionState(
    addJournalFeedbackAction,
    {} as CoachingActionState,
  );
  return (
    <form action={action} className="mt-2 space-y-2">
      <StatusBanner error={state.error} success={state.success} />
      <input type="hidden" name="entryId" value={entryId} />
      <textarea
        name="body"
        required
        rows={2}
        className="w-full rounded-xl border border-line bg-background px-3 py-2 text-sm"
        placeholder="Coach feedback in your own words"
      />
      <textarea
        name="actionItems"
        rows={2}
        className="w-full rounded-xl border border-line bg-background px-3 py-2 text-sm"
        placeholder="Action items (optional)"
      />
      <button
        type="submit"
        disabled={pending}
        className="text-sm text-accent underline disabled:opacity-60"
      >
        {pending ? "Saving…" : "Add feedback"}
      </button>
    </form>
  );
}
