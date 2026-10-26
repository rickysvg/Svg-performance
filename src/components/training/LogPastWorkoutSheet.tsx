"use client";

import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  deleteBackfillAction,
  loadBackfillEdit,
  loadBackfillPreview,
  saveBackfillAction,
  updateBackfillAction,
  type BackfillFormState,
} from "@/app/actions/backfill";
import { IntervalStructureFields, type IntervalFieldPreset } from "@/components/training/IntervalStructureFields";
import { useSheetDismiss } from "@/components/useSheetDismiss";
import type { BackfillKind } from "@/lib/backfill-rules";
import { backfillDayOptions } from "@/lib/backfill-rules";
import type { BackfillFormSeed, BackfillPreview } from "@/lib/backfill-workout";
import { decodeSeedInterval } from "@/lib/interval-decode";
import {
  formatIntervalClock,
  formatIntervalShorthand,
  formatSessionSummary,
  intervalClockKind,
  INTERVAL_SESSION_MAX_SECONDS,
  shorthandLineState,
  type IntervalStructure,
} from "@/lib/interval-shorthand";
import { intervalTotals, type IntervalTotalType } from "@/lib/interval-totals";
import { APP_TIMEZONE } from "@/lib/timezone";

type ExerciseRow = {
  name: string;
  sets: number;
  done: number;
  reps: string;
  logMode: string;
  prescriptionKey?: string;
  setNotes?: string;
};

type Preview = BackfillPreview;

type LogEntry = "calendar" | "train" | "week" | "history" | "home" | "edit" | "delete";

const ROUND_KINDS = ["bike", "bag", "pads", "sparring", "grappling"] as const;
type RoundKind = (typeof ROUND_KINDS)[number];

const CHIP_KINDS: { id: BackfillKind; label: string }[] = [
  { id: "bike", label: "Bike" },
  { id: "bag", label: "Bag" },
  { id: "pads", label: "Pads" },
  { id: "sparring", label: "Sparring" },
  { id: "grappling", label: "Grappling" },
  { id: "shadow", label: "Shadow" },
  { id: "saved", label: "My Workout" },
  { id: "custom", label: "Custom" },
  { id: "free", label: "Quick" },
];

const PRESETS: IntervalFieldPreset[] = [
  {
    id: "tabata",
    label: "Tabata 20/10×8",
    structure: { sets: 1, rounds: 8, workSeconds: 20, restSeconds: 10, setRestSeconds: 60 },
  },
  {
    id: "fifteens",
    label: "15/15×8",
    structure: { sets: 1, rounds: 8, workSeconds: 15, restSeconds: 15, setRestSeconds: 60 },
  },
  {
    id: "thirties",
    label: "30/30×10",
    structure: { sets: 1, rounds: 10, workSeconds: 30, restSeconds: 30, setRestSeconds: 60 },
  },
  {
    id: "boxing",
    label: "3-min rounds with 1:00 rest",
    structure: { sets: 1, rounds: 5, workSeconds: 180, restSeconds: 60, setRestSeconds: 60 },
  },
];

const textClass = "mt-1 w-full rounded-2xl border border-line bg-black px-3 py-2 text-base text-white";
const numberClass =
  "mt-1 w-[4.5rem] rounded-2xl border border-line bg-black px-2 py-2 text-center text-base text-white";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}

function clock(seconds: number) {
  return formatIntervalClock(seconds);
}

function isRoundKind(kind: string): kind is RoundKind {
  return (ROUND_KINDS as readonly string[]).includes(kind);
}

function isStructureKind(kind: string): kind is RoundKind {
  return isRoundKind(kind);
}

/** The assault-bike case members backfill most often: 2 sets × 8 rounds @ 15s/15s. */
export const ASSAULT_2X8_STRUCTURE: IntervalStructure = {
  sets: 2,
  rounds: 8,
  workSeconds: 15,
  restSeconds: 15,
  setRestSeconds: 60,
};

const ASSAULT_2X8_PRESET: IntervalFieldPreset = {
  id: "assault-2x8",
  label: "2×8 @ 15/15",
  structure: ASSAULT_2X8_STRUCTURE,
};

function sameStructure(left: IntervalStructure, right: IntervalStructure) {
  return (
    left.sets === right.sets &&
    left.rounds === right.rounds &&
    left.workSeconds === right.workSeconds &&
    left.restSeconds === right.restSeconds &&
    left.setRestSeconds === right.setRestSeconds
  );
}

/**
 * Taps once the day is already on screen.
 * A 2×8 plan, or a day with no plan, is open + Save. The bike default is that ride.
 * A different structure is open + the 2×8 preset + Save.
 * A non-bike plan is open + Bike + Save, because Bike applies the 2×8 default.
 * When that day still has a different bike target, the preset is a fourth tap.
 * History opens on yesterday. Each step further back is one more tap.
 */
