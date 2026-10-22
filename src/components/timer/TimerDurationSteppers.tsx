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
  const fromPointer = useRef(false);
  function press(apply: () => void) {
    return {
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        fromPointer.current = true;
        apply();
        window.setTimeout(() => {
          fromPointer.current = false;
        }, 0);
      },
      onClick: (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (fromPointer.current) {
          fromPointer.current = false;
          return;
        }
        apply();
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
          {...press(onDec)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-lg leading-none"
        >
          −
        </button>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          data-timer-step-inc={field}
          {...press(onInc)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-lg leading-none"
        >
          +
        </button>
      </span>
    </div>
  );
}
