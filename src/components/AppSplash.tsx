"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import {
  SPLASH_STORAGE_KEY,
  shouldSkipSplash,
  splashTimings,
} from "@/lib/splash";

export function AppSplash() {
  const [phase, setPhase] = useState<"play" | "exit" | "gone">("play");

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
    const leave = window.setTimeout(() => setPhase("exit"), holdMs);
    const hide = window.setTimeout(() => {
      try {
        sessionStorage.setItem(SPLASH_STORAGE_KEY, "1");
      } catch {
        /* ignore */
      }
      document.documentElement.dataset.splash = "done";
      setPhase("gone");
    }, holdMs + exitMs);
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(hide);
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
      <div className="app-splash-stage">
        <span className="app-splash-glow" aria-hidden />
        <span className="app-splash-ring" aria-hidden />
        <div className="app-splash-logo">
          <Logo
            variant="badge"
            size="lg"
            priority
            className="h-auto w-[min(72vw,17rem)]"
          />
        </div>
      </div>
    </div>
  );
}
