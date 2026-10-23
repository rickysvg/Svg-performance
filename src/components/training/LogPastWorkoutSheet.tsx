"use client";

import { useActionState, useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  deleteBackfillAction,
  loadBackfillEdit,
  loadBackfillPreview,
  saveBackfillAction,
  updateBackfillAction,
  type BackfillFormState,
} from "@/app/actions/backfill";
import { useSheetDismiss } from "@/components/useSheetDismiss";
import type { BackfillKind } from "@/lib/backfill-rules";
import { BACKFILL_ROUND_MODES } from "@/lib/backfill-rules";

type ExerciseRow = {
  name: string;
  sets: number;
  done: number;
  reps: string;
  logMode: string;
};

type Preview = Awaited<ReturnType<typeof loadBackfillPreview>>;
type EditView = Awaited<ReturnType<typeof loadBackfillEdit>>;

const KINDS: { id: BackfillKind; label: string }[] = [
  { id: "program", label: "That day's session" },
  { id: "saved", label: "My Workout" },
  { id: "custom", label: "Custom workout" },
  { id: "bike", label: "Assault bike" },
  { id: "rounds", label: "Bag, pads, sparring" },
  { id: "free", label: "Quick entry" },
];

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}

const inputClass = "mt-1 w-full rounded-2xl border border-line bg-black px-3 py-2 text-white";

