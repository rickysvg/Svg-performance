"use client";

import { useEffect, useRef, useState } from "react";
import {
  pauseCoachPlayback,
  playCoachBytes,
  stopCoachPlayback,
  reportCoachAudioIssue,
  resumeCoachPlayback,
  speakFallback,
  unlockCoachAudio,
  COACH_AUDIO_FAILED,
} from "@/lib/coach/spoken-audio";

type Phase = "idle" | "loading" | "playing" | "paused";

const SPEECH_MISSING =
  "This browser can't read the summary aloud. The plan above is still yours to use.";

export function SummaryReader({ script, coachId }: { script: string; coachId: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [notice, setNotice] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const modeRef = useRef<"audio" | "speech" | null>(null);
  const tokenRef = useRef(0);

  useEffect(() => {
    return () => {
      tokenRef.current += 1;
      stopCoachPlayback();
      window.speechSynthesis?.cancel();
    };
  }, []);

  function pauseAll() {
    if (modeRef.current === "speech") window.speechSynthesis?.pause();
    else pauseCoachPlayback();
    setPhase("paused");
  }

  function resumeAll() {
    if (modeRef.current === "speech") {
      window.speechSynthesis?.resume();
      setPhase("playing");
      return;
    }
    void resumeCoachPlayback()
      .then(() => setPhase("playing"))
      .catch(() => {
        reportCoachAudioIssue(COACH_AUDIO_FAILED);
        setNotice(SPEECH_MISSING);
        setPhase("idle");
      });
  }

  function fallbackSpeech(token: number) {
    window.speechSynthesis?.cancel();
    const started = speakFallback(script, coachId);
    if (!started) {
      setNotice(SPEECH_MISSING);
      setPhase("idle");
      return;
    }
    modeRef.current = "speech";
    setPhase("playing");
    const chunks = script.split(/(?<=[.!?])\s+/).filter(Boolean);
    const guess = Math.max(4000, chunks.length * 3500);
    window.setTimeout(() => {
      if (tokenRef.current === token && modeRef.current === "speech") setPhase("idle");
    }, guess);
  }

  async function fetchAudio(token: number) {
    try {
      const response = await fetch("/api/coach/today-summary", {
        cache: "no-store",
        headers: { Accept: "audio/mpeg, application/json" },
      });
      if (tokenRef.current !== token) return;
      const type = response.headers.get("content-type") ?? "";
      if (!response.ok || !type.includes("audio")) {
        throw new Error("tts");
      }
      const bytes = await response.arrayBuffer();
      if (tokenRef.current !== token || bytes.byteLength < 32) throw new Error("tts");
      window.speechSynthesis?.cancel();
      modeRef.current = "audio";
      await playCoachBytes(bytes, {
        onEnded: () => {
          if (tokenRef.current === token) setPhase("idle");
        },
      });
      if (tokenRef.current === token) setPhase("playing");
    } catch {
      if (tokenRef.current !== token) return;
      reportCoachAudioIssue(COACH_AUDIO_FAILED);
      fallbackSpeech(token);
    }
  }

  function onRead() {
    if (phase === "loading") return;
    if (phase === "playing") {
      pauseAll();
      return;
    }
    if (phase === "paused") {
      resumeAll();
      return;
    }
    setNotice("");
    unlockCoachAudio(audioRef.current);
    const token = tokenRef.current + 1;
    tokenRef.current = token;
    modeRef.current = null;
    setPhase("loading");
    void fetchAudio(token);
  }

  const label =
    phase === "playing" ? "Pause" : phase === "paused" ? "Resume" : "Read it to me";

  return (
    <div className="space-y-2">
      <audio ref={audioRef} data-summary-audio playsInline preload="auto" className="hidden" />
      <button
        type="button"
        data-summary-read
        data-summary-state={phase}
        aria-pressed={phase === "playing"}
        onClick={onRead}
        className="touch-target flex w-full items-center justify-center gap-2 rounded-full bg-accent px-4 text-base font-semibold text-black"
      >
        <span aria-hidden className="text-lg">
          {phase === "playing" ? "❚❚" : "▶"}
        </span>
        {label}
      </button>
      {notice ? (
        <p role="alert" data-summary-speech-note className="text-sm text-muted">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
