"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { PlayStep } from "@/lib/mobility";
import { MobilityStepVisual } from "@/components/mobility/MobilityStepVisual";
import { advanceCueKind, mobilityVoiceLine, type VoiceCueKind } from "@/lib/mobility-voice";

function clock(total: number) {
  const safe = Math.max(0, total);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function MobilityPlayer({
  steps,
  logHref,
}: {
  steps: PlayStep[];
  logHref: string;
}) {
  const [index, setIndex] = useState(0);
  const [left, setLeft] = useState(steps[0]?.seconds ?? 0);
  const [running, setRunning] = useState(false);
  const [cue, setCue] = useState("");
  const step = steps[index];
  const stepsRef = useRef(steps);
  const indexRef = useRef(0);
  const leftRef = useRef(steps[0]?.seconds ?? 0);
  const tenFor = useRef<number | null>(null);
  const advancedFrom = useRef<number | null>(null);

  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);

  function showCue(kind: VoiceCueKind, target?: { name: string }) {
    setCue(mobilityVoiceLine(kind, target));
  }

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const currentIndex = indexRef.current;
      const current = stepsRef.current[currentIndex];
      if (!current) return;
      const value = leftRef.current;
      if (value <= 1) {
        const upcoming = stepsRef.current[currentIndex + 1];
        if (!upcoming) {
          leftRef.current = 0;
          setLeft(0);
          setRunning(false);
          return;
        }
        if (advancedFrom.current === currentIndex) return;
        advancedFrom.current = currentIndex;
        tenFor.current = null;
        setCue(mobilityVoiceLine(advanceCueKind(current, upcoming), upcoming));
        indexRef.current = currentIndex + 1;
        leftRef.current = upcoming.seconds;
        setIndex(currentIndex + 1);
        setLeft(upcoming.seconds);
        return;
      }
      const next = value - 1;
      leftRef.current = next;
      setLeft(next);
      if (next === 10 && tenFor.current !== currentIndex && current.seconds > 15) {
        tenFor.current = currentIndex;
        setCue(mobilityVoiceLine("ten"));
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  function go(nextIndex: number) {
    const target = steps[nextIndex];
    if (!target || !step) return;
    if (nextIndex > indexRef.current) showCue(advanceCueKind(step, target), target);
    tenFor.current = null;
    advancedFrom.current = null;
    indexRef.current = nextIndex;
    leftRef.current = target.seconds;
    setIndex(nextIndex);
    setLeft(target.seconds);
  }

  function toggleRun() {
    if (!step) return;
    if (running) {
      setRunning(false);
      return;
    }
    const fresh = leftRef.current <= 0 || leftRef.current === step.seconds;
    if (leftRef.current <= 0) {
      leftRef.current = step.seconds;
      setLeft(step.seconds);
    }
    if (fresh) showCue("start", step);
    setRunning(true);
  }

  if (!step) {
    return <p className="text-sm text-muted">This routine has no steps yet.</p>;
  }

  const last = index >= steps.length - 1;

  return (
    <section className="space-y-4 rounded-[1.75rem] bg-black px-5 py-6 text-white">
      <p className="font-display text-xs uppercase tracking-[0.14em] text-highlighter">
        {index + 1} / {steps.length}
        {step.sideLabel ? ` · ${step.sideLabel}` : ""}
        {step.repeatLabel ? ` · ${step.repeatLabel}` : ""}
      </p>
      <MobilityStepVisual blockKey={step.blockKey} title={step.name} mirror={step.side === "right"} />
      <h2 className="text-3xl text-white">{step.name}</h2>
      <p className="text-sm text-white/75">{step.prescription}</p>
      {step.advanced ? (
        <p className="rounded-2xl bg-white/10 px-3 py-2 text-sm text-highlighter">
          Advanced. Skip it if you are new, have a neck injury, or sparred hard today.
        </p>
      ) : null}
      <p className="text-base leading-relaxed text-white/90">{step.cues}</p>
      <p className="font-display text-center text-7xl tracking-wide text-accent">{clock(left)}</p>
      <div className="flex items-center justify-between gap-3">
        <p data-step-cue={cue || "ready"} aria-live="polite" className="text-sm text-highlighter">
          {cue || "On screen only. No voice."}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          data-testid="mobility-play-toggle"
          type="button"
          onClick={toggleRun}
          className="touch-target rounded-full bg-accent text-base text-black"
        >
          {running ? "Pause" : left <= 0 ? "Restart" : "Start"}
        </button>
        <button
          type="button"
          onClick={() => go(index + 1)}
          disabled={last}
          className="touch-target rounded-full border border-white/30 text-base text-white disabled:opacity-40"
        >
          Next
        </button>
      </div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          className="text-white/80 disabled:opacity-40"
        >
          Back
        </button>
        <p className="text-right text-white/70">Next up · {step.nextName}</p>
      </div>
      <Link
        href={logHref}
        className="touch-target flex w-full items-center justify-center rounded-full bg-white text-black"
      >
        Log holds, reps, and sets
      </Link>
    </section>
  );
}
