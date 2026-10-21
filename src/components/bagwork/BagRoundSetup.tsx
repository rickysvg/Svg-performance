"use client";

import { useState } from "react";
import { RoundTimerButton } from "@/components/timer/RoundTimerButton";
import { bagworkBackHref } from "@/lib/bagwork";

function clampCount(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function BagRoundSetup({
  workoutKey,
  workoutName,
  rounds,
  workMinutes,
  restMinutes,
}: {
  workoutKey: string;
  workoutName: string;
  rounds: number;
  workMinutes: number;
  restMinutes: number;
}) {
  const [roundCount, setRoundCount] = useState(rounds);
  const [work, setWork] = useState(workMinutes);
  const [rest, setRest] = useState(restMinutes);
  const launch = {
    key: workoutKey,
    name: workoutName,
    rounds: clampCount(roundCount, 1, 20, rounds),
    workSeconds: clampCount(work, 1, 15, workMinutes) * 60,
    restSeconds: clampCount(rest, 1, 10, restMinutes) * 60,
    backHref: bagworkBackHref(workoutKey),
  };

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-card p-4" data-bag-round-setup>
      <p className="text-sm text-muted">
        Set the rounds yourself. The recommendation is a range, not a required count.
      </p>
      <div className="grid grid-cols-3 gap-2">
        <CountField label="Rounds" value={roundCount} min={1} max={20} onChange={setRoundCount} />
        <CountField label="Round min" value={work} min={1} max={15} onChange={setWork} />
        <CountField label="Rest min" value={rest} min={1} max={10} onChange={setRest} />
      </div>
      <RoundTimerButton label="Start rounds" launch={launch} />
    </div>
  );
}

function CountField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-center text-xs uppercase tracking-wide text-muted">
      {label}
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : ""}
        required
        onChange={(event) => onChange(event.target.value === "" ? Number.NaN : Number(event.target.value))}
        className="mt-2 w-full rounded-2xl border border-line bg-background px-2 py-3 text-center text-lg text-foreground"
      />
    </label>
  );
}
