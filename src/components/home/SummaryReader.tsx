"use client";

import { useEffect, useRef, useState } from "react";
import { playCoachSrc, speakFallback, unlockCoachAudio } from "@/lib/coach/spoken-audio";

type Phase = "idle" | "loading" | "playing" | "paused";

const SPEECH_MISSING =
  "This browser can't read the summary aloud. The plan above is still yours to use.";

export function SummaryReader({ script, coachId }: { script: string; coachId: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [notice, setNotice] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const modeRef = useRef<"audio" | "speech" | null>(null);
  const tokenRef = useRef(0);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      tokenRef.current += 1;
      audio?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      window.speechSynthesis?.cancel();
    };
  }, []);

  function pauseAll() {
    if (modeRef.current === "speech") window.speechSynthesis?.pause();
    else audioRef.current?.pause();
    setPhase("paused");
  }

  function resumeAll() {
    if (modeRef.current === "speech") {
      window.speechSynthesis?.resume();
      setPhase("playing");
      return;
    }
    const audio = audioRef.current;
    if (!audio) {
      setPhase("idle");
      return;
    }
    void audio.play().then(() => setPhase("playing")).catch(() => {
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
      const blob = await response.blob();
      if (tokenRef.current !== token || blob.size < 32) throw new Error("tts");
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      window.speechSynthesis?.cancel();
      const audio = audioRef.current;
      if (!audio) throw new Error("tts");
      modeRef.current = "audio";
      audio.onended = () => {
        if (tokenRef.current === token) setPhase("idle");
      };
      await playCoachSrc(audio, url);
      if (tokenRef.current === token) setPhase("playing");
    } catch {
      if (tokenRef.current !== token) return;
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
    const audio = audioRef.current;
    if (audio) unlockCoachAudio(audio);
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
