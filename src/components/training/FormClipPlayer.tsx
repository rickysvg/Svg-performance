"use client";

import { type PointerEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { nocookieEmbedSrc, youtubeThumbSrcs, youtubeVideoId } from "@/lib/form-videos";

/** How long the still stays up before we treat the embed as blocked or missing. */
const FORM_PLAYER_READY_MS = 8000;

type YTPlayer = { destroy?: () => void };

type YoutubeWindow = Window & {
  YT?: {
    Player?: new (
      element: HTMLElement | string,
      options: {
        videoId?: string;
        playerVars?: Record<string, number | string>;
        events?: {
          onReady?: () => void;
          onError?: () => void;
        };
      },
    ) => YTPlayer;
  };
  onYouTubeIframeAPIReady?: () => void;
};

function youtubeWindow() {
  return window as YoutubeWindow;
}

function loadYouTubeApi() {
  const host = youtubeWindow();
  if (host.YT?.Player) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const done = () => {
      if (youtubeWindow().YT?.Player) resolve();
      else reject(new Error("YouTube player missing"));
    };
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existing) {
      const previous = host.onYouTubeIframeAPIReady;
      host.onYouTubeIframeAPIReady = () => {
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
      if (youtubeWindow().YT?.Player) {
        window.clearInterval(timer);
        resolve();
      }
    }, 100);
    window.setTimeout(() => {
      window.clearInterval(timer);
      if (youtubeWindow().YT?.Player) resolve();
      else reject(new Error("YouTube IFrame API timed out"));
    }, FORM_PLAYER_READY_MS);
  });
}

function FormSheet({ name, url, onClose }: { name: string; url: string; onClose: () => void }) {
  const reactId = useId();
  const hostId = `form-player-${reactId.replace(/:/g, "")}`;
  const [phase, setPhase] = useState<"loading" | "ready" | "failed">("loading");
  const playerRef = useRef<YTPlayer | null>(null);
  const src = nocookieEmbedSrc(url);
  const clipMissing = !src || !youtubeVideoId(url);
  const still = youtubeThumbSrcs(url)[0] ?? "";
  const failed = phase === "failed" || clipMissing;

  useEffect(() => {
    if (clipMissing) return;
    let cancelled = false;
    let ready = false;
    const timeout = window.setTimeout(() => {
      if (!cancelled && !ready) setPhase("failed");
    }, FORM_PLAYER_READY_MS);
    const videoId = youtubeVideoId(url);
    const start = new URL(src!).searchParams.get("start");
    const end = new URL(src!).searchParams.get("end");
    loadYouTubeApi()
      .then(() => {
        const Player = youtubeWindow().YT?.Player;
        if (cancelled || !Player) return;
        const host = document.getElementById(hostId);
        if (!host) return;
        playerRef.current = new Player(host, {
          videoId: videoId ?? undefined,
          playerVars: {
            start: start ? Number(start) : 0,
            ...(end ? { end: Number(end) } : {}),
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            enablejsapi: 1,
          },
          events: {
            onReady: () => {
              ready = true;
              window.clearTimeout(timeout);
              if (!cancelled) setPhase("ready");
            },
            onError: () => {
              ready = true;
              window.clearTimeout(timeout);
              if (!cancelled) setPhase("failed");
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) setPhase("failed");
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      const player = playerRef.current;
      playerRef.current = null;
      window.setTimeout(() => {
        try {
          player?.destroy?.();
        } catch {
          // The dialog is already gone. A late destroy must not block close.
        }
      }, 0);
    };
  }, [clipMissing, hostId, src, url]);

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
        {failed ? (
          <div className="space-y-3" data-form-still>
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
            <div id={hostId} className="h-full w-full" />
            {phase !== "ready" && still ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={still}
                alt=""
                data-form-still
                className="absolute inset-0 z-10 h-full w-full object-cover"
              />
            ) : null}
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
