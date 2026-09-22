import { isYoutubeFormUrl } from "@/lib/form-videos";

export function WatchForm({
  url,
  pending,
  actionLabel = "Watch form",
  caption = "Form reference (YouTube) — not an SVG-produced video",
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
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="touch-target mt-3 inline-flex flex-col justify-center rounded-full border border-accent/50 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/10"
    >
      {actionLabel}
      <span className="text-[11px] font-normal text-muted">{caption}</span>
    </a>
  );
}

export function WatchFormInline({
  url,
  pending,
}: {
  url: string;
  pending: boolean;
}) {
  if (pending || !url || !isYoutubeFormUrl(url)) {
    return <span className="text-xs text-muted">Video pending coach review</span>;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="text-xs font-semibold text-accent underline-offset-4 hover:underline"
    >
      Watch form
    </a>
  );
}
