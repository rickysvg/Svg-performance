"use client";

import { useEffect, useRef, useState } from "react";
import {
  SPLASH_STILL_SRC,
  SPLASH_STORAGE_KEY,
  SPLASH_VIDEO_SRC,
  canDismissSplash,
  playSplashWithSound,
  shouldSkipSplash,
  splashTimings,
  waitForSplashCanPlay,
} from "@/lib/splash";

export function AppSplash() {
  const [phase, setPhase] = useState<"play" | "exit" | "gone">("play");
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoFinished = useRef(false);
  const appReady = useRef(false);
  const exiting = useRef(false);

  useEffect(() => {
    try {
      if (shouldSkipSplash(sessionStorage.getItem(SPLASH_STORAGE_KEY))) {
        document.documentElement.dataset.splash = "done";
        setPhase("gone");
        return;
      }
    } catch {
      /* private mode */
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const { holdMs, exitMs } = splashTimings(reduced);

    const markSeenAndHide = () => {
      try {
        sessionStorage.setItem(SPLASH_STORAGE_KEY, "1");
      } catch {
        /* ignore */
      }
      document.documentElement.dataset.splash = "done";
      setPhase("gone");
    };

    const beginExit = () => {
      if (exiting.current) return;
      if (
        !canDismissSplash({
          videoFinished: videoFinished.current,
          appReady: appReady.current,
          reducedMotion: reduced,
        })
      ) {
        return;
      }
      exiting.current = true;
      setPhase("exit");
      window.setTimeout(markSeenAndHide, exitMs);
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

    if (reduced) {
      videoFinished.current = true;
      const hold = window.setTimeout(markReady, holdMs);
      return () => {
        window.clearTimeout(hold);
        window.removeEventListener("load", markReady);
      };
    }

    const video = videoRef.current;
    const markVideoDone = () => {
      videoFinished.current = true;
      beginExit();
    };

    video?.addEventListener("ended", markVideoDone);
    video?.addEventListener("error", markVideoDone);
    if (video) {
      waitForSplashCanPlay(video)
        .then(() => playSplashWithSound(video))
        .catch(markVideoDone);
    }

    const safety = window.setTimeout(markVideoDone, holdMs + 1500);

    return () => {
      video?.removeEventListener("ended", markVideoDone);
      video?.removeEventListener("error", markVideoDone);
      window.clearTimeout(safety);
      window.removeEventListener("load", markReady);
    };
  }, []);

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
      <video
        ref={videoRef}
        className="app-splash-video"
        src={SPLASH_VIDEO_SRC}
        poster={SPLASH_STILL_SRC}
        playsInline
        preload="auto"
        disablePictureInPicture
        controls={false}
      />
    </div>
  );
}
