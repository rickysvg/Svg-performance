"use client";

import { useMemo, useState } from "react";
import { isYoutubeFormUrl, youtubeThumbSrcs } from "@/lib/form-videos";

function PlayMark() {
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/65">
        <svg viewBox="0 0 12 12" className="ml-0.5 h-3.5 w-3.5 text-accent" aria-hidden>
          <path d="M3 2.2v7.6L10 6z" fill="currentColor" />
        </svg>
      </span>
    </span>
  );
}

export function LearnThumb({
  url,
  pending,
  title,
  compact = false,
}: {
  url: string;
  pending: boolean;
  title: string;
  compact?: boolean;
}) {
  const watchable = !pending && Boolean(url) && isYoutubeFormUrl(url);
  const sources = useMemo(() => (watchable ? youtubeThumbSrcs(url) : []), [url, watchable]);
  const [index, setIndex] = useState(0);
  const sourceKey = `${url}:${watchable}`;
  const [seenKey, setSeenKey] = useState(sourceKey);
  if (sourceKey !== seenKey) {
    setSeenKey(sourceKey);
    setIndex(0);
  }

  const src = sources[Math.min(index, sources.length - 1)];

  return (
    <span
      className={`relative block w-full overflow-hidden rounded-xl bg-card ${
        compact ? "h-36" : "aspect-video"
      }`}
    >
      {src ? (
        // YouTube still — not SVG coaching film.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          onError={() => setIndex((current) => Math.min(current + 1, sources.length - 1))}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full items-center justify-center px-3 text-center text-xs text-muted">
          {pending ? "Video pending coach review" : title}
        </span>
      )}
      {src ? <PlayMark /> : null}
    </span>
  );
}
