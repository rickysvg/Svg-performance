"use client";

import { useEffect } from "react";
import { CoachAudioNotice } from "@/components/coach/CoachAudioNotice";
import { unlockCoachOutput } from "@/lib/coach/spoken-audio";

/**
 * Only an explicit hear control may open the coach audio path.
 * Start workout, next session, and the motivation switch used to unlock here,
 * and that silent clip paused Apple Music before any cue played.
 */
const HEAR_SELECTOR = ["[data-coach-speak]", "[data-summary-read]"].join(", ");

export function PrimeCoachAudio() {
  useEffect(() => {
    function onPointerDown(event: Event) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest(HEAR_SELECTOR)) return;
      unlockCoachOutput();
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);
  return <CoachAudioNotice />;
}
