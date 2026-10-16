"use client";

import { useEffect, useRef, useState } from "react";
import { setCoachMotivationEnabled } from "@/app/actions/profile";
import { coachBeepUntilMs, subscribeCoachBeeps } from "@/lib/coach/motivation-clock";
import {
  cuesOnTransition,
  decideMotivationCue,
  type MotivationView,
  type PlannedCue,
} from "@/lib/coach/motivation";
import { playCoachSrc, speakFallback, unlockCoachAudio } from "@/lib/coach/spoken-audio";

export function WorkoutCoachCues({
  initialEnabled,
  coachId,
  view,
}: {
  initialEnabled: boolean;
  coachId: string;
  view: MotivationView;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const enabledRef = useRef(enabled);
  const coachRef = useRef(coachId);
  const viewRef = useRef(view);
  const prevRef = useRef<MotivationView | null>(null);
  const firedRef = useRef(new Set<string>());
  const lastSpokenRef = useRef<number | null>(null);
  const queueRef = useRef<PlannedCue[]>([]);
  const urlRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const armedRef = useRef(false);
  useEffect(() => {
    enabledRef.current = enabled;
    coachRef.current = coachId;
    viewRef.current = view;
  }, [enabled, coachId, view]);

  function remember(cue: PlannedCue) {
    if (firedRef.current.has(cue.id)) return;
    if (queueRef.current.some((row) => row.id === cue.id)) return;
    if (cue.moment === "rest10" || cue.moment === "finish") queueRef.current.unshift(cue);
    else queueRef.current.push(cue);
    if (queueRef.current.length > 3) queueRef.current.splice(1, queueRef.current.length - 3);
  }

  async function speakCue(cue: PlannedCue) {
    if (!enabledRef.current || busyRef.current) return;
    const decision = decideMotivationCue({
      enabled: enabledRef.current,
      nowMs: Date.now(),
      lastSpokenAtMs: lastSpokenRef.current,
      beepUntilMs: coachBeepUntilMs(),
      restRemaining: viewRef.current.restRemaining,
      moment: cue.moment,
    });
    if (decision.decision === "skip") {
      if (decision.reason === "late" || decision.reason === "off") {
        firedRef.current.add(cue.id);
        queueRef.current = queueRef.current.filter((row) => row.id !== cue.id);
      }
      return;
    }
    if (decision.decision === "queue") return;
    busyRef.current = true;
    firedRef.current.add(cue.id);
    lastSpokenRef.current = Date.now();
    queueRef.current = queueRef.current.filter((row) => row.id !== cue.id);
    try {
      const response = await fetch("/api/coach/motivation", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "audio/mpeg, application/json" },
        body: JSON.stringify({
          moment: cue.moment,
          exerciseName: cue.exerciseName,
          previousLoad: cue.previousLoad ?? null,
          load: cue.load ?? null,
          bagTheme: cue.bagTheme,
          id: cue.id,
        }),
      });
      if (!enabledRef.current) return;
      const type = response.headers.get("content-type") ?? "";
      const headerScript = response.headers.get("X-Coach-Script");
      const headerText = headerScript ? decodeURIComponent(headerScript) : "";
      if (!type.includes("audio")) {
        const body = type.includes("json")
          ? ((await response.json()) as { text?: string; muted?: boolean })
          : null;
        if (body?.muted) return;
        const text = body?.text || headerText;
        if (text) speakFallback(text, coachRef.current);
        return;
      }
      const blob = await response.blob();
      const audio = audioRef.current;
      if (!audio || blob.size < 32) throw new Error("tts");
      if (Date.now() < coachBeepUntilMs()) {
        firedRef.current.delete(cue.id);
        lastSpokenRef.current = null;
        remember(cue);
        return;
      }
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      audio.volume = 1;
      await playCoachSrc(audio, url);
    } catch {
      const text = headerTextFromCue(cue);
      if (enabledRef.current && text) speakFallback(text, coachRef.current);
    } finally {
      busyRef.current = false;
    }
  }

  function enqueue(cues: PlannedCue[]) {
    for (const cue of cues) remember(cue);
    const next = queueRef.current[0];
    if (next) void speakCue(next);
  }

  useEffect(() => {
    const onPointer = () => {
      const audio = audioRef.current;
      if (audio) unlockCoachAudio(audio);
      if (!enabledRef.current || armedRef.current) return;
      armedRef.current = true;
      const cues = cuesOnTransition(null, viewRef.current);
      prevRef.current = viewRef.current;
      enqueue(cues);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
    // The listener reads refs. It is armed once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!enabled) {
      audioRef.current?.pause();
      window.speechSynthesis?.cancel();
      queueRef.current = [];
      prevRef.current = view;
      return;
    }
    if (!armedRef.current) {
      prevRef.current = view;
      return;
    }
    const cues = cuesOnTransition(prevRef.current, view);
    prevRef.current = view;
    enqueue(cues);
    // enqueue closes over refs on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, view]);

  useEffect(() => {
    return subscribeCoachBeeps(() => {
      const audio = audioRef.current;
      if (!audio) return;
      if (Date.now() < coachBeepUntilMs()) audio.volume = 0.15;
    });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const audio = audioRef.current;
      if (audio && Date.now() >= coachBeepUntilMs() && audio.volume < 1 && !audio.paused) {
        audio.volume = 1;
      }
      const waiting = queueRef.current[0];
      if (!waiting || busyRef.current || !enabledRef.current) return;
      void speakCue(waiting);
    }, 400);
    return () => window.clearInterval(timer);
    // speakCue reads refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      audio?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      window.speechSynthesis?.cancel();
    };
  }, []);

  return (
    <>
      <audio ref={audioRef} data-coach-audio playsInline preload="auto" className="hidden" />
      <button
        type="button"
        data-coach-motivation={enabled ? "on" : "off"}
        aria-pressed={enabled}
        aria-label="Coach motivation during workouts"
        onClick={() => {
          const next = !enabled;
          setEnabled(next);
          const audio = audioRef.current;
          if (next && audio) unlockCoachAudio(audio);
          void setCoachMotivationEnabled(next);
        }}
        className="touch-target text-sm font-medium"
      >
        {enabled ? "Coach on" : "Coach off"}
      </button>
    </>
  );
}

function headerTextFromCue(cue: PlannedCue) {
  if (cue.moment === "rest10") return "Last 10 seconds. Get set.";
  if (cue.moment === "finish") return "That's the session.";
  if (cue.exerciseName) return cue.exerciseName;
  return "";
}
