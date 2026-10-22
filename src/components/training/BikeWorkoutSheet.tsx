"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  BIKE_BETWEEN_SECONDS,
  BIKE_CHOICES,
  BIKE_GOAL_LABEL,
  BIKE_LEVEL_LABEL,
  BIKE_PREP_MINUTES,
  BIKE_REST_SECONDS,
  BIKE_ROUND_COUNTS,
  BIKE_SPRINT_COUNTS,
  BIKE_SPRINT_SECONDS,
  bikeChoiceMinutes,
  bikeChoiceWithRounds,
  customBikeChoice,
  type BikeChoice,
  type BikeGoal,
} from "@/lib/bike-chooser";

type PickerField = "sprint" | "rest" | "sprints" | "rounds" | "between" | "warmup" | "cooldown";

const FIELD_TITLE: Record<PickerField, string> = {
  sprint: "Sprint seconds",
  rest: "Rest seconds",
  sprints: "Sprints",
  rounds: "Rounds",
  between: "Rest between rounds",
  warmup: "Warm-up",
  cooldown: "Cool-down",
};

function goalClass(goal: BikeGoal) {
  if (goal === "anaerobic") return "text-signal";
  if (goal === "aerobic") return "text-white/75";
  return "text-accent";
}

function stepsFor(field: PickerField, current: number) {
  const base =
    field === "sprint"
      ? [...BIKE_SPRINT_SECONDS]
      : field === "rest"
        ? [...BIKE_REST_SECONDS]
        : field === "sprints"
          ? [...BIKE_SPRINT_COUNTS]
          : field === "rounds"
            ? [...BIKE_ROUND_COUNTS]
            : field === "between"
              ? [...BIKE_BETWEEN_SECONDS]
              : [...BIKE_PREP_MINUTES];
  if (!base.includes(current)) base.push(current);
  return base.sort((a, b) => a - b);
}