export function bikeBackfillTapCount(input: {
  planIsAssault2x8: boolean;
  mustPickBike: boolean;
  bikeTargetNeedsPreset?: boolean;
  historyDaySteps?: number;
}) {
  const steps = Math.max(0, Math.round(input.historyDaySteps ?? 0));
  if (input.planIsAssault2x8) return 2 + steps;
  if (input.mustPickBike && input.bikeTargetNeedsPreset) return 4 + steps;
  return 3 + steps;
}

function defaultStructure(kind: string, _bagRounds: number): IntervalStructure {
  if (kind === "bag") return { sets: 1, rounds: 5, workSeconds: 180, restSeconds: 60, setRestSeconds: 60 };
  if (kind === "pads") return { sets: 1, rounds: 5, workSeconds: 180, restSeconds: 60, setRestSeconds: 60 };
  if (kind === "sparring") return { sets: 1, rounds: 3, workSeconds: 180, restSeconds: 60, setRestSeconds: 60 };
  if (kind === "grappling") return { sets: 1, rounds: 5, workSeconds: 300, restSeconds: 60, setRestSeconds: 60 };
  if (kind === "shadow") return { sets: 1, rounds: 2, workSeconds: 180, restSeconds: 60, setRestSeconds: 0 };
  if (kind === "bike") return { ...ASSAULT_2X8_STRUCTURE };
  return { sets: 1, rounds: 8, workSeconds: 20, restSeconds: 10, setRestSeconds: 60 };
}

function plannedKind(preview: Preview | null): BackfillKind | null {
  if (!preview) return null;
  for (const type of ROUND_KINDS) {
    if (preview.roundTargets[type]) return type;
  }
  if (preview.programs.length > 0) return "program";
  return null;
}

function structureFor(kind: string, preview: Preview | null): IntervalStructure {
  if (isRoundKind(kind)) {
    const target = preview?.roundTargets[kind];
    if (target) {
      return {
        sets: Math.max(1, target.sets),
        rounds: Math.max(1, target.rounds),
        workSeconds: Math.max(5, target.workSeconds),
        restSeconds: Math.max(0, target.restSeconds),
        setRestSeconds: Math.max(0, target.setRestSeconds),
      };
    }
  }
  const lastKey = kind === "shadow" || isRoundKind(kind) ? kind : null;
  const last = lastKey ? preview?.lastUsed[lastKey] : undefined;
  if (last) {
    return {
      sets: Math.max(1, last.sets),
      rounds: Math.max(1, last.rounds),
      workSeconds: Math.max(5, last.workSeconds),
      restSeconds: Math.max(0, last.restSeconds),
      setRestSeconds: Math.max(0, last.setRestSeconds),
    };
  }
  return defaultStructure(kind, preview?.bagRounds ?? 5);
}

/**
 * A preview that returns after the member already picked Bike or Bag must keep
 * that pick. Otherwise the first tap after a day change is overwritten.
 */
export function chipAfterDayPreview<T extends string>(picked: T | null, hasPlan: boolean): T | "plan" | "bike" {
  if (picked) return picked;
  return hasPlan ? "plan" : "bike";
}

/** A Bike or Bag draft stays put when the member only changes the day. */
export function keepIntervalDraftOnDayChange(picked: string | null) {
  return picked != null && picked !== "plan";
}

function planHint(preview: Preview, kind: BackfillKind | null) {
  if (!kind) return "";
  if (kind === "program") {
    const title = preview.programs[0]?.title;
    return title ? `Plan: ${title}` : "";
  }
  if (!isRoundKind(kind)) return "";
  const target = preview.roundTargets[kind];
  if (!target) return "";
  const names: Record<RoundKind, string> = {
    bike: "Bike",
    bag: "Bag",
    pads: "Pads",
    sparring: "Sparring",
    grappling: "Grappling",
  };
  const work = target.workSeconds < 60 ? String(target.workSeconds) : clock(target.workSeconds);
  const rest = target.restSeconds < 60 ? String(target.restSeconds) : clock(target.restSeconds);
  return `Plan: ${names[kind]} ${work}/${rest}`;
}

function startingDay(entry: LogEntry, initialDayKey: string, seedDay: string | undefined, days: { key: string }[]) {
  const wanted = seedDay || initialDayKey;
  const match = days.find((day) => day.key === wanted);
  if (match) return match.key;
  if (entry === "history") return days[1]?.key ?? days[0]?.key ?? "";
  return days[0]?.key ?? "";
}

