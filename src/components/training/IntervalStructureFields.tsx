"use client";

import { useEffect, useRef, useState, type PointerEvent, type MouseEvent } from "react";
import {
  clampIntervalStructure,
  commitShorthand,
  formatIntervalClock,
  formatIntervalShorthand,
  intervalDurationCapMessage,
  INTERVAL_REST_MAX,
  INTERVAL_ROUNDS_MAX,
  INTERVAL_SESSION_MAX_SECONDS,
  INTERVAL_SET_REST_MAX,
  INTERVAL_WORK_MAX,
  INTERVAL_WORK_MIN,
  stepSeconds,
  type IntervalStructure,
} from "@/lib/interval-shorthand";
import { intervalTotals, type IntervalTotalType } from "@/lib/interval-totals";
import { applyStepperTap } from "@/components/timer/TimerDurationSteppers";

export type IntervalFieldPreset = {
  id: string;
  label: string;
  structure: IntervalStructure;
};

function stepSetRest(current: number, direction: -1 | 1) {
  return Math.min(INTERVAL_SET_REST_MAX, Math.max(0, current + direction * 15));
}

export function IntervalStructureFields({
  shorthand,
  structure,
  done,
  totalType,
  presets,
  showDone = true,
  onShorthandCommit,
  onStructure,
  onLiveStructure,
  onDone,
}: {
  shorthand: string;
  structure: IntervalStructure;
  done: number;
  totalType: IntervalTotalType;
  presets: IntervalFieldPreset[];
  showDone?: boolean;
  onShorthandCommit: (text: string) => void;
  onStructure: (next: IntervalStructure) => void;
  /** Updates the steppers while the member is still typing. Does not rewrite the line. */
  onLiveStructure?: (next: IntervalStructure) => void;
  onDone: (done: number) => void;
}) {
  const [line, setLine] = useState(shorthand);
  const [trackedShorthand, setTrackedShorthand] = useState(shorthand);
  const [error, setError] = useState("");
  const structureRef = useRef(structure);
  const liveRef = useRef(onLiveStructure ?? onStructure);
  if (shorthand !== trackedShorthand) {
    setTrackedShorthand(shorthand);
    setLine(shorthand);
  }
  useEffect(() => {
    structureRef.current = structure;
    liveRef.current = onLiveStructure ?? onStructure;
  });
  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = commitShorthand(line, structureRef.current);
      setError(next.error);
      if (!next.error) liveRef.current(next.structure);
    }, 200);
    return () => window.clearTimeout(handle);
  }, [line]);
  const totalRounds = Math.max(1, structure.sets * structure.rounds);
  const spec = {
    sets: structure.sets,
    rounds: structure.rounds,
    workSeconds: structure.workSeconds,
    restSeconds: structure.restSeconds,
    setRestSeconds: structure.setRestSeconds,
  };
  const totals = intervalTotals(totalType, spec, Math.min(totalRounds, Math.max(0, done)));
  const configured = intervalTotals(totalType, spec, totalRounds);
  const overCap = configured.totalSeconds > INTERVAL_SESSION_MAX_SECONDS;
  const setsLocked = structure.sets <= 1;

  function commitLine(text: string) {
    const next = commitShorthand(text, structure);
    setError(next.error);
    if (!next.error) {
      onShorthandCommit(formatIntervalShorthand(next.structure));
      onStructure(next.structure);
    }
  }

  function patch(partial: Partial<IntervalStructure>) {
    onStructure(clampIntervalStructure({ ...structure, ...partial }));
  }

  function commitDone(value: number) {
    const total = Math.max(1, structure.sets * structure.rounds);
    onDone(Math.min(total, Math.max(0, Math.round(value) || 0)));
  }

  return (
    <div className="space-y-3" data-testid="interval-structure">
      <label className="block">
        <span className="sr-only">Interval shorthand</span>
        <input
          value={line}
          onChange={(event) => {
            setLine(event.target.value);
            setError("");
          }}
          onBlur={() => commitLine(line)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitLine(line);
            }
          }}
          inputMode="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          aria-invalid={error ? true : undefined}
          data-testid="interval-shorthand"
          className="h-11 w-full rounded-2xl border border-[#CBF805] bg-black px-3 font-mono text-base text-[#CBF805]"
        />
      </label>
      {error && !overCap ? (
        <p className="text-sm text-[#FF3B3B]" role="alert" data-testid="interval-shorthand-error">
          {error}
        </p>
      ) : null}
      {presets.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1" data-testid="interval-presets">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onStructure(preset.structure)}
              className="inline-flex h-10 shrink-0 items-center rounded-full border border-line px-3 text-sm text-white"
            >
              {preset.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-3">
        <CompactStepper
          field="work"
          label="Work s"
          value={structure.workSeconds}
          onDec={() => patch({ workSeconds: stepSeconds(structure.workSeconds, -1, INTERVAL_WORK_MIN, INTERVAL_WORK_MAX) })}
          onInc={() => patch({ workSeconds: stepSeconds(structure.workSeconds, 1, INTERVAL_WORK_MIN, INTERVAL_WORK_MAX) })}
          onCommit={(value) => patch({ workSeconds: value })}
        />
        <CompactStepper
          field="rest"
          label="Rest s"
          value={structure.restSeconds}
          onDec={() => patch({ restSeconds: stepSeconds(structure.restSeconds, -1, 0, INTERVAL_REST_MAX) })}
          onInc={() => patch({ restSeconds: stepSeconds(structure.restSeconds, 1, 0, INTERVAL_REST_MAX) })}
          onCommit={(value) => patch({ restSeconds: value })}
        />
        <CompactStepper
          field="rounds"
          label="Rounds"
          value={structure.rounds}
          onDec={() => patch({ rounds: Math.max(1, structure.rounds - 1) })}
          onInc={() => patch({ rounds: Math.min(INTERVAL_ROUNDS_MAX, structure.rounds + 1) })}
          onCommit={(value) => patch({ rounds: value })}
        />
        <CompactStepper
          field="sets"
          label="Sets"
          value={structure.sets}
          onDec={() => patch({ sets: Math.max(1, structure.sets - 1) })}
          onInc={() => patch({ sets: Math.min(10, structure.sets + 1) })}
          onCommit={(value) => patch({ sets: value })}
        />
        <CompactStepper
          field="set-rest"
          label="Set rest s"
          value={structure.setRestSeconds}
          disabled={setsLocked}
          onDec={() => patch({ setRestSeconds: stepSetRest(structure.setRestSeconds, -1) })}
          onInc={() => patch({ setRestSeconds: stepSetRest(structure.setRestSeconds, 1) })}
          onCommit={(value) => patch({ setRestSeconds: value })}
        />
        {showDone ? (
          <CompactStepper
            field="done"
            label="Done"
            value={Math.min(totalRounds, Math.max(0, done))}
            onDec={() => onDone(Math.max(0, done - 1))}
            onInc={() => onDone(Math.min(totalRounds, done + 1))}
            onCommit={commitDone}
          />
        ) : null}
      </div>
      <div className="rounded-2xl border border-line bg-card px-4 py-3" data-testid="interval-total">
        <p className="font-display text-2xl text-[#CBF805]" data-testid="interval-total-time">
          {overCap ? "Max 4:00:00" : formatIntervalClock(totals.totalSeconds)}
        </p>
        {overCap ? (
          <p className="text-sm text-[#FF3B3B]" role="alert" data-testid="interval-duration-cap">
            {intervalDurationCapMessage(configured.totalSeconds)}
          </p>
        ) : (
          <p className="text-sm text-white/70">
            {formatIntervalClock(totals.workSeconds)} work · {totals.totalRounds} rounds
          </p>
        )}
      </div>
    </div>
  );
}

