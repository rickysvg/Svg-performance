"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  SPLASH_STILL_SRC,
  SPLASH_STORAGE_KEY,
  SPLASH_VIDEO_SRC,
  canDismissSplash,
  shouldMountSplashVideo,
  shouldShowSplashOverlay,
  splashTimings,
  startSplashPlayback,
} from "@/lib/splash";

export function AppSplash() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<"play" | "exit" | "gone">("play");
  const [mountVideo, setMountVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoFinished = useRef(false);
  const appReady = useRef(false);
  const userSkipped = useRef(false);
  const exiting = useRef(false);
  const reducedRef = useRef(false);
  const exitMsRef = useRef(280);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(SPLASH_STORAGE_KEY);
    } catch {
      /* private mode */
    }

    if (!shouldShowSplashOverlay({ stored, pathname })) {
      document.documentElement.dataset.splash = "done";
      setPhase("gone");
      setMountVideo(false);
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    reducedRef.current = reduced;
    const { holdMs, exitMs } = splashTimings(reduced);
    exitMsRef.current = exitMs;
    setMountVideo(shouldMountSplashVideo({ stored, pathname, reducedMotion: reduced }));

    const markSeenAndHide = () => {
      try {
        sessionStorage.setItem(SPLASH_STORAGE_KEY, "1");
      } catch {
        /* ignore */
      }
      document.documentElement.dataset.splash = "done";
      setMountVideo(false);
      setPhase("gone");
    };

    const beginExit = () => {
      if (exiting.current) return;
      if (
        !canDismissSplash({
          videoFinished: videoFinished.current,
          appReady: appReady.current,
          reducedMotion: reducedRef.current,
          userSkipped: userSkipped.current,
        })
      ) {
        return;
      }
      exiting.current = true;
      setPhase("exit");
      window.setTimeout(markSeenAndHide, exitMsRef.current);
    };

    const tryExit = () => beginExit();

    const markReady = () => {
      appReady.current = true;
      tryExit();
    };

    if (document.readyState === "complete") {
      markReady();
    } else {
      window.addEventListener("load", markReady);
    }

    const hold = reduced
      ? window.setTimeout(() => {
          videoFinished.current = true;
          markReady();
        }, holdMs)
      : window.setTimeout(() => {
          videoFinished.current = true;
          tryExit();
        }, holdMs + 400);

    const onSkip = () => {
      userSkipped.current = true;
      tryExit();
    };
    const onVideoDone = () => {
      videoFinished.current = true;
      tryExit();
    };

    window.addEventListener("svg-splash-skip", onSkip);
    window.addEventListener("svg-splash-video-done", onVideoDone);

    return () => {
      window.clearTimeout(hold);
      window.removeEventListener("load", markReady);
      window.removeEventListener("svg-splash-skip", onSkip);
      window.removeEventListener("svg-splash-video-done", onVideoDone);
    };
  }, [pathname]);

  useEffect(() => {
    if (!mountVideo) return;
    const video = videoRef.current;
    const markVideoDone = () => {
      videoFinished.current = true;
      window.dispatchEvent(new Event("svg-splash-video-done"));
    };
    video?.addEventListener("ended", markVideoDone);
    video?.addEventListener("error", markVideoDone);
    if (video) {
      startSplashPlayback(video).catch(() => undefined);
    }
    return () => {
      video?.removeEventListener("ended", markVideoDone);
      video?.removeEventListener("error", markVideoDone);
    };
  }, [mountVideo]);

  function skipSplash() {
    userSkipped.current = true;
    window.dispatchEvent(new Event("svg-splash-skip"));
  }

  if (phase === "gone") return null;

  return (
    <div
      className={`app-splash is-visible ${phase === "exit" ? "is-exiting" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="SVG Performance loading"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={SPLASH_STILL_SRC} alt="" className="app-splash-still" />
      {mountVideo ? (
        <video
          ref={videoRef}
          className="app-splash-video"
          src={SPLASH_VIDEO_SRC}
          muted
          playsInline
          autoPlay
          preload="auto"
          disablePictureInPicture
          controls={false}
        />
      ) : null}
      <button type="button" className="app-splash-skip" onClick={skipSplash}>
        Skip
      </button>
    </div>
  );
}
