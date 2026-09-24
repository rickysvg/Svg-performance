"use client";

import { useMemo, useState } from "react";
import { exerciseThumbSrc, fallbackThumbSrc } from "@/lib/exercise-media";
import {
  isYoutubeFormUrl,
  lookupFormVideo,
  youtubeThumbSrcs,
} from "@/lib/form-videos";

const FORM_CAPTION = "Form reference (YouTube) — not an SVG-produced video";

function PlayMark() {
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/65">
        <svg viewBox="0 0 12 12" className="ml-0.5 h-3 w-3 text-accent" aria-hidden>
          <path d="M3 2.2v7.6L10 6z" fill="currentColor" />
        </svg>
      </span>
    </span>
  );
}

export function ExerciseThumb({
  name,
  size = 56,
  formVideoUrl,
  formVideoPending,
}: {
  name: string;
  size?: number;
  formVideoUrl?: string;
  formVideoPending?: boolean;
}) {
  const lookedUp = lookupFormVideo(name);
  const url = formVideoUrl !== undefined ? formVideoUrl : lookedUp.url;
  const pending = formVideoPending !== undefined ? formVideoPending : lookedUp.pending;
  const watchable = !pending && Boolean(url) && isYoutubeFormUrl(url);
  const videoStills = useMemo(() => (watchable ? youtubeThumbSrcs(url) : []), [url, watchable]);
  const sources = useMemo(
    () => [...videoStills, exerciseThumbSrc(name), fallbackThumbSrc()],
    [name, videoStills],
  );

  const [index, setIndex] = useState(0);
  const sourceKey = `${name}:${url}:${watchable}`;
  const [seenKey, setSeenKey] = useState(sourceKey);
  if (sourceKey !== seenKey) {
    setSeenKey(sourceKey);
    setIndex(0);
  }

  const src = sources[Math.min(index, sources.length - 1)] ?? fallbackThumbSrc();
  const showingVideoStill = index < videoStills.length;

  const image = (
    // YouTube still or local silhouette fallback — not SVG coaching film.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      onError={() => setIndex((current) => Math.min(current + 1, sources.length - 1))}
      className="h-full w-full rounded-lg bg-card object-cover"
    />
  );

  const frame = (
    <span
      className="relative block shrink-0 overflow-hidden rounded-lg bg-card"
      style={{ width: size, height: size }}
    >
      {image}
      {showingVideoStill ? <PlayMark /> : null}
    </span>
  );

  if (!watchable) {
    return frame;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="relative shrink-0"
      aria-label={`Watch form: ${name}. ${FORM_CAPTION}`}
      title={FORM_CAPTION}
    >
      {frame}
    </a>
  );
}
