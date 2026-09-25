"use client";

import { useActionState } from "react";
import { createJournalEntryAction, type JournalActionState } from "@/app/actions/journal";
import { StatusBanner } from "@/components/StatusBanner";
import { JOURNAL_KIND_LABELS, JOURNAL_KINDS } from "@/lib/journal";

export function JournalForm() {
  const [state, action, pending] = useActionState(
    createJournalEntryAction,
    {} as JournalActionState,
  );
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-line bg-card p-5">
      <h2>New entry</h2>
      <StatusBanner error={state.error} success={state.success} />
      <label className="block space-y-2 text-sm">
        <span>Type</span>
        <select
          name="kind"
          defaultValue="note"
          className="w-full rounded-xl border border-line bg-background px-3 py-3"
        >
          {JOURNAL_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {JOURNAL_KIND_LABELS[kind]}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-2 text-sm">
        <span>Title</span>
        <input
          name="title"
          required
          className="w-full rounded-xl border border-line bg-background px-3 py-3"
        />
      </label>
      <label className="block space-y-2 text-sm">
        <span>Notes</span>
        <textarea
          name="body"
          required
          rows={4}
          className="w-full rounded-xl border border-line bg-background px-3 py-3"
          placeholder="Your words. A coach can add feedback later on coaching tiers."
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent text-black disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save entry"}
      </button>
    </form>
  );
}
