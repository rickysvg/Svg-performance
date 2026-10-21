"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { formatDurationPick, secondSteps } from "@/lib/round-timer";

type Field = "rounds" | "work" | "rest";

const FIELD_TITLE: Record<Field, string> = {
  rounds: "Rounds",
  work: "Work",
  rest: "Rest",
};

const WORK_MAX = 15 * 60;
const REST_MAX = 10 * 60;

function optionsFor(field: Field, current: number) {
  if (field === "rounds") {
    const values = Array.from({ length: 20 }, (_, index) => index + 1);
    if (!values.includes(current)) values.push(current);
    return values.sort((a, b) => a - b);
  }
  if (field === "work") return secondSteps(5, WORK_MAX, current);
  return secondSteps(5, REST_MAX, current);
}

function optionLabel(field: Field, value: number) {
  if (field === "rounds") return String(value);
  return formatDurationPick(value);
}

function PickerSheet({
  field,
  value,
  onSelect,
  onClose,
}: {
  field: Field;
  value: number;
  onSelect: (value: number) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const options = optionsFor(field, value);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
    window.addEventListener("keydown", onKey, true);
    const selected = document.querySelector(`[data-timer-picker-option="${value}"]`);
    selected?.scrollIntoView({ block: "center" });
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onClose, value]);

  const sheet = (
    <div
      className="fixed inset-0 z-[80] flex items-end bg-black/80"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-timer-picker
        data-timer-picker-field={field}
        className="max-h-[78dvh] w-full rounded-t-3xl bg-background px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 text-foreground"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <div className="flex items-center justify-between gap-3">
          <p id={titleId} className="font-display text-xl uppercase tracking-wide">
            {FIELD_TITLE[field]}
          </p>
          <button type="button" onClick={onClose} className="touch-target text-2xl leading-none" aria-label="Close picker">
            ×
          </button>
        </div>
        <div className="mt-3 max-h-[56dvh] overflow-y-auto rounded-2xl border border-line bg-card">
          {options.map((option) => {
            const selected = option === value;
            return (
              <button
                key={option}
                type="button"
                data-timer-picker-option={option}
                aria-pressed={selected}
                onClick={() => onSelect(option)}
                className={`flex min-h-14 w-full items-center justify-center border-b border-line font-display text-2xl uppercase tracking-wide last:border-b-0 ${
                  selected ? "bg-black text-accent" : "text-foreground"
                }`}
              >
                {optionLabel(field, option)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return sheet;
  return createPortal(sheet, document.body);
}

export function TimerDurationFields({
  rounds,
  workSeconds,
  restSeconds,
  onChange,
}: {
  rounds: number;
  workSeconds: number;
  restSeconds: number;
  onChange: (next: { rounds: number; workSeconds: number; restSeconds: number }) => void;
}) {
  const [field, setField] = useState<Field | null>(null);
  const current = { rounds, workSeconds, restSeconds };

  function select(value: number) {
    if (!field) return;
    if (field === "rounds") onChange({ ...current, rounds: value });
    if (field === "work") onChange({ ...current, workSeconds: value });
    if (field === "rest") onChange({ ...current, restSeconds: value });
    setField(null);
  }

  const shown =
    field === "rounds" ? rounds : field === "work" ? workSeconds : restSeconds;

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <PickButton field="rounds" label="Rounds" value={optionLabel("rounds", rounds)} onOpen={setField} />
        <PickButton field="work" label="Work" value={optionLabel("work", workSeconds)} onOpen={setField} />
        <PickButton field="rest" label="Rest" value={optionLabel("rest", restSeconds)} onOpen={setField} />
      </div>
      {field ? (
        <PickerSheet field={field} value={shown} onSelect={select} onClose={() => setField(null)} />
      ) : null}
    </>
  );
}

function PickButton({
  field,
  label,
  value,
  onOpen,
}: {
  field: Field;
  label: string;
  value: string;
  onOpen: (field: Field) => void;
}) {
  return (
    <button
      type="button"
      data-timer-pick={field}
      aria-haspopup="dialog"
      onClick={() => onOpen(field)}
      className="flex min-h-16 w-full flex-col items-center justify-center rounded-2xl border border-line bg-card px-2 py-2"
    >
      <span className="text-[10px] uppercase leading-tight tracking-wide text-muted">{label}</span>
      <span className="font-display mt-1 text-xl leading-none text-accent">{value}</span>
    </button>
  );
}
