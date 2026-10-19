"use client";

import { isYoutubeFormUrl } from "@/lib/form-videos";
import { FormClipPlayer } from "@/components/training/FormClipPlayer";

export function WatchForm({
  url,
  pending,
  actionLabel = "Watch form",
  caption = "Form reference — plays in the app",
}: {
  url: string;
  pending: boolean;
  actionLabel?: string;
  caption?: string;
}) {
  if (pending || !url || !isYoutubeFormUrl(url)) {
    return (
      <p className="mt-3 rounded-xl border border-line bg-background px-3 py-2 text-sm text-muted">
        Video pending coach review
      </p>
    );
  }

  return (
    <FormClipPlayer
      name={actionLabel}
      url={url}
      className="touch-target mt-3 inline-flex flex-col justify-center rounded-full border border-accent/50 px-4 py-2 text-left text-sm font-semibold text-accent hover:bg-accent/10"
    >
      {actionLabel}
      <span className="text-[11px] font-normal text-muted">{caption}</span>
    </FormClipPlayer>
  );
}

export function WatchFormInline({
  url,
  pending,
  name = "this exercise",
}: {
  url: string;
  pending: boolean;
  name?: string;
}) {
  if (pending || !url || !isYoutubeFormUrl(url)) {
    return <span className="text-xs text-muted">Video pending coach review</span>;
  }
  return (
    <FormClipPlayer name={name} url={url} className="text-xs font-semibold text-accent underline-offset-4 hover:underline">
      Watch form
    </FormClipPlayer>
  );
}
