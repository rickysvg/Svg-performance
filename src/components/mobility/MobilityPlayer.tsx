"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PlayStep } from "@/lib/mobility";
import { MobilityFigure } from "@/components/mobility/MobilityFigure";

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
  const step = steps[index];

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setLeft((value) => {
        if (value <= 1) {
          setRunning(false);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, index]);

  function go(next: number) {
    const target = steps[next];
    if (!target) return;
    setRunning(false);
    setIndex(next);
    setLeft(target.seconds);
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
      <MobilityFigure
        blockKey={step.blockKey}
        title={step.name}
        variant="hero"
        mirror={step.side === "right"}
      />
      <h2 className="text-3xl text-white">{step.name}</h2>
      <p className="text-sm text-white/75">{step.prescription}</p>
      {step.advanced ? (
        <p className="rounded-2xl bg-white/10 px-3 py-2 text-sm text-highlighter">
          Advanced. Skip it if you are new, have a neck injury, or sparred hard today.
        </p>
      ) : null}
      <p className="text-base leading-relaxed text-white/90">{step.cues}</p>
      <p className="font-display text-center text-7xl tracking-wide text-accent">{clock(left)}</p>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => {
            if (left <= 0) setLeft(step.seconds);
            setRunning((value) => !value);
          }}
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
