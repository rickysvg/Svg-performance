"use client";

import { useEffect } from "react";
import { CoachAudioNotice } from "@/components/coach/CoachAudioNotice";
import { unlockCoachOutput } from "@/lib/coach/spoken-audio";

const PRIME_SELECTOR = [
  "[data-prime-coach-audio]",
  "[data-start-bar]",
  "[data-start-today]",
  "[data-next-session]",
  "[data-coach-motivation]",
  "[data-coach-speak]",
  "[data-summary-read]",
].join(", ");

/**
 * Start workout, Coach on, the chat speaker, and Read it to me all unlock
 * the same AudioContext in the tap, before any await.
 */
export function PrimeCoachAudio() {
  useEffect(() => {
    function onPointerDown(event: Event) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest(PRIME_SELECTOR)) return;
      unlockCoachOutput();
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);
  return <CoachAudioNotice />;
}
