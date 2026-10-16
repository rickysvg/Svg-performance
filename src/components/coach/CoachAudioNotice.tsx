"use client";

import { useEffect, useState } from "react";
import { subscribeCoachAudioIssue } from "@/lib/coach/spoken-audio";

/** Small on-screen note when a coach clip cannot play. Silent failure hides the bug on iPhone. */
export function CoachAudioNotice() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => subscribeCoachAudioIssue(setMessage), []);
  if (!message) return null;
  return (
    <p
      role="status"
      data-coach-audio-status
      className="pointer-events-none fixed left-1/2 top-[max(0.5rem,env(safe-area-inset-top))] z-[70] -translate-x-1/2 rounded-full bg-black px-3 py-1 text-xs font-semibold text-white shadow"
    >
      {message}
    </p>
  );
}