function CompactStepper({
  field,
  label,
  value,
  disabled = false,
  onDec,
  onInc,
  onCommit,
}: {
  field: string;
  label: string;
  value: number;
  disabled?: boolean;
  onDec: () => void;
  onInc: () => void;
  onCommit: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div
      data-interval-step={field}
      className={`flex flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-card px-1 py-2 ${
        disabled ? "opacity-40" : ""
      }`}
    >
      <span className="text-[10px] uppercase leading-none tracking-wide text-muted">{label}</span>
      {editing && !disabled ? (
        <input
          autoFocus
          inputMode="numeric"
          defaultValue={value}
          aria-label={label}
          onBlur={(event) => {
            const parsed = Number(event.target.value);
            if (Number.isFinite(parsed)) onCommit(parsed);
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="w-[4.5rem] bg-transparent text-center font-display text-2xl text-[#CBF805]"
        />
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setEditing(true)}
          className="min-w-[3ch] text-center font-display text-2xl leading-none text-[#CBF805]"
          data-interval-step-value={field}
        >
          {value}
        </button>
      )}
      <span className="mt-0.5 flex gap-1">
        <StepButton label={`Decrease ${label}`} disabled={disabled} onStep={onDec} />
        <StepButton label={`Increase ${label}`} disabled={disabled} onStep={onInc} />
      </span>
    </div>
  );
}

function StepButton({
  label,
  disabled,
  onStep,
}: {
  label: string;
  disabled: boolean;
  onStep: () => void;
}) {
  const pointer = useRef({ fromPointer: false, inside: false, suppressClick: false });
  const repeated = useRef(false);
  const delay = useRef<number | null>(null);
  const repeat = useRef<number | null>(null);
  const stepRef = useRef(onStep);
  useEffect(() => {
    stepRef.current = onStep;
  });

  function clearTimers() {
    if (delay.current != null) window.clearTimeout(delay.current);
    if (repeat.current != null) window.clearInterval(repeat.current);
    delay.current = null;
    repeat.current = null;
  }

  function press(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || disabled) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    repeated.current = false;
    applyStepperTap("pointerdown", pointer.current, onStep, { button: event.button });
    clearTimers();
    delay.current = window.setTimeout(() => {
      repeated.current = true;
      stepRef.current();
      repeat.current = window.setInterval(() => stepRef.current(), 120);
    }, 400);
  }

  function release(event: PointerEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    pointer.current.inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    clearTimers();
    applyStepperTap(
      "pointerup",
      pointer.current,
      () => {
        if (repeated.current) {
          repeated.current = false;
          return;
        }
        onStep();
      },
      { button: event.button },
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={() => {
        clearTimers();
        applyStepperTap("pointercancel", pointer.current, onStep);
      }}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        applyStepperTap("click", pointer.current, onStep, { button: event.button, detail: event.detail });
      }}
      className="flex size-11 items-center justify-center rounded-full border border-line text-lg leading-none disabled:opacity-40"
    >
      {label.startsWith("Decrease") ? "−" : "+"}
    </button>
  );
}
