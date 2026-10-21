"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { formClipWindow, nocookieEmbedSrc, youtubeThumbSrcs, youtubeVideoId } from "@/lib/form-videos";

type YTPlayer = {
  destroy?: () => void;
};

function loadYouTubeApi() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.YT?.Player) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const done = () => {
      if (window.YT?.Player) resolve();
      else reject(new Error("YouTube player missing"));
    };
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existing) {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        done();
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => reject(new Error("YouTube IFrame API failed"));
      document.head.appendChild(script);
      return;
    }
    const timer = window.setInterval(() => {
      if (window.YT?.Player) {
        window.clearInterval(timer);
        resolve();
      }
    }, 100);
    window.setTimeout(() => {
      window.clearInterval(timer);
      if (window.YT?.Player) resolve();
      else reject(new Error("YouTube IFrame API timed out"));
    }, 7000);
  });
}

function FormSheet({ name, url, onClose }: { name: string; url: string; onClose: () => void }) {
  const reactId = useId();
  const hostId = `form-player-${reactId.replace(/:/g, "")}`;
  const [failed, setFailed] = useState(false);
  const playerRef = useRef<YTPlayer | null>(null);
  const src = nocookieEmbedSrc(url);
  const clip = formClipWindow(url);
  const still = youtubeThumbSrcs(url)[0] ?? "";

  useEffect(() => {
    if (!src || !youtubeVideoId(url)) {
      setFailed(true);
      return;
    }
    let cancelled = false;
    let ready = false;
    const timeout = window.setTimeout(() => {
      if (!ready) setFailed(true);
    }, 8000);
    loadYouTubeApi()
      .then(() => {
        if (cancelled || !window.YT?.Player) return;
        const host = document.getElementById(hostId);
        if (!host) return;
        playerRef.current = new window.YT.Player(host, {
          videoId: youtubeVideoId(url) ?? undefined,
          playerVars: {
            start: clip.start ?? 0,
            ...(clip.end != null ? { end: clip.end } : {}),
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            enablejsapi: 1,
          },
          events: {
            onReady: () => {
              ready = true;
              window.clearTimeout(timeout);
            },
            onError: () => {
              ready = true;
              window.clearTimeout(timeout);
              setFailed(true);
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [clip.end, clip.start, hostId, src, url]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sheet = (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70" data-form-player role="presentation">
      <div
        role="dialog"
        aria-label={`Watch form: ${name}`}
        className="max-h-[85dvh] w-full rounded-t-3xl bg-card px-4 pb-6 pt-3"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-sm font-semibold">{name}</p>
          <button type="button" className="touch-target text-sm font-semibold text-accent" onClick={onClose}>
            Close
          </button>
        </div>
        {failed || !src ? (
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
          <div className="aspect-video overflow-hidden rounded-xl bg-black">
            <iframe
              id={hostId}
              title={`Form: ${name}`}
              src={src}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
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
        className={className ?? "relative shrink-0 text-left"}
        aria-label={`Watch form: ${name}`}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      {open ? <FormSheet name={name} url={url} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
