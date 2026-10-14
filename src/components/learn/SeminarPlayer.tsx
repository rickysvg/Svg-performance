"use client";

import Image from "next/image";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  embedSrcFor,
  type SeminarPlaybackClip,
  type SeminarPlaybackModel,
} from "@/lib/seminar-playback";

type YTPlayer = {
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  loadVideoById: (opts: { videoId: string; startSeconds?: number; endSeconds?: number }) => void;
  destroy: () => void;
};

type YTPlayerEvent = { target: YTPlayer; data: number };

type Intent =
  | { kind: "clip"; clip: SeminarPlaybackClip }
  | { kind: "time"; seconds: number }
  | { kind: "open" };

type PlayerCommands = {
  playClip: (clip: SeminarPlaybackClip) => void;
  playChapter: (startSeconds: number) => void;
};

type PlaybackContextValue = {
  model: SeminarPlaybackModel;
  activeClipId: string | null;
  activeChapterStart: number | null;
  playClip: (clip: SeminarPlaybackClip) => void;
  playChapter: (startSeconds: number) => void;
  watchUrl: string;
  bindCommands: (commands: PlayerCommands | null) => void;
};

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

export function useSeminarPlayback() {
  const value = useContext(PlaybackContext);
  if (!value) {
    throw new Error("Seminar playback is only available on an unlocked seminar.");
  }
  return value;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement,
        options: {
          host?: string;
          videoId?: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: YTPlayerEvent) => void;
            onStateChange?: (event: YTPlayerEvent) => void;
            onError?: (event: YTPlayerEvent) => void;
          };
        },
      ) => YTPlayer;
      PlayerState?: { ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

function loadYouTubeApi() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new Error("YouTube IFrame API failed to load"));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

function clipFromModel(model: SeminarPlaybackModel, clipId: string | null) {
  if (!clipId) return null;
  return model.clips.find((clip) => clip.id === clipId) ?? null;
}

