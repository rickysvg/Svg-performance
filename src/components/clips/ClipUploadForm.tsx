"use client";

import { useActionState } from "react";
import { uploadTrainingClipAction, type ClipActionState } from "@/app/actions/clips";
import { StatusBanner } from "@/components/StatusBanner";

export function ClipUploadForm() {
  const [state, action, pending] = useActionState(
    uploadTrainingClipAction,
    {} as ClipActionState,
  );
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-line bg-card p-5">
      <h2>Upload a training clip</h2>
      <p className="text-sm text-muted">
        Private to you and an assigned coach. mp4 or webm, 25 MB max. Not a live stream.
      </p>
      <StatusBanner error={state.error} success={state.success} />
      <input
        name="title"
        required
        placeholder="What should the coach look at?"
        className="w-full rounded-xl border border-line bg-background px-3 py-3"
      />
      <textarea
        name="memberNote"
        rows={3}
        placeholder="Context (optional)"
        className="w-full rounded-xl border border-line bg-background px-3 py-3"
      />
      <input name="clip" type="file" accept="video/mp4,video/webm" required className="w-full text-sm" />
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent text-black disabled:opacity-60"
      >
        {pending ? "Uploading…" : "Upload clip"}
      </button>
    </form>
  );
}
