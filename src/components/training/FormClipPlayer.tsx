"use client";

import { type PointerEvent, type ReactNode, useState } from "react";
import { createPortal } from "react-dom";
import { nocookieEmbedSrc, youtubeThumbSrcs, youtubeVideoId } from "@/lib/form-videos";

function FormSheet({ name, url, onClose }: { name: string; url: string; onClose: () => void }) {
  const [failed, setFailed] = useState(false);
  const src = nocookieEmbedSrc(url);
  const still = youtubeThumbSrcs(url)[0] ?? "";
  const clipMissing = !src || !youtubeVideoId(url);

  function shut(event: PointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    onClose();
  }

  const sheet = (
    <div
      className="fixed inset-0 z-[100] flex items-end bg-black/70"
      data-form-player
      role="presentation"
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget) return;
        shut(event);
      }}
    >
      <div
        role="dialog"
        aria-label={`Watch form: ${name}`}
        className="max-h-[85dvh] w-full rounded-t-3xl bg-card px-4 pb-6 pt-3"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-sm font-semibold">{name}</p>
          <button
            type="button"
            data-testid="chrome-form-clip-close"
            className="touch-target text-sm font-semibold text-accent"
            onPointerDown={shut}
            onClick={(event) => {
              event.preventDefault();
              onClose();
            }}
          >
            Close
          </button>
        </div>
        {failed || clipMissing ? (
          <div className="space-y-3">
            {still ? (
              // Still from the clip. Not an outbound YouTube link.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={still} alt="" className="aspect-video w-full rounded-xl bg-black object-cover" />
            ) : null}
            <p className="text-sm text-muted">
              This clip did not load. Use the still and the written cues on the exercise.
            </p>
          </div>
        ) : (
          <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
            {still ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={still} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : null}
            <iframe
              key={url}
              title={`Form: ${name}`}
              src={src}
              className="relative h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              onError={() => setFailed(true)}
            />
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return sheet;
  return createPortal(sheet, document.body);
}

export function FormClipPlayer({
  name,
  url,
  children,
  className,
}: {
  name: string;
  url: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-testid="chrome-watch-form"
        className={className ?? "relative shrink-0 text-left"}
        aria-label={`Watch form: ${name}`}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      {open ? <FormSheet key={`${name}:${url}`} name={name} url={url} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