export function LogPastWorkoutButton({
  dayKey = "",
  entry,
  label,
  sessionId,
  compact = false,
  fullWidth = false,
  timeZone = APP_TIMEZONE,
  seed,
  defaultOpen = false,
  initialPreview = null,
}: {
  dayKey?: string;
  entry: LogEntry;
  label: string;
  sessionId?: string;
  compact?: boolean;
  fullWidth?: boolean;
  timeZone?: string;
  seed?: BackfillFormSeed;
  /** Tests open the dialog on the first render. Members open it from the button. */
  defaultOpen?: boolean;
  /** SSR tests paint a loaded day without waiting for the preview request. */
  initialPreview?: Preview | null;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const testId =
    entry === "history"
      ? "log-past-workout-history"
      : entry === "edit"
        ? "log-past-workout-edit"
        : entry === "delete"
          ? "log-past-workout-delete"
          : `log-past-workout-${entry}`;
  return (
    <>
      <button
        type="button"
        data-testid={testId}
        data-workout-id={sessionId}
        data-log-past-entry={entry}
        onClick={() => setOpen(true)}
        className={
          compact
            ? `touch-target inline-flex min-h-11 items-center rounded-full border border-[#CBF805]/50 px-3 text-sm font-semibold text-[#CBF805] ${fullWidth ? "w-full justify-center" : ""}`
            : `touch-target inline-flex min-h-11 items-center justify-center rounded-full bg-[#CBF805] px-4 text-sm font-semibold text-black ${fullWidth ? "w-full" : ""}`
        }
      >
        {label}
      </button>
      {open ? (
        <LogPastWorkoutSheet
          initialDayKey={dayKey || seed?.dayKey || ""}
          entry={entry}
          sessionId={sessionId}
          mode={entry === "delete" ? "delete" : sessionId ? "edit" : "create"}
          timeZone={timeZone}
          seed={seed}
          initialPreview={initialPreview}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function LogPastWorkoutSheet({
  initialDayKey,
  entry,
  sessionId,
  mode,
  timeZone,
  seed,
  initialPreview,
  onClose,
}: {
  initialDayKey: string;
  entry: LogEntry;
  sessionId?: string;
  mode: "create" | "edit" | "delete";
  timeZone: string;
  seed?: BackfillFormSeed;
  initialPreview: Preview | null;
  onClose: () => void;
}) {
  const titleId = useId();
  useSheetDismiss(onClose);
  const seededDays = initialPreview?.days ?? backfillDayOptions(new Date(), timeZone);
  const [dayKey, setDayKey] = useState(() => startingDay(entry, initialDayKey, seed?.dayKey, seededDays));
  const [dayOptions, setDayOptions] = useState(seededDays);
  const [preview, setPreview] = useState<Preview | null>(initialPreview);
  const [editTitle, setEditTitle] = useState(seed?.title ?? "");
  const [notes, setNotes] = useState(seed?.notes ?? "");
  const [rpe, setRpe] = useState(seed?.sessionRpe != null ? String(seed.sessionRpe) : "");
  const [loadError, setLoadError] = useState("");
  const seededInterval = seed ? decodeSeedInterval(seed.exercises) : null;
  const openingPlan = plannedKind(initialPreview);
  const [chip, setChip] = useState<BackfillKind | "plan">(openingPlan ? "plan" : "bike");
  const openingKind = openingPlan ?? "bike";
  const openingStructure: IntervalStructure = seededInterval
    ? {
        sets: seededInterval.sets,
        rounds: seededInterval.rounds,
        workSeconds: seededInterval.workSeconds,
        restSeconds: seededInterval.restSeconds,
        setRestSeconds: seededInterval.setRestSeconds,
      }
    : structureFor(openingKind, initialPreview);
  const [structure, setStructure] = useState<IntervalStructure>(openingStructure);
  const [shorthand, setShorthand] = useState(formatIntervalShorthand(openingStructure));
  const [draft, setDraft] = useState(shorthand);
  const [trackedShorthand, setTrackedShorthand] = useState(shorthand);
  if (shorthand !== trackedShorthand) {
    setTrackedShorthand(shorthand);
    setDraft(shorthand);
  }
  const [done, setDone] = useState(seededInterval ? seededInterval.done : openingStructure.sets * openingStructure.rounds);
  const [editingInterval, setEditingInterval] = useState(Boolean(seededInterval));
  const [intervalKind, setIntervalKind] = useState<RoundKind>(seededInterval?.kind ?? "bike");
  const [rows, setRows] = useState<ExerciseRow[]>(() => (seed?.exercises ?? []).map(toRow));
  const [programId, setProgramId] = useState(initialPreview?.programs[0]?.programDayId ?? "");
  const [savedId, setSavedId] = useState(initialPreview?.saved[0]?.id ?? "");
  const [confirming, setConfirming] = useState(false);
  const [moreOpen, setMoreOpen] = useState(mode === "edit");
  const [moreMounted, setMoreMounted] = useState(mode === "edit");
  const [minutes, setMinutes] = useState("30");
  const [shadowWork, setShadowWork] = useState<[number, number]>([180, 180]);
  const [shadowRest, setShadowRest] = useState<[number, number]>([60, 60]);
  const [shadowWeight, setShadowWeight] = useState(initialPreview?.shadowWeight ? String(initialPreview.shadowWeight) : "");
  const seeded = Boolean(seed);
  const previewRequest = mode === "create" && !initialPreview ? dayKey : null;
  const [trackedPreview, setTrackedPreview] = useState(previewRequest);
  if (previewRequest !== trackedPreview) {
    setTrackedPreview(previewRequest);
    if (previewRequest !== null) setLoadError("");
  }
  const action = mode === "edit" ? updateBackfillAction : mode === "delete" ? deleteBackfillAction : saveBackfillAction;
  const [state, formAction, pending] = useActionState<BackfillFormState, FormData>(action, {});

  const kind: BackfillKind = chip === "plan" ? (plannedKind(preview) ?? "bike") : chip;
  const chipPick = useRef<{ dayKey: string; chip: BackfillKind | "plan" | null }>({ dayKey, chip: null });

  function selectDay(nextKey: string) {
    chipPick.current = { dayKey: nextKey, chip };
    setDayKey(nextKey);
  }

  function applyKind(nextChip: BackfillKind | "plan", loaded: Preview | null) {
    const nextKind = nextChip === "plan" ? (plannedKind(loaded) ?? "bike") : nextChip;
    chipPick.current = { dayKey, chip: nextChip };
    setChip(nextChip);
    if (loaded && (nextKind === "program" || nextKind === "saved" || nextKind === "custom")) {
      setRows(rowsFor(nextKind, loaded, programId, savedId));
    }
    if (isStructureKind(nextKind) || nextKind === "shadow") {
      const next = structureFor(nextKind, loaded);
      setStructure(next);
      setShorthand(formatIntervalShorthand(next));
      setDone(next.sets * next.rounds);
    }
  }

  useEffect(() => {
    if (mode === "create" || !sessionId) return;
    let cancelled = false;
    loadBackfillEdit(sessionId)
      .then((loaded) => {
        if (cancelled) return;
        setDayOptions(loaded.days);
        setDayKey(loaded.dayKey);
        if (!seeded) {
          setEditTitle(loaded.title);
          setNotes(loaded.notes);
          setRpe(loaded.sessionRpe != null ? String(loaded.sessionRpe) : "");
          setRows(loaded.exercises.map((row) => ({ ...row, reps: row.reps ?? "" })));
        }
        if (loaded.structure) {
          const next = {
            sets: loaded.structure.sets,
            rounds: loaded.structure.rounds,
            workSeconds: loaded.structure.workSeconds,
            restSeconds: loaded.structure.restSeconds,
            setRestSeconds: loaded.structure.setRestSeconds,
          };
          setEditingInterval(true);
          setIntervalKind(loaded.structure.kind);
          setStructure(next);
          setShorthand(formatIntervalShorthand(next));
          setDone(loaded.structure.done);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError("That workout could not be opened.");
      });
    return () => {
      cancelled = true;
    };
  }, [mode, seeded, sessionId]);

  useEffect(() => {
    if (mode !== "create" || initialPreview) return;
    let cancelled = false;
    const requestedDay = dayKey;
    loadBackfillPreview(requestedDay)
      .then((loaded) => {
        if (cancelled) return;
        setPreview(loaded);
        setDayOptions(loaded.days);
        if (!requestedDay && loaded.dayKey) setDayKey(loaded.dayKey);
        const planned = plannedKind(loaded);
        const picked = chipPick.current.dayKey === requestedDay ? chipPick.current.chip : null;
        const nextChip = chipAfterDayPreview(picked, planned != null);
        const nextKind = nextChip === "plan" ? (planned ?? "bike") : nextChip;
        const keepDraft = keepIntervalDraftOnDayChange(picked);
        setChip(nextChip);
        setProgramId(loaded.programs[0]?.programDayId ?? "");
        setSavedId(loaded.saved[0]?.id ?? "");
        if (!keepDraft) {
          setRows(rowsFor(nextKind, loaded, loaded.programs[0]?.programDayId ?? "", loaded.saved[0]?.id ?? ""));
          if (isStructureKind(nextKind) || nextKind === "shadow") {
            const next = structureFor(nextKind, loaded);
            setStructure(next);
            setShorthand(formatIntervalShorthand(next));
            setDone(next.sets * next.rounds);
          }
        }
        if (loaded.shadowWeight != null) setShadowWeight(String(loaded.shadowWeight));
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "That day is not available.");
      });
    return () => {
      cancelled = true;
    };
  }, [dayKey, initialPreview, mode]);

  function chooseProgram(id: string) {
    setProgramId(id);
    if (preview) setRows(rowsFor("program", preview, id, savedId));
  }

  function chooseSaved(id: string) {
    setSavedId(id);
    if (preview) setRows(rowsFor("saved", preview, programId, id));
  }

  function applyStructure(next: IntervalStructure, rewriteShorthand: boolean) {
    const previousTotal = structure.sets * structure.rounds;
    setStructure(next);
    if (rewriteShorthand) setShorthand(formatIntervalShorthand(next));
    const nextTotal = next.sets * next.rounds;
    setDone((current) => (current === previousTotal ? nextTotal : Math.min(current, nextTotal)));
  }

  function changeStructure(next: IntervalStructure) {
    applyStructure(next, true);
  }

  const days =
    dayOptions.some((day) => day.key === dayKey) || !dayKey
      ? dayOptions
      : [{ key: dayKey, label: dayKey }, ...dayOptions];
  const dayIndex = Math.max(0, days.findIndex((day) => day.key === dayKey));
  const todayKey = days[0]?.key ?? "";
  const loggingToday = mode === "create" && dayKey === todayKey;
  const heading =
    mode === "delete" ? "Delete past workout" : mode === "edit" ? "Edit past workout" : loggingToday ? "Log a workout" : "Log a past workout";
  const conflict = isStructureKind(kind) || kind === "shadow" ? [] : (state.conflict ?? []);
  const deleteTitle = editTitle.trim() || "this workout";
  const focus = kind === "bag" ? (preview?.roundTargets.bag?.focusRounds ?? []) : [];
  const totalType: IntervalTotalType = kind === "shadow" ? "shadow" : isRoundKind(kind) ? kind : "bike";
  const intervalType: IntervalTotalType = editingInterval || !isStructureKind(kind) ? intervalKind : kind;
  const showingInterval = (mode === "create" && isStructureKind(kind)) || editingInterval;
  const summary = formatSessionSummary(structure);
  const totals = intervalTotals(
    totalType,
    {
      sets: structure.sets,
      rounds: structure.rounds,
      workSeconds: structure.workSeconds,
      restSeconds: structure.restSeconds,
      setRestSeconds: structure.setRestSeconds,
      shadowRounds:
        kind === "shadow"
          ? [
              { workSeconds: shadowWork[0], restSeconds: shadowRest[0] },
              { workSeconds: shadowWork[1], restSeconds: shadowRest[1] },
            ]
          : undefined,
    },
    kind === "shadow" ? 2 : done,
  );
  const configuredSeconds = intervalTotals(
    showingInterval ? intervalType : totalType,
    {
      sets: structure.sets,
      rounds: structure.rounds,
      workSeconds: structure.workSeconds,
      restSeconds: structure.restSeconds,
      setRestSeconds: structure.setRestSeconds,
    },
    Math.max(1, structure.sets * structure.rounds),
  ).totalSeconds;
  const overDuration = showingInterval && configuredSeconds > INTERVAL_SESSION_MAX_SECONDS;
  const needsOneSet = showingInterval && done < 1;
  const lineState = showingInterval
    ? shorthandLineState(draft, structure, intervalClockKind(intervalType))
    : { error: "", matches: true, blocked: false };
  const lineBlocked = lineState.blocked && !lineState.matches;
  const waitingForPreview = mode === "create" && !preview;
  const saveText = pending
    ? "Saving…"
    : mode === "edit"
      ? "Save changes"
      : lineBlocked
        ? "Save"
        : isStructureKind(kind) || kind === "shadow"
          ? overDuration
            ? `Save · ${kind === "shadow" ? "Shadow" : summary}`
            : `Save · ${kind === "shadow" ? "Shadow" : summary} · ${clock(totals.totalSeconds)}`
          : "Save workout";
  const last = isRoundKind(kind) || kind === "shadow" ? preview?.lastUsed[kind] : undefined;
  const presets = [
    ...(kind === "bike" ? [ASSAULT_2X8_PRESET] : []),
    ...(last
      ? [{ id: "last", label: last.label, structure: structureFor(kind, { ...preview!, roundTargets: {} }) }]
      : []),
    ...PRESETS.filter((preset) => !(kind === "bike" && sameStructure(preset.structure, ASSAULT_2X8_STRUCTURE))),
  ];
  const bareShadow = preview?.weightAccess === "none";

  const sheet = (
    <div
      className="fixed inset-0 z-[70] flex items-end bg-black/70"
      role="presentation"
      data-testid="log-past-workout-dismiss"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="log-past-workout-sheet"
        className="hc-carbon max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-black px-4 pt-3 text-white"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="font-display text-xl uppercase tracking-wide text-[#CBF805]">
            {heading}
          </h2>
          <button type="button" onClick={onClose} className="touch-target text-2xl leading-none" aria-label="Close">
            ×
          </button>
        </div>
        {loadError ? <p className="mt-3 text-sm text-signal">{loadError}</p> : null}
        {state.error ? (
          <p role="alert" data-testid="log-past-workout-error" className="mt-3 text-sm text-signal">
            {state.error}
          </p>
        ) : null}
        {mode === "delete" ? (
          <form action={formAction} className="mt-4 space-y-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <input type="hidden" name="sessionId" value={sessionId ?? ""} />
            <input type="hidden" name="confirm" value="yes" />
            <p className="text-sm">Delete {deleteTitle}? It comes off the calendar, history, and streak.</p>
            <button
              type="submit"
              data-testid="log-past-workout-delete-confirm"
              disabled={pending}
              className="touch-target h-12 w-full rounded-full bg-danger text-sm font-semibold text-white"
            >
              {pending ? "Deleting…" : "Delete workout"}
            </button>
          </form>
        ) : (
          <form action={formAction} className="mt-4 space-y-4">
            {sessionId ? <input type="hidden" name="sessionId" value={sessionId} /> : null}
            <input type="hidden" name="confirm" value={mode === "create" || confirming ? "yes" : ""} />
            <input type="hidden" name="dayKey" data-testid="log-past-workout-date" value={dayKey} />
            {mode === "create" ? (
              <div className="flex items-center gap-2">
                <div className="inline-flex h-12 shrink-0 items-center gap-1 rounded-full border border-line bg-black px-1">
                  <button
                    type="button"
                    aria-label="Older day"
                    disabled={!days[dayIndex + 1]}
                    onClick={() => {
                      const older = days[dayIndex + 1];
                      if (older) selectDay(older.key);
                    }}
                    className="flex size-11 items-center justify-center rounded-full text-lg disabled:opacity-30"
                  >
                    ‹
                  </button>
                  <span className="min-w-[6.5rem] text-center text-sm">{days[dayIndex]?.label ?? dayKey}</span>
                  <button
                    type="button"
                    aria-label="Newer day"
                    disabled={dayIndex <= 0}
                    onClick={() => {
                      const newer = days[dayIndex - 1];
                      if (newer) selectDay(newer.key);
                    }}
                    className="flex size-11 items-center justify-center rounded-full text-lg disabled:opacity-30"
                  >
                    ›
                  </button>
                </div>
                <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1" data-testid="log-past-workout-types">
                {plannedKind(preview) ? (
                  <TypeChip
                    id="plan"
                    label="Plan"
                    pressed={chip === "plan"}
                    onClick={() => applyKind("plan", preview)}
                  />
                ) : null}
                {CHIP_KINDS.map((item) => (
                  <TypeChip
                    key={item.id}
                    id={item.id}
                    label={item.label}
                    pressed={chip === item.id}
                    onClick={() => applyKind(item.id, preview)}
                  />
                ))}
                </div>
              </div>
            ) : null}
            {mode === "create" ? (
              <input type="hidden" name="kind" value={kind} />
            ) : editingInterval ? (
              <input type="hidden" name="kind" value={intervalKind} />
            ) : (
              <input type="hidden" name="kind" value="custom" />
            )}
            {mode === "create" && chip === "plan" && preview ? (
              <p className="text-sm text-[#CBF805]" data-testid="log-past-workout-plan">
                {planHint(preview, plannedKind(preview))}
              </p>
            ) : null}
            {mode === "create" && kind === "program" ? (
              preview && preview.programs.length > 0 ? (
                <Field label="Session">
                  <select
                    name="programDayId"
                    data-testid="log-past-workout-program"
                    value={programId}
                    onChange={(event) => chooseProgram(event.target.value)}
                    className={textClass}
                  >
                    {preview.programs.map((program) => (
                      <option key={program.programDayId} value={program.programDayId}>
                        {program.title}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <p className="text-sm text-white/70">No program session on this day. Pick another type.</p>
              )
            ) : null}
            {mode === "create" && kind === "saved" ? (
              preview && preview.saved.length > 0 ? (
                <Field label="My Workout">
                  <select
                    name="savedWorkoutId"
                    data-testid="log-past-workout-saved"
                    value={savedId}
                    onChange={(event) => chooseSaved(event.target.value)}
                    className={textClass}
                  >
                    {preview.saved.map((workout) => (
                      <option key={workout.id} value={workout.id}>
                        {workout.name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <p className="text-sm text-white/70">No saved workouts yet.</p>
              )
            ) : null}
            {mode === "edit" ? (
              <Field label="Name">
                <input
                  name="title"
                  data-testid="log-past-workout-title"
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  className={textClass}
                />
              </Field>
            ) : null}
            {(mode === "create" && isStructureKind(kind)) || editingInterval ? (
              <>
                {editingInterval ? <input type="hidden" name="intervalEdit" value="yes" /> : null}
                <IntervalStructureFields
                  shorthand={shorthand}
                  structure={structure}
                  done={done}
                  totalType={editingInterval || !isStructureKind(kind) ? intervalKind : kind}
                  presets={mode === "create" ? presets : []}
                  onShorthandCommit={setShorthand}
                  onStructure={changeStructure}
                  onLiveStructure={(next) => applyStructure(next, false)}
                  onDraft={setDraft}
                  onDone={setDone}
                />
                <input type="hidden" name="roundsPerSet" value={structure.rounds} />
                <input type="hidden" name="repeatRounds" value={structure.sets} />
                <input type="hidden" name="workSeconds" value={structure.workSeconds} />
                <input type="hidden" name="restSeconds" value={structure.restSeconds} />
                <input
                  type="hidden"
                  name="restBetweenRoundsSeconds"
                  value={structure.sets > 1 ? structure.setRestSeconds : 0}
                />
                <input type="hidden" name="doneRounds" value={done} />
                <input type="hidden" name="plannedRounds" value={structure.rounds * structure.sets} />
                {kind === "bag" ? <input type="hidden" name="focusNotes" value={focus.join("\n")} /> : null}
                {focus.length > 0 ? (
                  <ul className="space-y-1 text-sm text-white/80" data-testid="log-past-workout-focus">
                    {focus.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : null}
            {mode === "create" && kind === "shadow" ? (
              <div className="space-y-3" data-testid="log-past-workout-shadow">
                <input type="hidden" name="shadowCount" value={2} />
                {([0, 1] as const).map((index) => (
                  <div key={index} className="grid grid-cols-[1fr_4.5rem_4.5rem] items-end gap-2">
                    <p className="text-sm text-muted">{index === 0 ? "Empty hands" : bareShadow ? "Fists, no weights" : "Hand weights"}</p>
                    <Field label="Work s">
                      <input
                        name={`shadowWork_${index}`}
                        inputMode="numeric"
                        value={shadowWork[index]}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          setShadowWork((current) => {
                            const next: [number, number] = [...current];
                            next[index] = Number.isFinite(value) ? value : 0;
                            return next;
                          });
                        }}
                        className={numberClass}
                      />
                    </Field>
                    <Field label="Rest s">
                      <input
                        name={`shadowRest_${index}`}
                        inputMode="numeric"
                        value={shadowRest[index]}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          setShadowRest((current) => {
                            const next: [number, number] = [...current];
                            next[index] = Number.isFinite(value) ? value : 0;
                            return next;
                          });
                        }}
                        className={numberClass}
                      />
                    </Field>
                  </div>
                ))}
                {bareShadow ? null : (
                  <Field label={`Weight (${preview?.units ?? "lb"})`}>
                    <input
                      name="shadowWeight_1"
                      inputMode="decimal"
                      value={shadowWeight}
                      onChange={(event) => setShadowWeight(event.target.value)}
                      className={numberClass}
                    />
                  </Field>
                )}
                <input type="hidden" name="shadowWeight_0" value="" />
              </div>
            ) : null}
            {mode === "create" && kind === "free" ? (
              <Field label="Minutes">
                <input
                  name="minutes"
                  data-testid="log-past-workout-minutes"
                  inputMode="numeric"
                  value={minutes}
                  onChange={(event) => setMinutes(event.target.value)}
                  className={numberClass}
                />
              </Field>
            ) : null}
            {rows.length > 0 && !editingInterval && (mode === "edit" || kind === "program" || kind === "saved" || kind === "custom") ? (
              <div className="space-y-2" data-testid="log-past-workout-exercises">
                <input type="hidden" name="exerciseCount" value={rows.length} />
                {rows.map((row, index) => (
                  <div key={`${row.name}-${index}`} className="grid grid-cols-[1fr_4.5rem_4.5rem] items-end gap-2">
                    <Field label={index === 0 ? "Exercise" : ""}>
                      <input
                        name={`exerciseName_${index}`}
                        value={row.name}
                        onChange={(event) => updateRow(index, { name: event.target.value })}
                        readOnly={mode === "create" && kind !== "custom"}
                        className={textClass}
                      />
                    </Field>
                    <Field label={index === 0 ? "Sets" : ""}>
                      <input
                        name={`exerciseSets_${index}`}
                        value={row.sets}
                        inputMode="numeric"
                        onChange={(event) => updateRow(index, { sets: Number(event.target.value) })}
                        readOnly={mode === "create" && kind !== "custom"}
                        className={numberClass}
                      />
                    </Field>
                    <Field label={index === 0 ? "Done" : ""}>
                      <input
                        name={`exerciseDone_${index}`}
                        data-testid={`log-past-workout-done-${index}`}
                        value={row.done}
                        inputMode="numeric"
                        onChange={(event) => updateRow(index, { done: Number(event.target.value) })}
                        className={numberClass}
                      />
                    </Field>
                    <input type="hidden" name={`exerciseReps_${index}`} value={row.reps} />
                    <input type="hidden" name={`exerciseMode_${index}`} value={row.logMode} />
                    <input type="hidden" name={`exerciseKey_${index}`} value={row.prescriptionKey ?? ""} />
                    <input type="hidden" name={`exerciseNotes_${index}`} value={row.setNotes ?? ""} />
                  </div>
                ))}
                {mode === "create" && kind === "custom" && rows.length < 8 ? (
                  <button
                    type="button"
                    data-testid="log-past-workout-add-exercise"
                    onClick={() => setRows((current) => [...current, { name: "", sets: 3, done: 3, reps: "8", logMode: "load_reps" }])}
                    className="text-sm font-semibold text-[#CBF805]"
                  >
                    + Add exercise
                  </button>
                ) : null}
              </div>
            ) : (
              <input type="hidden" name="exerciseCount" value={0} />
            )}
            {mode === "edit" ? (
              <>
                <Field label="RPE, optional">
                  <input
                    name="rpe"
                    data-testid="log-past-workout-rpe"
                    inputMode="numeric"
                    value={rpe}
                    onChange={(event) => setRpe(event.target.value)}
                    placeholder="1–10"
                    className={numberClass}
                  />
                </Field>
                <Field label="Notes">
                  <textarea
                    name="notes"
                    data-testid="log-past-workout-notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={2}
                    className={textClass}
                  />
                </Field>
              </>
            ) : null}
            {mode === "create" ? (
              <div>
                <button
                  type="button"
                  data-testid="log-past-workout-more"
                  onClick={() => {
                    setMoreMounted(true);
                    setMoreOpen((open) => !open);
                  }}
                  className="text-sm font-semibold text-[#CBF805]"
                >
                  + More
                </button>
                {moreMounted ? (
                  <div className={moreOpen ? "mt-3 space-y-3" : "hidden"} data-testid="log-past-workout-more-fields">
                    <Field label="Name">
                      <input name="title" data-testid="log-past-workout-title" className={textClass} placeholder="Workout" />
                    </Field>
                    <div className="grid grid-cols-[5.5rem_5.5rem_4rem] gap-2">
                      {kind === "bike" ? (
                        <>
                          <Field label="Calories">
                            <input name="calories" data-testid="log-past-workout-calories" inputMode="numeric" className={numberClass} />
                          </Field>
                          <Field label="Distance">
                            <input name="distance" data-testid="log-past-workout-distance" inputMode="decimal" className={numberClass} />
                          </Field>
                        </>
                      ) : null}
                      <Field label="RPE">
                        <input name="rpe" data-testid="log-past-workout-rpe" inputMode="numeric" placeholder="1–10" className={numberClass} />
                      </Field>
                    </div>
                    <Field label="Notes">
                      <textarea name="notes" data-testid="log-past-workout-notes" rows={2} className={textClass} />
                    </Field>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-black via-black px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
              {needsOneSet ? (
                <p role="alert" data-testid="interval-done-required" className="mb-2 text-sm text-[#FF3B3B]">
                  Log at least one set, then save.
                </p>
              ) : null}
              {conflict.length > 0 ? (
                <div data-testid="log-past-workout-conflict" className="rounded-2xl border border-[#CBF805]/40 bg-black px-3 py-3">
                  <p className="text-sm">
                    This day already has {conflict.map((row) => row.title).join(", ")}. Add another session, or replace it.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="submit"
                      name="resolution"
                      value="extra"
                      data-testid="log-past-workout-extra"
                      className="touch-target h-12 rounded-full border border-[#CBF805] text-sm font-semibold text-[#CBF805]"
                    >
                      Add as extra
                    </button>
                    <button
                      type="submit"
                      name="resolution"
                      value="replace"
                      data-testid="log-past-workout-replace"
                      className="font-display h-12 rounded-full bg-[#CBF805] text-sm uppercase text-black"
                    >
                      Replace it
                    </button>
                  </div>
                </div>
              ) : null}
              {conflict.length === 0 && mode === "edit" && !confirming ? (
                <button
                  type="button"
                  data-testid="log-past-workout-confirm"
                  onClick={() => setConfirming(true)}
                  disabled={overDuration || needsOneSet || lineBlocked}
                  className="font-display h-12 w-full rounded-full bg-[#CBF805] text-sm uppercase text-black disabled:opacity-60"
                >
                  Review changes
                </button>
              ) : null}
              {conflict.length === 0 && (mode === "create" || confirming) ? (
                <button
                  type="submit"
                  data-testid="log-past-workout-save"
                  disabled={pending || overDuration || needsOneSet || lineBlocked || waitingForPreview}
                  className="font-display h-12 w-full rounded-full bg-[#CBF805] text-sm uppercase text-black disabled:opacity-60"
                >
                  {saveText}
                </button>
              ) : null}
              {mode === "edit" && confirming ? (
                <p className="mt-2 text-sm text-white/70">This updates the calendar, history, and streak.</p>
              ) : null}
            </div>
          </form>
        )}
      </div>
    </div>
  );

  function updateRow(index: number, patch: Partial<ExerciseRow>) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  if (typeof document === "undefined") return sheet;
  return createPortal(sheet, document.body);
}

function TypeChip({
  id,
  label,
  pressed,
  onClick,
}: {
  id: string;
  label: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={`log-past-workout-kind-${id}`}
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex h-11 shrink-0 items-center rounded-full px-3 text-sm ${
        pressed ? "bg-[#CBF805] text-black" : "border border-line bg-black text-white"
      }`}
    >
      {label}
    </button>
  );
}

function rowsFor(kind: BackfillKind, preview: Preview, programId: string, savedId: string): ExerciseRow[] {
  if (kind === "program") {
    const program = preview.programs.find((row) => row.programDayId === programId) ?? preview.programs[0];
    return (program?.exercises ?? []).map(toRow);
  }
  if (kind === "saved") {
    const saved = preview.saved.find((row) => row.id === savedId) ?? preview.saved[0];
    return (saved?.exercises ?? []).map(toRow);
  }
  if (kind === "custom") {
    return [{ name: "", sets: 3, done: 3, reps: "8", logMode: "load_reps" }];
  }
  return [];
}

function toRow(exercise: {
  name: string;
  sets: number;
  done: number;
  reps?: string;
  logMode?: string;
  prescriptionKey?: string;
  setNotes?: string;
}): ExerciseRow {
  return {
    name: exercise.name,
    sets: exercise.sets,
    done: exercise.done,
    reps: exercise.reps ?? "",
    logMode: exercise.logMode ?? "",
    prescriptionKey: exercise.prescriptionKey ?? "",
    setNotes: exercise.setNotes ?? "",
  };
}
