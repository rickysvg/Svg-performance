"use client";

import { useActionState } from "react";
import {
  createHelpRequestAction,
  type HelpActionState,
} from "@/app/actions/help";
import { StatusBanner } from "@/components/StatusBanner";
import { HELP_TOPICS } from "@/lib/help";

export function HelpRequestForm() {
  const [state, action, pending] = useActionState(
    createHelpRequestAction,
    {} as HelpActionState,
  );
  return (
    <form action={action} className="space-y-3">
      <StatusBanner error={state.error} success={state.success} />
      <label className="block space-y-2 text-sm">
        <span>Topic</span>
        <select
          name="topic"
          defaultValue="training"
          className="w-full rounded-xl border border-line bg-background px-3 py-3"
        >
          {HELP_TOPICS.map((topic) => (
            <option key={topic} value={topic}>
              {topic.replaceAll("-", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-2 text-sm">
        <span>Note</span>
        <textarea
          name="note"
          required
          rows={3}
          className="w-full rounded-xl border border-line bg-background px-3 py-3"
          placeholder="What should the coach look at?"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full border border-line font-medium disabled:opacity-60"
      >
        {pending ? "Sending…" : "Request coach help"}
      </button>
    </form>
  );
}