function valueLabel(field: PickerField, value: number) {
  if (field === "warmup" || field === "cooldown") return value === 0 ? "Off" : `${value} min`;
  if (field === "between") {
    if (value === 0) return "Off";
    if (value % 60 === 0) return `${value / 60} min`;
    return `${value}s`;
  }
  if (field === "sprints" || field === "rounds") return String(value);
  return `${value}s`;
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
      data-testid="chrome-bike-workout-sheet-dismiss"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        data-testid="chrome-bike-workout-sheet"
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

function PickerSheet({
  field,
  value,
  onSelect,
  onClose,
}: {
  field: PickerField;
  value: number;
  onSelect: (value: number) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const options = stepsFor(field, value);

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
    const selected = document.querySelector(`[data-bike-picker-option="${value}"]`);
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
        data-testid="chrome-bike-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-bike-picker
        data-bike-picker-field={field}
        className="max-h-[78dvh] w-full rounded-t-3xl bg-background px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 text-foreground"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <div className="flex items-center justify-between gap-3">
          <p id={titleId} className="font-display text-xl uppercase tracking-wide">
            {FIELD_TITLE[field]}
          </p>
          <button type="button" onClick={onClose} data-testid="chrome-bike-picker-close" className="touch-target text-2xl leading-none" aria-label="Close picker">
            ×
          </button>
        </div>
        <div className="mt-3 max-h-[56dvh] overflow-y-auto rounded-2xl border border-line bg-card">
          {options.map((option) => {
            const selected = option === value;
            return (
              <button
                data-testid={`chrome-bike-picker-option-${option}`}
                key={option}
                type="button"
                data-bike-picker-option={option}
                aria-pressed={selected}
                onClick={() => onSelect(option)}
                className={`flex min-h-14 w-full items-center justify-center border-b border-line font-display text-2xl uppercase tracking-wide last:border-b-0 ${
                  selected ? "bg-black text-accent" : "text-foreground"
                }`}
              >
                {valueLabel(field, option)}
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

function PickButton({
  field,
  label,
  value,
  onOpen,
}: {
  field: PickerField;
  label: string;
  value: number;
  onOpen: (field: PickerField) => void;
}) {
  return (
    <button
      data-testid="chrome-bike-pick"
      type="button"
      data-bike-pick={field}
      aria-haspopup="dialog"
      onClick={() => onOpen(field)}
      className="flex min-h-16 w-full flex-col items-center justify-center rounded-2xl border border-line bg-card px-2 py-2"
    >
      <span className="text-[10px] uppercase leading-tight tracking-wide text-muted">{label}</span>
      <span className="font-display mt-1 text-xl leading-none text-accent">{valueLabel(field, value)}</span>
    </button>
  );
}

export function BikeWorkoutChooser({
  choice,
  onApply,
  seed = null,
}: {
  choice: BikeChoice | null;
  onApply: (choice: BikeChoice) => void;
  /** Programmed dose, used when no chooser workout is selected yet. */
  seed?: { workSeconds: number; restSeconds: number; roundsPerSet: number } | null;
}) {
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [error, setError] = useState("");
  const [picker, setPicker] = useState<PickerField | null>(null);
  const titleId = useId();
  const spec = choice?.spec ?? seed;
  const [sprint, setSprint] = useState(spec?.workSeconds ?? 20);
  const [rest, setRest] = useState(spec?.restSeconds ?? 40);
  const [sprints, setSprints] = useState(spec?.roundsPerSet ?? 8);
  const [rounds, setRounds] = useState(choice?.spec.repeatRounds ?? 1);
  const [between, setBetween] = useState(
    choice?.spec.restBetweenRoundsSeconds && choice.spec.restBetweenRoundsSeconds > 0
      ? choice.spec.restBetweenRoundsSeconds
      : 60,
  );
  const customSpec = choice?.id === "custom" ? choice.spec : null;
  const [warmup, setWarmup] = useState(customSpec ? Math.round((customSpec.warmupSeconds ?? 0) / 60) : 0);
  const [cooldown, setCooldown] = useState(
    customSpec ? Math.round((customSpec.cooldownSeconds ?? 0) / 60) : 0,
  );

  function close() {
    setOpen(false);
    setCustomOpen(false);
    setPicker(null);
    setError("");
  }

  function apply(next: BikeChoice) {
    onApply(next);
    close();
  }

  function openCustom() {
    const next = choice?.spec ?? seed;
    if (next && choice?.id !== "custom") {
      setSprint(next.workSeconds);
      setRest(next.restSeconds);
      setSprints(next.roundsPerSet);
    }
    setCustomOpen(true);
    setError("");
  }

  function applyCatalog(workout: BikeChoice) {
    const next = bikeChoiceWithRounds(workout, rounds, between);
    if (!next) return;
    apply(next);
  }

  function applyCustom() {
    const next = customBikeChoice({
      workSeconds: sprint,
      restSeconds: rest,
      rounds: sprints,
      warmupSeconds: warmup * 60,
      cooldownSeconds: cooldown * 60,
      repeatRounds: rounds,
      restBetweenRoundsSeconds: between,
    });
    if (!next) {
      setError("Pick a sprint, rest, and count from the lists.");
      return;
    }
    apply(next);
  }

  function selectPicker(value: number) {
    if (picker === "sprint") setSprint(value);
    if (picker === "rest") setRest(value);
    if (picker === "sprints") setSprints(value);
    if (picker === "rounds") setRounds(value);
    if (picker === "between") setBetween(value);
    if (picker === "warmup") setWarmup(value);
    if (picker === "cooldown") setCooldown(value);
    setPicker(null);
    setError("");
  }

  const pickerValue =
    picker === "sprint"
      ? sprint
      : picker === "rest"
        ? rest
        : picker === "sprints"
          ? sprints
          : picker === "rounds"
            ? rounds
            : picker === "between"
              ? between
              : picker === "warmup"
                ? warmup
                : cooldown;

  return (
    <>
      <div className="mt-3" data-bike-workout-chooser>
        {choice ? (
          <div data-bike-choice-name>
            <p className="font-display text-xs uppercase tracking-wide text-accent">{choice.name}</p>
            <p className="mt-1 text-sm text-muted">{choice.description}</p>
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            data-change-bike-workout
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen(true)}
            className="font-display inline-flex min-h-10 items-center rounded-full border border-line px-4 text-sm uppercase tracking-wide"
          >
            Change workout
          </button>
          <Link
            href="/training/history/bike"
            data-bike-history-link
            className="font-display inline-flex min-h-10 items-center rounded-full border border-line px-4 text-sm uppercase tracking-wide"
          >
            History
          </Link>
        </div>
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
                  ? "Tap a value, then scroll to the one you want."
                  : "Tap a workout to replace today’s session."}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Link
                href="/training/history/bike"
                data-bike-history-link
                className="font-display inline-flex min-h-10 items-center rounded-full border border-line px-3 text-xs uppercase tracking-wide"
              >
                History
              </Link>
              <button type="button" onClick={close} className="touch-target text-2xl leading-none" aria-label="Close">
                ×
              </button>
            </div>
          </div>

          {customOpen ? (
            <div className="mt-4 space-y-3" data-bike-custom-form>
              <div className="grid grid-cols-3 gap-2">
                <PickButton field="sprint" label="Sprint sec" value={sprint} onOpen={setPicker} />
                <PickButton field="rest" label="Rest sec" value={rest} onOpen={setPicker} />
                <PickButton field="sprints" label="Sprints" value={sprints} onOpen={setPicker} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <PickButton field="rounds" label="Rounds" value={rounds} onOpen={setPicker} />
                <PickButton field="between" label="Rest between" value={between} onOpen={setPicker} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <PickButton field="warmup" label="Warm-up" value={warmup} onOpen={setPicker} />
                <PickButton field="cooldown" label="Cool-down" value={cooldown} onOpen={setPicker} />
              </div>
              <p className="text-xs text-muted">
                Rounds repeat the whole block. Rest between rounds is used when you pick more than one.
              </p>
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
              <div className="grid grid-cols-2 gap-2" data-bike-round-picks>
                <PickButton field="rounds" label="Rounds" value={rounds} onOpen={setPicker} />
                <PickButton field="between" label="Rest between" value={between} onOpen={setPicker} />
              </div>
              <p className="text-xs text-muted">Rounds repeat whichever workout you tap. One round runs it once.</p>
              {BIKE_CHOICES.map((workout) => {
                const selected = choice?.id === workout.id;
                return (
                  <button
                    data-testid={`chrome-bike-choice-${workout.id}`}
                    key={workout.id}
                    type="button"
                    data-bike-workout={workout.id}
                    aria-pressed={selected}
                    onClick={() => applyCatalog(workout)}
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
                onClick={openCustom}
                className={`block w-full rounded-2xl border px-4 py-3 text-left ${
                  choice?.id === "custom" ? "border-accent bg-card" : "border-line bg-card"
                }`}
              >
                <span className="font-display block text-lg uppercase leading-tight tracking-wide">Custom</span>
                <span className="mt-1 block text-sm text-muted">
                  Set sprint, rest, sprints, and how many rounds.
                </span>
              </button>
            </div>
          )}
        </SheetFrame>
      ) : null}
      {picker ? (
        <PickerSheet
          field={picker}
          value={pickerValue}
          onSelect={selectPicker}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </>
  );
}
