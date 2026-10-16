"use client";

import { useState, type RefObject } from "react";
import { playCoachSrc, speakFallback, unlockCoachAudio } from "@/lib/coach/spoken-audio";

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
    const audio = audioRef.current;
    if (audio) unlockCoachAudio(audio);
    setBusy(true);
    try {
      const response = await fetch("/api/coach/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "audio/mpeg, application/json" },
        body: JSON.stringify({ text }),
      });
      const type = response.headers.get("content-type") ?? "";
      const playing = audioRef.current;
      if (!response.ok || !type.includes("audio") || !playing) throw new Error("tts");
      const blob = await response.blob();
      if (blob.size < 32) throw new Error("tts");
      const url = URL.createObjectURL(blob);
      playing.onended = () => {
        URL.revokeObjectURL(url);
        setBusy(false);
      };
      await playCoachSrc(playing, url);
    } catch {
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
