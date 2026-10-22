"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { countdownCue, countdownDigitAt, type CountdownDigit } from "@/lib/round-countdown";
import { playSynthCue } from "@/lib/media-output";

export type CountdownCues = {
  bell: boolean;
  vibrate: boolean;
  onGo: () => void;
};

function playCountBeep() {
  playSynthCue(880, 0.07, 0.45);
}

function playGoBell() {
  playSynthCue(660, 0.12, 0.7);
  window.setTimeout(() => playSynthCue(880, 0.16, 0.74), 90);
}

export function useGoCountdown() {
  const prefsRef = useRef<CountdownCues>({ bell: true, vibrate: true, onGo: () => {} });
  const startedAtRef = useRef<number | null>(null);
  const digitRef = useRef<CountdownDigit | null>(null);
  const timerRef = useRef<number | null>(null);
  const [digit, setDigit] = useState<CountdownDigit | null>(null);
  const [active, setActive] = useState(false);

  const cancel = useCallback(() => {
    if (timerRef.current != null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    startedAtRef.current = null;
    digitRef.current = null;
    setDigit(null);
    setActive(false);
  }, []);

  const begin = useCallback(
    (prefs: CountdownCues) => {
      if (timerRef.current != null) window.clearInterval(timerRef.current);
      prefsRef.current = prefs;
      const started = Date.now();
      startedAtRef.current = started;
      const first = countdownDigitAt(0);
      digitRef.current = first;
      setDigit(first);
      setActive(true);
      if (first && prefs.bell) playCountBeep();
      timerRef.current = window.setInterval(() => {
        const start = startedAtRef.current;
        if (start == null) return;
        const next = countdownDigitAt(Date.now() - start);
        const cue = countdownCue(digitRef.current, next);
        digitRef.current = next;
        setDigit(next);
        if (!cue) return;
        const current = prefsRef.current;
        if (cue === "beep" && current.bell) playCountBeep();
        if (cue !== "go") return;
        if (timerRef.current != null) window.clearInterval(timerRef.current);
        timerRef.current = null;
        startedAtRef.current = null;
        setActive(false);
        if (current.bell) playGoBell();
        if (current.vibrate) {
          try {
            navigator.vibrate?.(160);
          } catch {
            /* optional */
          }
        }
        current.onGo();
      }, 200);
    },
    [],
  );

  useEffect(() => () => cancel(), [cancel]);

  return { active, digit, begin, cancel };
}
