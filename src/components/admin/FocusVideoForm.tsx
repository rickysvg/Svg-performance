"use client";

import { useActionState } from "react";
import { saveFocusVideoAction, type FocusActionState } from "@/app/actions/focus";
import { StatusBanner } from "@/components/StatusBanner";

export function FocusVideoForm() {
  const [state, action, pending] = useActionState(saveFocusVideoAction, {} as FocusActionState);
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-line bg-card p-5">
      <h2 className="font-semibold">Schedule a 60–90s focus video</h2>
      <p className="text-sm text-muted">
        Paste YouTube/Vimeo or upload a short clip. Drafts stay hidden until published.
        This is not a live stream.
      </p>
      <StatusBanner error={state.error} success={state.success} />
      <input
        name="title"
        required
        placeholder="Title"
        className="w-full rounded-xl border border-line bg-background px-3 py-3"
      />
      <label className="block text-sm">
        Week start (any day in that week)
        <input
          name="weekStart"
          type="date"
          required
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        />
      </label>
      <input
        name="videoUrl"
        placeholder="https://www.youtube.com/watch?v=…"
        className="w-full rounded-xl border border-line bg-background px-3 py-3"
      />
      <input name="clip" type="file" accept="video/mp4,video/webm" className="w-full text-sm" />
      <textarea
        name="scriptNotes"
        rows={3}
        placeholder="Optional script notes for Ricky"
        className="w-full rounded-xl border border-line bg-background px-3 py-3"
      />
      <label className="block text-sm">
        Status
        <select name="status" className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3">
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isDemo" className="h-5 w-5 accent-accent" />
        Label DEMO
      </label>
      <button
        type="submit"
        disabled={pending}
        className="touch-target rounded-full bg-accent px-5 font-semibold text-black disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save video"}
      </button>
    </form>
  );
}
