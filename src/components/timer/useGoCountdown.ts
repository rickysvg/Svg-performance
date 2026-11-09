"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { countdownCue, countdownDigitAt, countdownSound, type CountdownDigit } from "@/lib/round-countdown";
import { vibratePattern } from "@/lib/media-output";

export type CountdownCues = {
  vibrate: boolean;
  onGo: () => void;
};

export function useGoCountdown() {
  const prefsRef = useRef<CountdownCues>({ vibrate: true, onGo: () => {} });
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

  const begin = useCallback((prefs: CountdownCues) => {
    if (timerRef.current != null) window.clearInterval(timerRef.current);
    prefsRef.current = prefs;
    const started = Date.now();
    startedAtRef.current = started;
    const first = countdownDigitAt(0);
    digitRef.current = first;
    setDigit(first);
    setActive(true);
    if (first) {
      const cue = countdownSound("beep", prefs);
      if (cue.vibrate) vibratePattern(cue.pattern);
    }
    timerRef.current = window.setInterval(() => {
      const start = startedAtRef.current;
      if (start == null) return;
      const next = countdownDigitAt(Date.now() - start);
      const cue = countdownCue(digitRef.current, next);
      digitRef.current = next;
      setDigit(next);
      if (!cue) return;
      const current = prefsRef.current;
      if (cue !== "go") {
        const tick = countdownSound("beep", current);
        if (tick.vibrate) vibratePattern(tick.pattern);
        return;
      }
      if (timerRef.current != null) window.clearInterval(timerRef.current);
      timerRef.current = null;
      startedAtRef.current = null;
      setActive(false);
      const go = countdownSound("go", current);
      if (go.vibrate) vibratePattern(go.pattern);
      current.onGo();
    }, 200);
  }, []);

  useEffect(() => () => cancel(), [cancel]);

  return { active, digit, begin, cancel };
}
