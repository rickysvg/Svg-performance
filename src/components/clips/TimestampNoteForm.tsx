"use client";

import { useActionState } from "react";
import { addClipNoteAction, type ClipActionState } from "@/app/actions/clips";
import { StatusBanner } from "@/components/StatusBanner";

export function TimestampNoteForm({ clipId }: { clipId: string }) {
  const [state, action, pending] = useActionState(addClipNoteAction, {} as ClipActionState);
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-line bg-card p-5">
      <h2>Add a timestamped note</h2>
      <StatusBanner error={state.error} success={state.success} />
      <input type="hidden" name="clipId" value={clipId} />
      <input
        name="timestamp"
        required
        placeholder="mm:ss (example 0:42)"
        className="w-full rounded-xl border border-line bg-background px-3 py-3"
      />
      <textarea
        name="correction"
        required
        rows={3}
        placeholder="Correction in your own words"
        className="w-full rounded-xl border border-line bg-background px-3 py-3"
      />
      <input
        name="drill"
        placeholder="Drill to practice"
        className="w-full rounded-xl border border-line bg-background px-3 py-3"
      />
      <button
        type="submit"
        disabled={pending}
        className="touch-target rounded-full bg-accent px-5 text-black disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save note"}
      </button>
    </form>
  );
}