export function LogPastWorkoutButton({
  dayKey = "",
  entry,
  label,
  sessionId,
  compact = false,
}: {
  dayKey?: string;
  entry: "calendar" | "train" | "week" | "history" | "edit" | "delete";
  label: string;
  sessionId?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
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
            ? "touch-target inline-flex min-h-11 items-center rounded-full border border-[#CBF805]/50 px-3 text-sm font-semibold text-[#CBF805]"
            : "touch-target inline-flex min-h-11 items-center justify-center rounded-full bg-[#CBF805] px-4 text-sm font-semibold text-black"
        }
      >
        {label}
      </button>
      {open ? (
        <LogPastWorkoutSheet
          initialDayKey={dayKey}
          sessionId={sessionId}
          mode={entry === "delete" ? "delete" : sessionId ? "edit" : "create"}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function LogPastWorkoutSheet({
  initialDayKey,
  sessionId,
  mode,
  onClose,
}: {
  initialDayKey: string;
  sessionId?: string;
  mode: "create" | "edit" | "delete";
  onClose: () => void;
}) {
  const titleId = useId();
  useSheetDismiss(onClose);
  const [dayKey, setDayKey] = useState(initialDayKey);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [edit, setEdit] = useState<EditView | null>(null);
  const [loadError, setLoadError] = useState("");
  const [kind, setKind] = useState<BackfillKind>("free");
  const [rows, setRows] = useState<ExerciseRow[]>([]);
  const [programId, setProgramId] = useState("");
  const [savedId, setSavedId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const action = mode === "edit" ? updateBackfillAction : mode === "delete" ? deleteBackfillAction : saveBackfillAction;
  const [state, formAction, pending] = useActionState<BackfillFormState, FormData>(action, {});

  useEffect(() => {
    if (mode === "create" || !sessionId) return;
    let cancelled = false;
    loadBackfillEdit(sessionId)
      .then((loaded) => {
        if (cancelled) return;
        setEdit(loaded);
        setDayKey(loaded.dayKey);
        setRows(loaded.exercises.map((row) => ({ ...row, reps: row.reps ?? "" })));
      })
      .catch(() => {
        if (!cancelled) setLoadError("That workout could not be opened.");
      });
    return () => {
      cancelled = true;
    };
  }, [mode, sessionId]);

  useEffect(() => {
    if (mode !== "create") return;
    let cancelled = false;
    setLoadError("");
    loadBackfillPreview(dayKey)
      .then((loaded) => {
        if (cancelled) return;
        setPreview(loaded);
        if (!dayKey && loaded.dayKey) setDayKey(loaded.dayKey);
        const first = loaded.programs[0];
        const nextKind: BackfillKind = first ? "program" : loaded.saved[0] ? "saved" : "free";
        setKind(nextKind);
        setProgramId(first?.programDayId ?? "");
        setSavedId(loaded.saved[0]?.id ?? "");
        setRows(rowsFor(nextKind, loaded, first?.programDayId ?? "", loaded.saved[0]?.id ?? ""));
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "That day is not available.");
      });
    return () => {
      cancelled = true;
    };
  }, [dayKey, mode]);

  function chooseKind(next: BackfillKind) {
    setKind(next);
    if (preview) setRows(rowsFor(next, preview, programId, savedId));
  }

  function chooseProgram(id: string) {
    setProgramId(id);
    if (preview) setRows(rowsFor("program", preview, id, savedId));
  }

  function chooseSaved(id: string) {
    setSavedId(id);
    if (preview) setRows(rowsFor("saved", preview, programId, id));
  }

  const days = mode === "create" ? preview?.days ?? [] : edit?.days ?? [];
  const conflict = state.conflict ?? [];
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
        className="hc-carbon max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-black px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 text-white"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="font-display text-xl uppercase tracking-wide text-[#CBF805]">
            {mode === "delete" ? "Delete past workout" : mode === "edit" ? "Edit past workout" : "Log a past workout"}
          </h2>
          <button type="button" onClick={onClose} className="touch-target text-2xl leading-none" aria-label="Close">
            ×
          </button>
        </div>
        <p className="mt-1 text-sm text-white/70">
          Up to 30 days back. It lands on that day in history, the calendar, and your streak.
        </p>
        {loadError ? <p className="mt-3 text-sm text-signal">{loadError}</p> : null}
        {state.error ? (
          <p role="alert" data-testid="log-past-workout-error" className="mt-3 text-sm text-signal">
            {state.error}
          </p>
        ) : null}
        {mode === "delete" && edit ? (
          <form action={formAction} className="mt-4 space-y-3">
            <input type="hidden" name="sessionId" value={edit.id} />
            <input type="hidden" name="confirm" value="yes" />
            <p className="text-sm">
              Delete {edit.title}? It comes off the calendar, history, and streak.
            </p>
            <button
              type="submit"
              data-testid="log-past-workout-delete-confirm"
              disabled={pending}
              className="touch-target w-full rounded-full bg-danger text-sm font-semibold text-white"
            >
              {pending ? "Deleting…" : "Delete workout"}
            </button>
          </form>
        ) : null}
        {mode !== "delete" ? (
          <form action={formAction} className="mt-4 space-y-4">
            {sessionId ? <input type="hidden" name="sessionId" value={sessionId} /> : null}
            <input type="hidden" name="confirm" value={mode === "create" || confirming ? "yes" : ""} />
            <Field label="Day">
              <select
                name="dayKey"
                data-testid="log-past-workout-date"
                value={dayKey}
                onChange={(event) => setDayKey(event.target.value)}
                className={inputClass}
              >
                {days.map((day) => (
                  <option key={day.key} value={day.key}>
                    {day.label}
                  </option>
                ))}
              </select>
            </Field>
            {mode === "create" ? (
              <fieldset>
                <legend className="text-sm text-muted">Type</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {KINDS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      data-testid={`log-past-workout-kind-${item.id}`}
                      aria-pressed={kind === item.id}
                      onClick={() => chooseKind(item.id)}
                      className={`min-h-11 rounded-2xl px-2 text-left text-sm ${
                        kind === item.id ? "bg-[#CBF805] text-black" : "border border-line bg-black text-white"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <input type="hidden" name="kind" value={kind} />
              </fieldset>
            ) : (
              <input type="hidden" name="kind" value="custom" />
            )}
            {mode === "create" && kind === "program" ? (
              preview && preview.programs.length > 0 ? (
                <Field label="Session">
                  <select
                    name="programDayId"
                    data-testid="log-past-workout-program"
                    value={programId}
                    onChange={(event) => chooseProgram(event.target.value)}
                    className={inputClass}
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
                    className={inputClass}
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
            {mode === "create" && (kind === "custom" || kind === "free" || kind === "bike") ? (
              <Field label={kind === "free" ? "Type" : "Name"}>
                <input name="title" data-testid="log-past-workout-title" className={inputClass} placeholder={kind === "bike" ? "Assault bike" : "Workout"} />
              </Field>
            ) : (
              <Field label="Name">
                <input
                  name="title"
                  data-testid="log-past-workout-title"
                  defaultValue={edit?.title ?? preview?.programs.find((row) => row.programDayId === programId)?.title ?? ""}
                  className={inputClass}
                />
              </Field>
            )}
            {mode === "create" && kind === "rounds" ? (
              <Field label="Rounds">
                <select name="roundMode" data-testid="log-past-workout-round-mode" className={inputClass} defaultValue="bag">
                  {Object.entries(BACKFILL_ROUND_MODES).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            {mode === "create" && (kind === "bike" || kind === "free") ? (
              <Field label="Minutes">
                <input name="minutes" data-testid="log-past-workout-minutes" inputMode="numeric" defaultValue={kind === "bike" ? 20 : 30} className={inputClass} />
              </Field>
            ) : null}
            {mode === "create" && (kind === "bike" || kind === "rounds") ? (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Rounds">
                  <input name="plannedRounds" data-testid="log-past-workout-rounds" inputMode="numeric" defaultValue={kind === "rounds" ? 3 : 8} className={inputClass} />
                </Field>
                <Field label="Finished">
                  <input name="doneRounds" data-testid="log-past-workout-done-rounds" inputMode="numeric" defaultValue={kind === "rounds" ? 3 : 8} className={inputClass} />
                </Field>
              </div>
            ) : null}
            {mode === "create" && kind === "rounds" ? (
              <Field label="Seconds each round">
                <input name="workSeconds" inputMode="numeric" defaultValue={180} className={inputClass} />
              </Field>
            ) : null}
            {mode === "create" && kind === "bike" ? (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Calories, optional">
                  <input name="calories" data-testid="log-past-workout-calories" inputMode="numeric" className={inputClass} />
                </Field>
                <Field label="Distance, optional">
                  <input name="distance" data-testid="log-past-workout-distance" inputMode="decimal" className={inputClass} />
                </Field>
              </div>
            ) : null}
            {rows.length > 0 && (mode === "edit" || kind === "program" || kind === "saved" || kind === "custom") ? (
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
                        className={inputClass}
                      />
                    </Field>
                    <Field label={index === 0 ? "Sets" : ""}>
                      <input
                        name={`exerciseSets_${index}`}
                        value={row.sets}
                        inputMode="numeric"
                        onChange={(event) => updateRow(index, { sets: Number(event.target.value) })}
                        readOnly={mode === "create" && kind !== "custom"}
                        className={inputClass}
                      />
                    </Field>
                    <Field label={index === 0 ? "Done" : ""}>
                      <input
                        name={`exerciseDone_${index}`}
                        data-testid={`log-past-workout-done-${index}`}
                        value={row.done}
                        inputMode="numeric"
                        onChange={(event) => updateRow(index, { done: Number(event.target.value) })}
                        className={inputClass}
                      />
                    </Field>
                    <input type="hidden" name={`exerciseReps_${index}`} value={row.reps} />
                    <input type="hidden" name={`exerciseMode_${index}`} value={row.logMode} />
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
            <Field label="RPE, optional">
              <input name="rpe" data-testid="log-past-workout-rpe" inputMode="numeric" defaultValue={edit?.sessionRpe ?? ""} placeholder="1–10" className={inputClass} />
            </Field>
            <Field label="Notes">
              <textarea name="notes" data-testid="log-past-workout-notes" defaultValue={edit?.notes ?? ""} rows={2} className={inputClass} />
            </Field>
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
                    className="touch-target rounded-full border border-[#CBF805] text-sm font-semibold text-[#CBF805]"
                  >
                    Add as extra
                  </button>
                  <button
                    type="submit"
                    name="resolution"
                    value="replace"
                    data-testid="log-past-workout-replace"
                    className="touch-target rounded-full bg-[#CBF805] text-sm font-semibold text-black"
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
                className="touch-target w-full rounded-full bg-[#CBF805] text-sm font-semibold text-black"
              >
                Review changes
              </button>
            ) : null}
            {conflict.length === 0 && (mode === "create" || confirming) ? (
              <button
                type="submit"
                data-testid="log-past-workout-save"
                disabled={pending || (mode === "create" && !preview)}
                className="touch-target w-full rounded-full bg-[#CBF805] text-sm font-semibold text-black disabled:opacity-60"
              >
                {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Save workout"}
              </button>
            ) : null}
            {mode === "edit" && confirming ? (
              <p className="text-sm text-white/70">This updates the calendar, history, and streak.</p>
            ) : null}
          </form>
        ) : null}
      </div>
    </div>
  );

  function updateRow(index: number, patch: Partial<ExerciseRow>) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  if (typeof document === "undefined") return sheet;
  return createPortal(sheet, document.body);
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

function toRow(exercise: { name: string; sets: number; done: number; reps?: string; logMode?: string }): ExerciseRow {
  return {
    name: exercise.name,
    sets: exercise.sets,
    done: exercise.done,
    reps: exercise.reps ?? "",
    logMode: exercise.logMode ?? "",
  };
}
