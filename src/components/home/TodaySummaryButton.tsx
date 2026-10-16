"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "loading" | "playing" | "paused";

const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

const SPEECH_PITCH: Record<string, { pitch: number; rate: number }> = {
  ricky: { pitch: 0.75, rate: 0.95 },
  mateo: { pitch: 0.92, rate: 0.92 },
  cole: { pitch: 1.02, rate: 1 },
  skye: { pitch: 1.16, rate: 1.04 },
  maya: { pitch: 1.08, rate: 0.98 },
};

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden className="block">
      <path d="M5 3.2v9.6L13 8 5 3.2Z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden className="block">
      <path d="M4.5 3h2.2v10H4.5V3Zm4.8 0H11.5v10H9.3V3Z" fill="currentColor" />
    </svg>
  );
}

export function TodaySummaryButton({
  name,
  circle,
  coachId,
}: {
  name: string;
  circle: string;
  coachId: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const modeRef = useRef<"audio" | "speech" | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  function audioElement() {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = "auto";
      audio.onplaying = () => {
        if (modeRef.current === "audio") setPhase("playing");
      };
      audio.onpause = () => {
        if (modeRef.current === "audio" && !audio.ended) setPhase("paused");
      };
      audio.onended = () => {
        if (modeRef.current === "audio") setPhase("idle");
      };
      audioRef.current = audio;
    }
    return audioRef.current;
  }

  function speakScript(script: string) {
    const synth = window.speechSynthesis;
    if (!synth) {
      setError("Couldn't play the summary. Try again.");
      setPhase("idle");
      return;
    }
    const utter = new SpeechSynthesisUtterance(script);
    const tune = SPEECH_PITCH[coachId] ?? { pitch: 1, rate: 1 };
    const english = synth
      .getVoices()
      .find((voice) => voice.lang.toLowerCase().startsWith("en"));
    if (english) utter.voice = english;
    utter.pitch = tune.pitch;
    utter.rate = tune.rate;
    utter.onstart = () => setPhase("playing");
    utter.onend = () => {
      if (modeRef.current === "speech") setPhase("idle");
    };
    utter.onerror = (event) => {
      if (event.error === "canceled" || event.error === "interrupted") return;
      setError("Couldn't play the summary. Try again.");
      setPhase("idle");
    };
    modeRef.current = "speech";
    const startSpeech = () => {
      synth.speak(utter);
      setPhase("playing");
    };
    // cancel() in the same turn drops the new utterance in Chrome.
    if (synth.speaking || synth.pending) {
      synth.cancel();
      window.setTimeout(startSpeech, 80);
    } else {
      startSpeech();
    }
  }

  async function start() {
    const audio = audioElement();
    audio.src = SILENT_WAV;
    const unlocked = audio.play();
    setPhase("loading");
    setError("");
    try {
      await unlocked.catch(() => undefined);
      audio.pause();
      const response = await fetch("/api/coach/today-summary", {
        cache: "no-store",
        headers: { Accept: "audio/mpeg, application/json" },
      });
      if (!response.ok) {
        setError("Couldn't play the summary. Try again.");
        setPhase("idle");
        return;
      }
      const type = response.headers.get("content-type") ?? "";
      if (type.includes("audio")) {
        const blob = await response.blob();
        if (blob.size < 32) {
          setError("Couldn't play the summary. Try again.");
          setPhase("idle");
          return;
        }
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        audio.src = url;
        modeRef.current = "audio";
        window.speechSynthesis?.cancel();
        await audio.play();
        setPhase("playing");
        return;
      }
      const payload = (await response.json()) as { script?: string };
      if (!payload.script?.trim()) {
        setError("Couldn't play the summary. Try again.");
        setPhase("idle");
        return;
      }
      speakScript(payload.script);
    } catch {
      setError("Couldn't play the summary. Try again.");
      setPhase("idle");
    }
  }

  function onClick() {
    if (phase === "loading" || busyRef.current) return;
    const audio = audioRef.current;
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (phase === "playing") {
      if (modeRef.current === "speech") synth?.pause();
      else audio?.pause();
      setPhase("paused");
      return;
    }
    if (phase === "paused") {
      if (modeRef.current === "speech" && synth?.paused) {
        synth.resume();
        setPhase("playing");
        return;
      }
      if (modeRef.current === "audio" && audio?.src) {
        void audio.play().then(() => setPhase("playing")).catch(() => setPhase("idle"));
      }
      return;
    }
    busyRef.current = true;
    void start().finally(() => {
      busyRef.current = false;
    });
  }

  const label =
    phase === "loading"
      ? "Loading today's summary"
      : phase === "playing"
        ? "Pause today's summary"
        : "Play today's summary";

  return (
    <div className="space-y-1">
      <button
        type="button"
        data-today-summary
        data-summary-state={phase}
        aria-busy={phase === "loading"}
        aria-pressed={phase === "playing"}
        aria-label={label}
        onClick={onClick}
        className={`flex h-14 w-full items-center gap-2.5 rounded-2xl border bg-card px-2.5 text-left ${
          phase === "playing" || phase === "loading" ? "border-accent" : "border-line"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={circle}
          alt=""
          width={512}
          height={512}
          className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-accent"
        />
        <span className="min-w-0 flex-1 whitespace-nowrap text-xs font-semibold leading-none tracking-tighter">
          Coach {name} – Today&apos;s Summary
        </span>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-foreground">
          {phase === "loading" ? (
            <span
              data-summary-spinner
              className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent"
            />
          ) : phase === "playing" ? (
            <PauseIcon />
          ) : (
            <PlayIcon />
          )}
        </span>
      </button>
      {error ? (
        <p role="alert" className="px-1 text-xs text-muted">
          {error}
        </p>
      ) : null}
    </div>
  );
}
