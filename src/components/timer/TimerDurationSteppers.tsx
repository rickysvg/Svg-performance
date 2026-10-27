"use client";

import { useState, type MouseEvent, type PointerEvent } from "react";
import { INTERVAL_SET_REST_MAX } from "@/lib/interval-shorthand";
import { formatDurationPick, stepDurationSeconds, stepSetRestSeconds } from "@/lib/round-timer";

const WORK_MAX = 15 * 60;
const REST_MAX = 10 * 60;

export function TimerDurationSteppers({
  rounds,
  workSeconds,
  restSeconds,
  onChange,
  roundsLabel = "Rounds",
  workLabel = "Work",
  restLabel = "Rest",
  stepSeconds = 15,
  minSeconds = 15,
  maxRounds = 20,
  sets,
  setRestSeconds,
  onSets,
}: {
  rounds: number;
  workSeconds: number;
  restSeconds: number;
  onChange: (next: { rounds: number; workSeconds: number; restSeconds: number }) => void;
  roundsLabel?: string;
  workLabel?: string;
  restLabel?: string;
  stepSeconds?: number;
  minSeconds?: number;
  maxRounds?: number;
  sets?: number;
  setRestSeconds?: number;
  onSets?: (next: { sets: number; setRestSeconds: number }) => void;
}) {
  const showSets = onSets != null && sets != null && setRestSeconds != null;
  return (
    <div data-timer-settings className="space-y-2">
    <div className="grid grid-cols-3 gap-2">
      <Stepper
        field="rounds"
        label={roundsLabel}
        value={String(rounds)}
        onDec={() => onChange({ rounds: Math.max(1, rounds - 1), workSeconds, restSeconds })}
        onInc={() => onChange({ rounds: Math.min(maxRounds, rounds + 1), workSeconds, restSeconds })}
      />
      <Stepper
        field="work"
        label={workLabel}
        value={formatDurationPick(workSeconds)}
        onDec={() =>
          onChange({
            rounds,
            workSeconds: stepDurationSeconds(workSeconds, -1, stepSeconds, minSeconds, WORK_MAX),
            restSeconds,
          })
        }
        onInc={() =>
          onChange({
            rounds,
            workSeconds: stepDurationSeconds(workSeconds, 1, stepSeconds, minSeconds, WORK_MAX),
            restSeconds,
          })
        }
      />
      <Stepper
        field="rest"
        label={restLabel}
        value={formatDurationPick(restSeconds)}
        onDec={() =>
          onChange({
            rounds,
            workSeconds,
            restSeconds: stepDurationSeconds(restSeconds, -1, stepSeconds, minSeconds, REST_MAX),
          })
        }
        onInc={() =>
          onChange({
            rounds,
            workSeconds,
            restSeconds: stepDurationSeconds(restSeconds, 1, stepSeconds, minSeconds, REST_MAX),
          })
        }
      />
    </div>
    {showSets ? (
      <div className="grid grid-cols-2 gap-2">
        <Stepper
          field="sets"
          label="Sets"
          value={String(sets)}
          onDec={() => onSets({ sets: Math.max(1, sets - 1), setRestSeconds })}
          onInc={() => onSets({ sets: Math.min(10, sets + 1), setRestSeconds })}
        />
        <Stepper
          field="set-rest"
          label="Set rest"
          value={formatDurationPick(setRestSeconds)}
          disabled={sets <= 1}
          decDisabled={setRestSeconds <= 0}
          incDisabled={setRestSeconds >= INTERVAL_SET_REST_MAX}
          onDec={() => onSets({ sets, setRestSeconds: stepSetRestSeconds(setRestSeconds, -1, stepSeconds) })}
          onInc={() => onSets({ sets, setRestSeconds: stepSetRestSeconds(setRestSeconds, 1, stepSeconds) })}
        />
      </div>
    ) : null}
    </div>
  );
}

