"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  SPLASH_MP4_SRC,
  SPLASH_MP4_TYPE,
  SPLASH_PLAY_GRACE_MS,
  SPLASH_STILL_SRC,
  SPLASH_STORAGE_KEY,
  SPLASH_WEBM_SRC,
  SPLASH_WEBM_TYPE,
  applySplashVideoSources,
  canDismissSplash,
  shouldMountSplashVideo,
  shouldShowSplashOverlay,
  splashTimings,
  startSplashPlayback,
} from "@/lib/splash";

function storedSplashFlag() {
  try {
    return sessionStorage.getItem(SPLASH_STORAGE_KEY);
  } catch {
    return null;
  }
}

function initialPhase(pathname: string): "play" | "gone" {
  if (typeof window === "undefined") return "play";
  return shouldShowSplashOverlay({ stored: storedSplashFlag(), pathname }) ? "play" : "gone";
}

export function AppSplash() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<"play" | "exit" | "gone">(() => initialPhase(pathname));
  const [mountVideo, setMountVideo] = useState(false);
  const [useStill, setUseStill] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoFinished = useRef(false);
  const videoPlaying = useRef(false);
  const appReady = useRef(false);
  const userSkipped = useRef(false);
  const exiting = useRef(false);
  const reducedRef = useRef(false);
  const exitMsRef = useRef(280);

  useEffect(() => {
    const stored = storedSplashFlag();
    if (!shouldShowSplashOverlay({ stored, pathname })) {
      document.documentElement.dataset.splash = "done";
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    reducedRef.current = reduced;
    const { holdMs, exitMs } = splashTimings(reduced);
    exitMsRef.current = exitMs;

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

    const markReady = () => {
      appReady.current = true;
      beginExit();
    };

    if (document.readyState === "complete") {
      markReady();
    } else {
      window.addEventListener("load", markReady);
    }

    const boot = window.setTimeout(() => {
      setMountVideo(shouldMountSplashVideo({ stored, pathname, reducedMotion: reduced }));
    }, 0);

    const hold = reduced
      ? window.setTimeout(() => {
          videoFinished.current = true;
          markReady();
        }, holdMs)
      : window.setTimeout(() => {
          videoFinished.current = true;
          beginExit();
        }, holdMs + 400);

    const onSkip = () => {
      userSkipped.current = true;
      beginExit();
    };
    const onVideoDone = () => {
      videoFinished.current = true;
      beginExit();
    };

    window.addEventListener("svg-splash-skip", onSkip);
    window.addEventListener("svg-splash-video-done", onVideoDone);

    return () => {
      window.clearTimeout(boot);
      window.clearTimeout(hold);
      window.removeEventListener("load", markReady);
      window.removeEventListener("svg-splash-skip", onSkip);
      window.removeEventListener("svg-splash-video-done", onVideoDone);
    };
  }, [pathname]);

  useEffect(() => {
    if (!mountVideo || useStill) return;
    const video = videoRef.current;
    const markVideoDone = () => {
      videoFinished.current = true;
      window.dispatchEvent(new Event("svg-splash-video-done"));
    };
    const markPlaying = () => {
      videoPlaying.current = true;
    };
    const fallbackToStill = () => {
      if (videoPlaying.current) return;
      setUseStill(true);
    };
    video?.addEventListener("ended", markVideoDone);
    video?.addEventListener("error", markVideoDone);
    video?.addEventListener("playing", markPlaying);
    if (video) {
      applySplashVideoSources(video);
      startSplashPlayback(video)
        .then((result) => {
          if (result === "playing") videoPlaying.current = true;
          if (result === "stalled") fallbackToStill();
        })
        .catch(() => fallbackToStill());
    }
    const grace = window.setTimeout(fallbackToStill, SPLASH_PLAY_GRACE_MS);
    return () => {
      window.clearTimeout(grace);
      video?.removeEventListener("ended", markVideoDone);
      video?.removeEventListener("error", markVideoDone);
      video?.removeEventListener("playing", markPlaying);
    };
  }, [mountVideo, useStill]);

  function skipSplash() {
    userSkipped.current = true;
    window.dispatchEvent(new Event("svg-splash-skip"));
  }

  if (phase === "gone") return null;

  return (
    <div
      className={`app-splash is-visible ${phase === "exit" ? "is-exiting" : ""} ${
        useStill ? "is-still-fallback" : ""
      }`}
      role="status"
      aria-live="polite"
      aria-label="SVG Performance loading"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={SPLASH_STILL_SRC} alt="" className="app-splash-still" />
      {mountVideo && !useStill ? (
        <video
          ref={videoRef}
          className="app-splash-video"
          poster={SPLASH_STILL_SRC}
          muted
          playsInline
          autoPlay
          preload="auto"
          disablePictureInPicture
          controls={false}
        >
          <source src={SPLASH_WEBM_SRC} type={SPLASH_WEBM_TYPE} />
          <source src={SPLASH_MP4_SRC} type={SPLASH_MP4_TYPE} />
        </video>
      ) : null}
      <button type="button" className="app-splash-skip" onClick={skipSplash}>
        Skip
      </button>
    </div>
  );
}
