"use client";

import { useActionState } from "react";
import { sendCoachMessageAction, type CoachActionState } from "@/app/actions/coach";
import { StatusBanner } from "@/components/StatusBanner";

export function CoachChatForm() {
  const [state, action, pending] = useActionState(
    sendCoachMessageAction,
    {} as CoachActionState,
  );
  return (
    <form action={action} className="space-y-3">
      <StatusBanner error={state.error} />
      <label className="block text-sm">
        Message
        <textarea
          name="message"
          required
          rows={4}
          className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-3"
          placeholder="Ask about training between classes."
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent font-semibold text-black disabled:opacity-60"
      >
        {pending ? "Thinking…" : "Send"}
      </button>
    </form>
  );
}