/**
 * One step per left-button press that started on this button and ended inside it.
 * pointerdown (button 0 only) arms the tap. pointerup applies only when that
 * arm is still set and the pointer is inside. A drag-off, a drag-on, and a
 * right or middle click apply nothing. The mouse click Chrome fires after
 * pointerup is swallowed. Enter (detail 0) always steps, including the key
 * that follows a pointer sequence.
 */
export function applyStepperTap(
  event: "pointerdown" | "pointerup" | "pointercancel" | "click",
  state: { fromPointer: boolean; inside: boolean; suppressClick: boolean },
  apply: () => void,
  meta?: { button?: number; detail?: number },
) {
  const button = meta?.button ?? 0;
  if (event === "pointerdown") {
    if (button !== 0) return;
    state.fromPointer = true;
    state.inside = true;
    state.suppressClick = false;
    return;
  }
  if (event === "pointercancel") {
    state.fromPointer = false;
    state.inside = false;
    state.suppressClick = false;
    return;
  }
  if (event === "pointerup") {
    if (!state.fromPointer || button !== 0) return;
    const inside = state.inside;
    state.inside = false;
    state.fromPointer = false;
    state.suppressClick = true;
    if (!inside) return;
    apply();
    return;
  }
  // Keyboard activation. Never swallow the next Enter.
  if ((meta?.detail ?? 0) === 0) {
    state.suppressClick = false;
    state.fromPointer = false;
    if (button !== 0) return;
    apply();
    return;
  }
  if (button !== 0) return;
  if (state.suppressClick || state.fromPointer) {
    state.suppressClick = false;
    state.fromPointer = false;
  }
}

export function Stepper({
  field,
  label,
  value,
  disabled = false,
  decDisabled = false,
  incDisabled = false,
  onDec,
  onInc,
}: {
  field: string;
  label: string;
  value: string;
  disabled?: boolean;
  decDisabled?: boolean;
  incDisabled?: boolean;
  onDec: () => void;
  onInc: () => void;
}) {
  const [decPointer] = useState(() => ({ fromPointer: false, inside: false, suppressClick: false }));
  const [incPointer] = useState(() => ({ fromPointer: false, inside: false, suppressClick: false }));
  function press(
    apply: () => void,
    state: { fromPointer: boolean; inside: boolean; suppressClick: boolean },
  ) {
    return {
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        applyStepperTap("pointerdown", state, apply, { button: event.button });
      },
      onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        state.inside =
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom;
        applyStepperTap("pointerup", state, apply, { button: event.button });
      },
      onPointerCancel: () => {
        applyStepperTap("pointercancel", state, apply);
      },
      onClick: (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        applyStepperTap("click", state, apply, { button: event.button, detail: event.detail });
      },
    };
  }
  const decreaseDisabled = disabled || decDisabled;
  const increaseDisabled = disabled || incDisabled;
  return (
    <div
      data-timer-step={field}
      className={`flex min-h-16 flex-col items-center justify-center rounded-2xl border border-line bg-card px-1 py-2 ${
        disabled ? "opacity-40" : ""
      }`}
    >
      <span className="text-[10px] uppercase leading-tight tracking-wide text-muted">{label}</span>
      <span data-timer-step-value={field} className="font-display mt-1 text-xl leading-none text-accent">
        {value}
      </span>
      <span className="relative z-10 mt-1 flex gap-1">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          data-timer-step-dec={field}
          disabled={decreaseDisabled}
          {...press(onDec, decPointer)}
          className={`flex h-11 w-11 items-center justify-center rounded-full border border-line text-lg leading-none ${
            decreaseDisabled && !disabled ? "opacity-40" : ""
          }`}
        >
          −
        </button>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          data-timer-step-inc={field}
          disabled={increaseDisabled}
          {...press(onInc, incPointer)}
          className={`flex h-11 w-11 items-center justify-center rounded-full border border-line text-lg leading-none ${
            increaseDisabled && !disabled ? "opacity-40" : ""
          }`}
        >
          +
        </button>
      </span>
    </div>
  );
}
