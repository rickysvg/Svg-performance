"use client";

import { useState, type RefObject } from "react";
import {
  playCoachBytes,
  reportCoachAudioIssue,
  speakFallback,
  unlockCoachAudio,
  COACH_AUDIO_FAILED,
} from "@/lib/coach/spoken-audio";

export function CoachSpeakButton({
  text,
  coachId,
  audioRef,
}: {
  text: string;
  coachId: string;
  audioRef: RefObject<HTMLAudioElement | null>;
}) {
  const [busy, setBusy] = useState(false);

  async function onPlay() {
    if (!text.trim() || busy) return;
    unlockCoachAudio(audioRef.current);
    setBusy(true);
    try {
      const response = await fetch("/api/coach/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "audio/mpeg, application/json" },
        body: JSON.stringify({ text }),
      });
      const type = response.headers.get("content-type") ?? "";
      if (!response.ok || !type.includes("audio")) throw new Error("tts");
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength < 32) throw new Error("tts");
      await playCoachBytes(bytes, {
        onEnded: () => setBusy(false),
      });
    } catch {
      reportCoachAudioIssue(COACH_AUDIO_FAILED);
      window.speechSynthesis?.cancel();
      speakFallback(text, coachId);
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      data-coach-speak
      aria-label="Play this reply"
      onClick={() => void onPlay()}
      className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-line text-sm"
    >
      <span aria-hidden>{busy ? "…" : "▶"}</span>
    </button>
  );
}