/** YouTube error 153/150 when the embed request omits origin or a referrer. */
function embedPlayerSrc(videoId: string, start: number, end: number | null) {
  const origin = window.location.origin;
  const params = new URLSearchParams({
    enablejsapi: "1",
    rel: "0",
    playsinline: "1",
    modestbranding: "1",
    autoplay: "1",
    origin,
    widget_referrer: origin,
  });
  if (start > 0) params.set("start", String(start));
  if (end != null) params.set("end", String(end));
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

function withEmbedOrigin(src: string) {
  const url = new URL(src);
  if (typeof window !== "undefined") {
    url.searchParams.set("origin", window.location.origin);
    url.searchParams.set("widget_referrer", window.location.origin);
  }
  return url.toString();
}

function intentWindow(intent: Intent) {
  if (intent.kind === "clip") {
    return { start: intent.clip.startSeconds, end: intent.clip.endSeconds };
  }
  if (intent.kind === "time") return { start: intent.seconds, end: null };
  return { start: 0, end: null };
}

/** True when the iframe URL already starts and stops on this window. */
function iframeHasWindow(iframe: HTMLIFrameElement, start: number, end: number | null) {
  try {
    const url = new URL(iframe.src);
    const startParam = Number(url.searchParams.get("start") ?? "0");
    const endParam = url.searchParams.get("end");
    const parsedEnd = endParam == null || endParam === "" ? null : Number(endParam);
    return startParam === start && parsedEnd === end;
  } catch {
    return false;
  }
}

export function SeminarPlayback({
  model,
  initialClipId,
  initialSeconds,
  children,
}: {
  model: SeminarPlaybackModel;
  initialClipId: string | null;
  initialSeconds: number | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const commandsRef = useRef<PlayerCommands | null>(null);
  const [activeClipId, setActiveClipId] = useState(initialClipId);
  const [activeChapterStart, setActiveChapterStart] = useState<number | null>(
    initialClipId ? null : initialSeconds,
  );
  const activeClip = clipFromModel(model, activeClipId);

  const syncUrl = useCallback(
    (next: { clip?: string | null; t?: string | null }) => {
      const params = new URLSearchParams(window.location.search);
      if (next.clip) {
        params.set("clip", next.clip);
        params.delete("t");
      } else if (next.clip === null) {
        params.delete("clip");
      }
      if (next.t) {
        params.set("t", next.t);
        params.delete("clip");
      } else if (next.t === null) {
        params.delete("t");
      }
      const search = params.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const playClip = useCallback(
    (clip: SeminarPlaybackClip) => {
      setActiveClipId(clip.id);
      setActiveChapterStart(null);
      syncUrl({ clip: clip.id });
      commandsRef.current?.playClip(clip);
    },
    [syncUrl],
  );

  const playChapter = useCallback(
    (startSeconds: number) => {
      setActiveClipId(null);
      setActiveChapterStart(startSeconds);
      syncUrl({ t: String(startSeconds) });
      commandsRef.current?.playChapter(startSeconds);
    },
    [syncUrl],
  );

  const bindCommands = useCallback((commands: PlayerCommands | null) => {
    commandsRef.current = commands;
  }, []);

  return (
    <PlaybackContext.Provider
      value={{
        model,
        activeClipId,
        activeChapterStart,
        playClip,
        playChapter,
        watchUrl: activeClip?.watchUrl ?? model.url,
        bindCommands,
      }}
    >
      {children}
    </PlaybackContext.Provider>
  );
}

function PlayDisc() {
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-black shadow">
        <svg viewBox="0 0 12 12" className="ml-1 h-6 w-6" aria-hidden>
          <path d="M3 2.2v7.6L10 6z" fill="currentColor" />
        </svg>
      </span>
    </span>
  );
}

export function SeminarPlayer() {
  const { model, activeClipId, activeChapterStart, bindCommands } = useSeminarPlayback();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const endBoundRef = useRef<number | null>(null);
  const intentRef = useRef<Intent>({ kind: "open" });
  const readyRef = useRef(false);
  const playedRef = useRef(false);
  const [mode, setMode] = useState<"facade" | "player" | "iframe" | "link">("facade");
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const [endedClip, setEndedClip] = useState<SeminarPlaybackClip | null>(null);
  const activeClip = clipFromModel(model, activeClipId);

  const queueClip = useCallback((clip: SeminarPlaybackClip) => {
    intentRef.current = { kind: "clip", clip };
    endBoundRef.current = clip.endSeconds;
    playedRef.current = false;
    setEndedClip(null);
    setMode((current) => (current === "link" || current === "iframe" ? current : "player"));
    if (!playerRef.current) {
      const windowed = intentWindow(intentRef.current);
      setFrameSrc(embedPlayerSrc(model.videoId, windowed.start, windowed.end));
    }
    const player = playerRef.current;
    if (player && readyRef.current) {
      const opts: { videoId: string; startSeconds: number; endSeconds?: number } = {
        videoId: model.videoId,
        startSeconds: clip.startSeconds,
      };
      if (clip.endSeconds != null) opts.endSeconds = clip.endSeconds;
      player.loadVideoById(opts);
    }
  }, [model.videoId]);

  const queueChapter = useCallback((startSeconds: number) => {
    intentRef.current = { kind: "time", seconds: startSeconds };
    playedRef.current = false;
    setEndedClip(null);
    setMode((current) => (current === "link" || current === "iframe" ? current : "player"));
    if (!playerRef.current) {
      const windowed = intentWindow(intentRef.current);
      setFrameSrc(embedPlayerSrc(model.videoId, windowed.start, windowed.end));
    }
    const player = playerRef.current;
    if (!player || !readyRef.current) {
      endBoundRef.current = null;
      return;
    }
    if (endBoundRef.current != null) {
      endBoundRef.current = null;
      player.loadVideoById({ videoId: model.videoId, startSeconds });
      return;
    }
    endBoundRef.current = null;
    player.seekTo(startSeconds, true);
    player.playVideo();
  }, [model.videoId]);

  useEffect(() => {
    bindCommands({ playClip: queueClip, playChapter: queueChapter });
    return () => bindCommands(null);
  }, [bindCommands, queueChapter, queueClip]);

  useEffect(() => {
    if (mode !== "player" || !frameSrc) return;
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (!readyRef.current) setMode("iframe");
    }, 8000);

    loadYouTubeApi()
      .then(() => {
        const iframe = iframeRef.current;
        if (cancelled || !iframe || !window.YT?.Player || playerRef.current) return;
        const intent = intentRef.current;
        if (intent.kind === "clip") endBoundRef.current = intent.clip.endSeconds;
        // Bind to the existing nocookie iframe so origin, playsinline, and
        // referrerpolicy stay on the element. Passing host/videoId rebuilds it.
        playerRef.current = new window.YT.Player(iframe, {
          events: {
            onReady: (event) => {
              if (cancelled) return;
              readyRef.current = true;
              window.clearTimeout(timeout);
              const next = intentRef.current;
              const frame = iframeRef.current;
              // The iframe src already carries start/end. Calling loadVideoById
              // again on that first frame reloads the player and YouTube answers
              // with error 150. Later clip changes still use loadVideoById.
              if (next.kind === "clip") {
                const covered =
                  frame != null &&
                  iframeHasWindow(frame, next.clip.startSeconds, next.clip.endSeconds);
                if (!covered) {
                  const opts: { videoId: string; startSeconds: number; endSeconds?: number } = {
                    videoId: model.videoId,
                    startSeconds: next.clip.startSeconds,
                  };
                  if (next.clip.endSeconds != null) opts.endSeconds = next.clip.endSeconds;
                  event.target.loadVideoById(opts);
                  return;
                }
              } else if (next.kind === "time") {
                const covered = frame != null && iframeHasWindow(frame, next.seconds, null);
                if (!covered) event.target.seekTo(next.seconds, true);
              }
              event.target.playVideo();
            },
            onStateChange: (event) => {
              if (event.data === 1) playedRef.current = true;
              const ended = window.YT?.PlayerState?.ENDED ?? 0;
              if (
                event.data === ended &&
                playedRef.current &&
                endBoundRef.current != null &&
                intentRef.current.kind === "clip"
              ) {
                playedRef.current = false;
                setEndedClip(intentRef.current.clip);
              }
            },
            onError: (event) => {
              console.warn(`[learn] YouTube embed error ${event.data} for ${model.videoId}`);
              if (event.data === 100 || event.data === 101 || event.data === 150) {
                setMode("link");
              }
            },
          },
        });
      })
      .catch((error: unknown) => {
        console.warn("[learn] YouTube IFrame API failed", error);
        if (!cancelled) setMode("iframe");
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [frameSrc, mode, model.videoId]);

  useEffect(() => {
    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
      readyRef.current = false;
    };
  }, []);

  function activate() {
    if (intentRef.current.kind === "open") {
      if (activeClip) intentRef.current = { kind: "clip", clip: activeClip };
      else if (activeChapterStart != null) {
        intentRef.current = { kind: "time", seconds: activeChapterStart };
      }
    }
    if (intentRef.current.kind === "clip") {
      endBoundRef.current = intentRef.current.clip.endSeconds;
    }
    const windowed = intentWindow(intentRef.current);
    setFrameSrc((current) => current ?? embedPlayerSrc(model.videoId, windowed.start, windowed.end));
    setEndedClip(null);
    setMode("player");
  }

  function replayClip() {
    if (!endedClip) return;
    queueClip(endedClip);
  }

  function keepWatching() {
    if (!endedClip || !playerRef.current) return;
    const resumeAt = endedClip.endSeconds ?? endedClip.startSeconds;
    endBoundRef.current = null;
    playedRef.current = false;
    intentRef.current = { kind: "time", seconds: resumeAt };
    setEndedClip(null);
    playerRef.current.loadVideoById({ videoId: model.videoId, startSeconds: resumeAt });
  }

  const title = `${model.displayTitle} — YouTube video player`;
  const staticSrc = embedSrcFor(
    model,
    activeClip?.id ?? null,
    activeClip ? null : activeChapterStart,
  );

  if (mode === "link") {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-black px-4 text-center">
        <p className="text-sm text-white">This video can&apos;t be embedded.</p>
        <a
          href={model.url}
          target="_blank"
          rel="noopener noreferrer"
          className="touch-target inline-flex items-center rounded-full bg-accent px-5 text-black"
        >
          Watch on YouTube
        </a>
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full bg-black">
      {mode === "facade" ? (
        <button
          type="button"
          onClick={activate}
          className="absolute inset-0 block h-full w-full"
          aria-label={`Play ${model.displayTitle}`}
        >
          <Image
            src={model.thumbnailUrl}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
            preload
          />
          <PlayDisc />
        </button>
      ) : null}
      {mode === "iframe" ? (
        <iframe
          src={withEmbedOrigin(staticSrc)}
          title={title}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : frameSrc ? (
        <iframe
          ref={iframeRef}
          src={frameSrc}
          title={title}
          className={mode === "player" ? "absolute inset-0 h-full w-full" : "hidden"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : null}
      <noscript>
        <iframe src={staticSrc} title={title} className="h-full w-full" allowFullScreen />
      </noscript>
      {endedClip ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/80 px-4 text-center">
          <p className="text-sm text-white">Clip finished</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={replayClip}
              className="touch-target rounded-full bg-accent px-4 text-black"
            >
              Replay clip
            </button>
            <button
              type="button"
              onClick={keepWatching}
              className="touch-target rounded-full border border-white px-4 text-white"
            >
              Keep watching
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
