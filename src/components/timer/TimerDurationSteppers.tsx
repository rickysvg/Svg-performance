"use client";

import { useRef, type MouseEvent, type PointerEvent } from "react";
import { formatDurationPick, stepDurationSeconds } from "@/lib/round-timer";

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
}) {
  return (
    <div data-timer-settings className="grid grid-cols-3 gap-2">
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
  );
}

/**
 * One step per tap that ends inside the button. pointerdown only arms the tap.
 * pointerup applies when the pointer is still inside. A drag-off applies nothing.
 * Chrome still fires click on the button after that pointerup, so the click that
 * belongs to the pointer sequence is swallowed. A later click with no pointer
 * (Enter) applies once. pointercancel is a touch drag-off and does not swallow Enter.
 */
export function applyStepperTap(
  event: "pointerdown" | "pointerup" | "pointercancel" | "click",
  state: { fromPointer: boolean; inside: boolean; suppressClick: boolean },
  apply: () => void,
) {
  if (event === "pointerdown") {
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
    const inside = state.inside;
    state.inside = false;
    state.fromPointer = false;
    state.suppressClick = true;
    if (!inside) return;
    apply();
    return;
  }
  if (state.suppressClick || state.fromPointer) {
    state.suppressClick = false;
    state.fromPointer = false;
    return;
  }
  apply();
}

function Stepper({
  field,
  label,
  value,
  onDec,
  onInc,
}: {
  field: string;
  label: string;
  value: string;
  onDec: () => void;
  onInc: () => void;
}) {
  const decPointer = useRef({ fromPointer: false, inside: false, suppressClick: false });
  const incPointer = useRef({ fromPointer: false, inside: false, suppressClick: false });
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
        applyStepperTap("pointerdown", state, apply);
      },
      onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        state.inside =
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom;
        applyStepperTap("pointerup", state, apply);
      },
      onPointerCancel: () => {
        applyStepperTap("pointercancel", state, apply);
      },
      onClick: (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        applyStepperTap("click", state, apply);
      },
    };
  }
  return (
    <div
      data-timer-step={field}
      className="flex min-h-16 flex-col items-center justify-center rounded-2xl border border-line bg-card px-1 py-2"
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
          {...press(onDec, decPointer.current)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-lg leading-none"
        >
          −
        </button>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          data-timer-step-inc={field}
          {...press(onInc, incPointer.current)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-lg leading-none"
        >
          +
        </button>
      </span>
    </div>
  );
}
