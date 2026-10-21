"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  BIKE_CHOICES,
  BIKE_GOAL_LABEL,
  BIKE_LEVEL_LABEL,
  bikeChoiceMinutes,
  customBikeChoice,
  type BikeChoice,
  type BikeGoal,
} from "@/lib/bike-chooser";

function goalClass(goal: BikeGoal) {
  if (goal === "anaerobic") return "text-signal";
  if (goal === "aerobic") return "text-white/75";
  return "text-accent";
}

function SheetFrame({
  titleId,
  onClose,
  children,
}: {
  titleId: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const sheet = (
    <div
      className="fixed inset-0 z-[70] flex items-end bg-black/70"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-bike-workout-sheet
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-background px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 text-foreground"
      >
        {children}
      </div>
    </div>
  );

  if (typeof document === "undefined") return sheet;
  return createPortal(sheet, document.body);
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-center text-xs uppercase tracking-wide text-muted">
      {label}
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-line bg-background px-2 py-3 text-center text-lg text-foreground"
      />
    </label>
  );
}

export function BikeWorkoutChooser({
  choice,
  onApply,
}: {
  choice: BikeChoice | null;
  onApply: (choice: BikeChoice) => void;
}) {
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [error, setError] = useState("");
  const titleId = useId();
  const spec = choice?.id === "custom" ? choice.spec : null;
  const [sprint, setSprint] = useState(spec ? String(spec.workSeconds) : "20");
  const [rest, setRest] = useState(spec ? String(spec.restSeconds) : "40");
  const [rounds, setRounds] = useState(spec ? String(spec.roundsPerSet) : "8");
  const [warmup, setWarmup] = useState(spec ? String(spec.warmupSeconds ?? 0) : "");
  const [cooldown, setCooldown] = useState(spec ? String(spec.cooldownSeconds ?? 0) : "");

  function close() {
    setOpen(false);
    setCustomOpen(false);
    setError("");
  }

  function apply(next: BikeChoice) {
    onApply(next);
    close();
  }

  function applyCustom() {
    const next = customBikeChoice({
      workSeconds: Number(sprint),
      restSeconds: Number(rest),
      rounds: Number(rounds),
      warmupSeconds: warmup.trim() === "" ? 0 : Number(warmup),
      cooldownSeconds: cooldown.trim() === "" ? 0 : Number(cooldown),
    });
    if (!next) {
      setError("Sprint is 1–600s, rest 0–600s, sprints 1–40. Warm-up and cool-down are 0–900s.");
      return;
    }
    apply(next);
  }

  return (
    <>
      <div className="mt-3" data-bike-workout-chooser>
        {choice ? (
          <div data-bike-choice-name>
            <p className="font-display text-xs uppercase tracking-wide text-accent">{choice.name}</p>
            <p className="mt-1 text-sm text-muted">{choice.description}</p>
          </div>
        ) : null}
        <button
          type="button"
          data-change-bike-workout
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="font-display mt-2 inline-flex min-h-10 items-center rounded-full border border-line px-4 text-sm uppercase tracking-wide"
        >
          Change workout
        </button>
      </div>
      {open ? (
        <SheetFrame titleId={titleId} onClose={close}>
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p id={titleId} className="font-display text-xl uppercase tracking-wide">
                {customOpen ? "Custom sprints" : "Bike workouts"}
              </p>
              <p className="mt-1 text-sm text-muted">
                {customOpen
                  ? "The interval clock uses these seconds."
                  : "Pick a proven bike. It replaces today’s session."}
              </p>
            </div>
            <button type="button" onClick={close} className="touch-target text-2xl leading-none" aria-label="Close">
              ×
            </button>
          </div>

          {customOpen ? (
            <div className="mt-4 space-y-3" data-bike-custom-form>
              <div className="grid grid-cols-3 gap-2">
                <NumberField label="Sprint sec" value={sprint} min={1} max={600} onChange={setSprint} />
                <NumberField label="Rest sec" value={rest} min={0} max={600} onChange={setRest} />
                <NumberField label="Sprints" value={rounds} min={1} max={40} onChange={setRounds} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <NumberField label="Warm-up sec" value={warmup} min={0} max={900} onChange={setWarmup} />
                <NumberField label="Cool-down sec" value={cooldown} min={0} max={900} onChange={setCooldown} />
              </div>
              <p className="text-xs text-muted">Warm-up and cool-down are optional. Leave them blank to skip.</p>
              {error ? (
                <p className="text-sm text-signal" role="alert">
                  {error}
                </p>
              ) : null}
              <button
                type="button"
                data-bike-custom-apply
                onClick={applyCustom}
                className="font-display touch-target w-full rounded-full bg-accent text-sm uppercase tracking-wide text-black"
              >
                Use this workout
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomOpen(false);
                  setError("");
                }}
                className="touch-target w-full rounded-full border border-line text-sm font-semibold"
              >
                Back to workouts
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-2" data-bike-workout-list>
              {BIKE_CHOICES.map((workout) => {
                const selected = choice?.id === workout.id;
                return (
                  <button
                    key={workout.id}
                    type="button"
                    data-bike-workout={workout.id}
                    aria-pressed={selected}
                    onClick={() => apply(workout)}
                    className={`block w-full rounded-2xl border px-4 py-3 text-left ${
                      selected ? "border-accent bg-card" : "border-line bg-card"
                    }`}
                  >
                    <span className="font-display block text-lg uppercase leading-tight tracking-wide">
                      {workout.name}
                    </span>
                    <span className="mt-1 block text-sm text-muted">{workout.description}</span>
                    <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs uppercase tracking-wide">
                      <span className={goalClass(workout.goal)}>{BIKE_GOAL_LABEL[workout.goal]}</span>
                      <span className="text-white/60">
                        {BIKE_LEVEL_LABEL[workout.level]} · {bikeChoiceMinutes(workout)} min
                      </span>
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                data-bike-custom-open
                onClick={() => setCustomOpen(true)}
                className={`block w-full rounded-2xl border px-4 py-3 text-left ${
                  choice?.id === "custom" ? "border-accent bg-card" : "border-line bg-card"
                }`}
              >
                <span className="font-display block text-lg uppercase leading-tight tracking-wide">Custom</span>
                <span className="mt-1 block text-sm text-muted">
                  Set sprint seconds, rest seconds, and how many sprints.
                </span>
              </button>
            </div>
          )}
        </SheetFrame>
      ) : null}
    </>
  );
}
