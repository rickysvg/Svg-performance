"use client";

import { useEffect, useRef, useState } from "react";
import { setCoachMotivationEnabled } from "@/app/actions/profile";
import { coachBeepUntilMs, subscribeCoachBeeps } from "@/lib/coach/motivation-clock";
import {
  cuesOnTransition,
  cuesToPrefetch,
  decideMotivationCue,
  type MotivationView,
  type PlannedCue,
} from "@/lib/coach/motivation";
import { prefetchCueClips, resolveCueClip } from "@/lib/coach/cue-prefetch";
import {
  playCoachBytes,
  reportCoachAudioIssue,
  setCoachOutputVolume,
  speakFallback,
  stopCoachPlayback,
  unlockCoachAudio,
  whenCoachOutputReady,
  COACH_AUDIO_FAILED,
} from "@/lib/coach/spoken-audio";

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
  const enabledRef = useRef(enabled);
  const coachRef = useRef(coachId);
  const viewRef = useRef(view);
  const prevRef = useRef<MotivationView | null>(null);
  const firedRef = useRef(new Set<string>());
  const lastSpokenRef = useRef<number | null>(null);
  const queueRef = useRef<PlannedCue[]>([]);
  const busyRef = useRef(false);
  const armedRef = useRef(false);
  useEffect(() => {
    enabledRef.current = enabled;
    coachRef.current = coachId;
    viewRef.current = view;
  }, [enabled, coachId, view]);

  const warmKey = view.groups.map((group) => `${group.name}:${group.logMode}`).join("|");

  function remember(cue: PlannedCue) {
    if (firedRef.current.has(cue.id)) return;
    if (queueRef.current.some((row) => row.id === cue.id)) return;
    if (cue.moment === "rest10" || cue.moment === "finish") queueRef.current.unshift(cue);
    else queueRef.current.push(cue);
    if (queueRef.current.length > 3) queueRef.current.splice(1, queueRef.current.length - 3);
  }

  function release(cue: PlannedCue) {
    firedRef.current.delete(cue.id);
    lastSpokenRef.current = null;
    remember(cue);
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
    let script = headerTextFromCue(cue);
    try {
      const { clip } = await resolveCueClip(cue);
      if (clip?.script) script = clip.script;
      if (!enabledRef.current) return;
      if (Date.now() < coachBeepUntilMs()) {
        release(cue);
        return;
      }
      if (!clip?.bytes || clip.bytes.byteLength < 32) {
        reportCoachAudioIssue(COACH_AUDIO_FAILED);
        if (script) speakFallback(script, coachRef.current);
        return;
      }
      await playCoachBytes(clip.bytes);
    } catch {
      if (!enabledRef.current) return;
      reportCoachAudioIssue(COACH_AUDIO_FAILED);
      if (script) speakFallback(script, coachRef.current);
    } finally {
      busyRef.current = false;
    }
  }

  function enqueue(cues: PlannedCue[]) {
    for (const cue of cues) remember(cue);
    const next = queueRef.current[0];
    if (next) void speakCue(next);
  }

  function armFromGesture() {
    unlockCoachAudio();
    if (!enabledRef.current || armedRef.current) return;
    armedRef.current = true;
    const cues = cuesOnTransition(null, viewRef.current);
    prevRef.current = viewRef.current;
    enqueue(cues);
  }

  useEffect(() => {
    if (!enabled) return;
    void prefetchCueClips(cuesToPrefetch(viewRef.current));
  }, [enabled, warmKey]);

  useEffect(() => {
    if (!enabled || armedRef.current) return;
    let cancelled = false;
    void whenCoachOutputReady().then((ready) => {
      if (cancelled || !ready || !enabledRef.current || armedRef.current) return;
      armedRef.current = true;
      const cues = cuesOnTransition(null, viewRef.current);
      prevRef.current = viewRef.current;
      enqueue(cues);
    });
    return () => {
      cancelled = true;
    };
    // enqueue reads refs. Arm once when Start already unlocked the context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    const onPointer = () => {
      armFromGesture();
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
    // The listener reads refs. It is armed once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!enabled) {
      stopCoachPlayback();
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
      if (Date.now() < coachBeepUntilMs()) setCoachOutputVolume(0.15);
    });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (Date.now() >= coachBeepUntilMs()) setCoachOutputVolume(1);
      const waiting = queueRef.current[0];
      if (!waiting || busyRef.current || !enabledRef.current) return;
      void speakCue(waiting);
    }, 400);
    return () => window.clearInterval(timer);
    // speakCue reads refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      stopCoachPlayback();
      window.speechSynthesis?.cancel();
    };
  }, []);

  return (
    <>
      <audio data-coach-audio playsInline preload="auto" className="hidden" />
      <button
        type="button"
        data-coach-motivation={enabled ? "on" : "off"}
        aria-pressed={enabled}
        aria-label="Coach motivation during workouts"
        onClick={() => {
          const next = !enabled;
          unlockCoachAudio();
          setEnabled(next);
          enabledRef.current = next;
          void setCoachMotivationEnabled(next);
          if (!next) return;
          if (!armedRef.current) {
            armedRef.current = true;
            const cues = cuesOnTransition(null, viewRef.current);
            prevRef.current = viewRef.current;
            enqueue(cues);
          }
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
