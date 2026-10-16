"use client";

import { useEffect, useRef, useState } from "react";
import { chunkSpeech, pickEnglishVoice } from "@/lib/coach/browser-speech";

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

const SPEECH_MISSING =
  "This browser can't read the summary aloud. The plan above is still yours to use.";

function tuneFor(coachId: string) {
  return SPEECH_PITCH[coachId] ?? { pitch: 1, rate: 1 };
}

export function SummaryReader({ script, coachId }: { script: string; coachId: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [notice, setNotice] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const modeRef = useRef<"audio" | "speech" | null>(null);
  const resumeTimer = useRef<number | null>(null);
  const tokenRef = useRef(0);

  useEffect(() => {
    return () => {
      tokenRef.current += 1;
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      if (resumeTimer.current != null) window.clearInterval(resumeTimer.current);
      window.speechSynthesis?.cancel();
    };
  }, []);

  function audioElement() {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = "auto";
      audioRef.current = audio;
    }
    return audioRef.current;
  }

  function stopResumeTimer() {
    if (resumeTimer.current != null) {
      window.clearInterval(resumeTimer.current);
      resumeTimer.current = null;
    }
  }

  function queueSpeech(token: number) {
    const synth = window.speechSynthesis;
    if (!synth) return false;
    const chunks = chunkSpeech(script);
    if (chunks.length === 0) return false;
    const tune = tuneFor(coachId);
    const voice = pickEnglishVoice(synth.getVoices(), coachId);
    synth.cancel();
    synth.resume();
    chunks.forEach((chunk, index) => {
      const utter = new SpeechSynthesisUtterance(chunk);
      utter.lang = "en-US";
      utter.pitch = tune.pitch;
      utter.rate = tune.rate;
      if (voice) utter.voice = voice;
      utter.onend = () => {
        if (tokenRef.current !== token) return;
        if (index === chunks.length - 1 && modeRef.current === "speech") setPhase("idle");
      };
      utter.onerror = (event) => {
        if (event.error === "canceled" || event.error === "interrupted") return;
        if (tokenRef.current !== token) return;
        if (modeRef.current !== "speech") return;
        setNotice("Speech didn't start. The plan above is still the summary.");
        setPhase("idle");
      };
      synth.speak(utter);
    });
    synth.resume();
    stopResumeTimer();
    resumeTimer.current = window.setInterval(() => {
      if (tokenRef.current !== token || modeRef.current !== "speech") return;
      if (synth.paused) return;
      if (synth.speaking || synth.pending) synth.resume();
    }, 8000);
    return true;
  }

  /**
   * iOS only allows speechSynthesis.speak inside the tap.
   * Queue it here, before any await. Voices often arrive on voiceschanged.
   */
  function speakInGesture() {
    const synth = window.speechSynthesis;
    if (!synth) {
      setNotice(SPEECH_MISSING);
      return false;
    }
    const token = tokenRef.current + 1;
    tokenRef.current = token;
    modeRef.current = "speech";
    const started = queueSpeech(token);
    if (synth.getVoices().length === 0) {
      const onVoices = () => {
        synth.removeEventListener("voiceschanged", onVoices);
        if (tokenRef.current !== token || modeRef.current !== "speech") return;
        queueSpeech(token);
      };
      synth.addEventListener("voiceschanged", onVoices);
    }
    return started;
  }

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

  async function fetchAudio(token: number) {
    try {
      const response = await fetch("/api/coach/today-summary", {
        cache: "no-store",
        headers: { Accept: "audio/mpeg, application/json" },
      });
      if (tokenRef.current !== token) return;
      if (!response.ok) {
        if (modeRef.current !== "speech") {
          setNotice(SPEECH_MISSING);
          setPhase("idle");
        }
        return;
      }
      const type = response.headers.get("content-type") ?? "";
      if (!type.includes("audio")) {
        if (modeRef.current !== "speech") {
          setNotice(SPEECH_MISSING);
          setPhase("idle");
        }
        return;
      }
      const blob = await response.blob();
      if (tokenRef.current !== token || blob.size < 32) return;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      window.speechSynthesis?.cancel();
      stopResumeTimer();
      const audio = audioElement();
      audio.src = url;
      modeRef.current = "audio";
      audio.onended = () => {
        if (tokenRef.current === token) setPhase("idle");
      };
      await audio.play();
      if (tokenRef.current === token) setPhase("playing");
    } catch {
      if (tokenRef.current !== token) return;
      if (modeRef.current === "speech") return;
      setNotice("Speech didn't start. The plan above is still the summary.");
      setPhase("idle");
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
    const audio = audioElement();
    audio.src = SILENT_WAV;
    void audio.play().then(() => audio.pause()).catch(() => undefined);
    const spoken = speakInGesture();
    const token = tokenRef.current;
    if (spoken) setPhase("playing");
    else setPhase("loading");
    void fetchAudio(token);
  }

  const label =
    phase === "playing" ? "Pause" : phase === "paused" ? "Resume" : "Read it to me";

  return (
    <div className="space-y-2">
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
