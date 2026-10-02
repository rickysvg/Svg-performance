"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteWorkoutAction,
  saveWorkoutAction,
  type WorkoutActionState,
} from "@/app/actions/workouts";
import { primeUnlockAudio } from "@/lib/badge-sfx";
import { StatusBanner } from "@/components/StatusBanner";
import { DemoBadge } from "@/components/DemoBadge";
import { ExerciseThumb } from "@/components/training/ExerciseThumb";
import { BikeSetTimer } from "@/components/training/BikeSetTimer";
import { bikeSessionForLogger, isBikeIntervalName } from "@/lib/bike-sessions";
import { CoachCredit } from "@/components/training/CoachCredit";
import { BagFocusList } from "@/components/training/BagFocusList";
import { RirHint } from "@/components/training/RirHint";
import { hasRirCue } from "@/lib/rir";
import { bikeIntervalCompletionEffects } from "@/lib/bike-interval-timer";
import { lookupFormVideo, showFormVideoPending } from "@/lib/form-videos";
import { plannedSetLine, previousSetLabel } from "@/lib/exercise-media";
import {
  countLabel,
  hidesLoad,
  isDurationMode,
  loggerRowLayout,
  modeColumnLabel,
  modeHint,
  prescribedLbLabel,
  resolveLogMode,
  type LogMode,
} from "@/lib/exercise-log-mode";
import {
  addRestSeconds,
  formatRestClock,
  formatRestPill,
  isRestActive,
  remainingRestSeconds,
  signalRestComplete,
  startRestTimer,
  type RestTimerState,
} from "@/lib/rest-timer";
import { loggerCursor, nextIncompleteSetId } from "@/lib/logger-progress";
import {
  copyPreviousOntoExercise,
  restTimerAfterSetDone,
} from "@/lib/logger-prefill";
import type { PreviousSetLookup } from "@/lib/workouts";
import type { WorkoutSession, WorkoutSet } from "@prisma/client";
import { ExerciseNotepad } from "@/components/training/ExerciseNotepad";
import type { ExerciseNoteView } from "@/lib/exercise-notes";
import { convertLoad, roundLoadForInput } from "@/lib/units";

type Session = WorkoutSession & {
  sets: WorkoutSet[];
  programDay?: {
    title: string;
    exercises: {
      name: string;
      sets: number;
      reps: string;
      restSeconds: number;
      logMode?: string;
      notes?: string;
      loadText?: string;
      formVideoUrl: string;
      formVideoPending: boolean;
    }[];
  } | null;
};

function toDateInput(value: Date | string) {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function setsInLb(sets: WorkoutSet[]): WorkoutSet[] {
  return sets.map((set) => {
    if (set.loadUnit !== "kg") {
      return { ...set, loadUnit: "lb" };
    }
    return {
      ...set,
      loadUnit: "lb",
      loadValue:
        set.loadValue == null ? null : roundLoadForInput(convertLoad(set.loadValue, "kg", "lb")),
    };
  });
}

function newClientSet(
  sessionId: string,
  exerciseName: string,
  setNumber: number,
  loadUnit: string,
  logMode: LogMode = "timed",
  durationSeconds: number | null = null,
): WorkoutSet {
  return {
    id: `local-${crypto.randomUUID()}`,
    workoutSessionId: sessionId,
    exerciseName,
    setNumber,
    sortOrder: 0,
    reps: null,
    loadValue: null,
    loadUnit: loadUnit === "kg" ? "lb" : loadUnit || "lb",
    logMode,
    durationSeconds,
    completed: false,
    notes: "",
  };
}

function SessionTimer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <span className="tabular-nums text-sm text-muted">{formatRestClock(seconds)}</span>
  );
}

export function WorkoutLogForm({
  session,
  previousLoads = {},
  notes = {},
}: {
  session: Session;
  previousLoads?: PreviousSetLookup;
  notes?: Record<string, ExerciseNoteView>;
}) {
  const [state, action, pending] = useActionState(
    saveWorkoutAction,
    {} as WorkoutActionState,
  );
  const [sets, setSets] = useState(() => setsInLb(session.sets));
  const [showNotes, setShowNotes] = useState(Boolean(session.notes));
  const [insertName, setInsertName] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [restTimer, setRestTimer] = useState<RestTimerState | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const formRef = useRef<HTMLFormElement>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, WorkoutSet[]>();
    for (const set of sets) {
      const list = map.get(set.exerciseName) ?? [];
      list.push(set);
      map.set(set.exerciseName, list);
    }
    return [...map.entries()];
  }, [sets]);

  const cursor = useMemo(
    () =>
      loggerCursor(
        grouped.map(([name, group]) => ({
          name,
          sets: group.map((set) => ({ id: set.id, completed: set.completed })),
        })),
      ),
    [grouped],
  );
  const currentPlanned = session.programDay?.exercises.find(
    (row) => row.name === cursor.exerciseName,
  );
  const currentGroup = grouped.find(([name]) => name === cursor.exerciseName)?.[1];
  const currentMode = resolveLogMode({
    logMode: currentGroup?.[0]?.logMode ?? currentPlanned?.logMode,
    name: cursor.exerciseName,
    reps: currentPlanned?.reps,
  });
  const progressUnit = currentMode === "timed_round" ? "Round" : "Set";
  const currentRest =
    currentPlanned?.restSeconds ??
    (currentMode === "timed_round" ? 90 : currentMode === "timed" ? 45 : 60);
  const firstRirName = session.programDay?.exercises.find((row) => hasRirCue(row.loadText))?.name;

  const defaultUnit = "lb";
  const loadHeader = "Lbs";
  const cancelHref = session.programDayId
    ? `/training/${session.programDayId}`
    : "/training";
  const restRemaining = remainingRestSeconds(restTimer, nowMs);
  const restRunning = isRestActive(restTimer, nowMs);

  useEffect(() => {
    if (!moreOpen) return;
    document.querySelector("[data-session-overflow]")?.scrollIntoView({ block: "nearest" });
  }, [moreOpen]);

  useEffect(() => {
    if (!restTimer) return;
    const tick = window.setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      if (remainingRestSeconds(restTimer, now) <= 0) {
        setRestTimer(null);
        signalRestComplete();
      }
    }, 250);
    return () => window.clearInterval(tick);
  }, [restTimer]);

  function updateSet(id: string, patch: Partial<WorkoutSet>) {
    setSets((current) =>
      current.map((set) => (set.id === id ? { ...set, ...patch } : set)),
    );
  }

  function addSet(exerciseName: string) {
    setSets((current) => {
      const group = current.filter((set) => set.exerciseName === exerciseName);
      const unit = group[0]?.loadUnit ?? defaultUnit;
      const planned = session.programDay?.exercises.find((row) => row.name === exerciseName);
      const mode = resolveLogMode({
        logMode: group[0]?.logMode ?? planned?.logMode,
        name: exerciseName,
        reps: planned?.reps,
      });
      return [
        ...current,
        newClientSet(session.id, exerciseName, group.length + 1, unit, mode),
      ];
    });
  }

  function markDone(
    setId: string,
    exerciseName: string,
    restSeconds: number,
    completed: boolean,
  ) {
    updateSet(setId, { completed });
    const nextRest = restTimerAfterSetDone({
      completed,
      exerciseName,
      restSeconds,
    });
    if (nextRest) setRestTimer(nextRest);
    if (!completed) return;
    const nextId = nextIncompleteSetId(
      sets.map((set) => (set.id === setId ? { ...set, completed: true } : set)),
      setId,
    );
    if (!nextId) return;
    const escaped = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(nextId) : nextId;
    requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLElement>(`[data-set-field="${escaped}"]`)?.focus();
    });
  }

  function insertExercise() {
    const name = insertName.trim().slice(0, 80);
    if (!name) return;
    const mode = resolveLogMode({ name });
    setSets((current) => [
      ...current,
      newClientSet(session.id, name, 1, defaultUnit, mode),
    ]);
    setInsertName("");
  }

  return (
    <div>
      <form ref={formRef} action={action} className="space-y-5">
        <header className="sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-10 -mx-4 overflow-hidden border-b border-line bg-background/95 backdrop-blur">
          <div className="flex items-center gap-2 px-4 py-2">
            <Link
              href={cancelHref}
              className="touch-target inline-flex items-center text-sm font-medium text-muted"
            >
              Cancel
            </Link>
            <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-center">
              {cursor.exerciseCount > 0 ? (
                <p data-logger-progress className="font-display text-sm uppercase leading-tight">
                  Exercise {cursor.exerciseIndex} of {cursor.exerciseCount}
                  <span className="mt-0.5 block text-xs">
                    {progressUnit} {cursor.setIndex} of {cursor.setCount}
                  </span>
                </p>
              ) : null}
              <SessionTimer />
            </div>
            <div className="flex flex-col items-end">
              <button
                type="button"
                onClick={() => setShowNotes((open) => !open)}
                className="touch-target text-sm font-medium underline-offset-4 hover:underline"
              >
                Notes
              </button>
              <button
                type="button"
                data-session-more
                onClick={() => setMoreOpen((open) => !open)}
                className="text-sm font-medium text-muted underline-offset-4 hover:underline"
              >
                More
              </button>
            </div>
          </div>
          {restRunning ? (
            <div data-rest-countdown className="bg-black px-4 py-4 text-white">
              <p className="font-display text-xs uppercase tracking-wide text-highlighter">
                Rest · {restTimer?.exerciseName}
              </p>
              <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                <p className="font-display text-6xl leading-none text-[#CBF805] tabular-nums">
                  {formatRestClock(restRemaining)}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    data-rest-skip
                    onClick={() => setRestTimer(null)}
                    className="touch-target rounded-full border border-white/40 px-4 text-sm text-white"
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    data-rest-plus
                    onClick={() =>
                      setRestTimer((timer) => (timer ? addRestSeconds(timer, 15) : timer))
                    }
                    className="touch-target rounded-full bg-accent px-4 text-sm text-black"
                  >
                    +15s
                  </button>
                </div>
              </div>
            </div>
          ) : currentRest > 0 && cursor.exerciseName ? (
            <div className="px-4 pb-3">
              <button
                type="button"
                data-rest-start={cursor.exerciseName}
                onClick={() => setRestTimer(startRestTimer(cursor.exerciseName, currentRest))}
                className="touch-target w-full rounded-full border border-line font-display text-sm uppercase"
              >
                Start rest {formatRestPill(currentRest)}
              </button>
            </div>
          ) : null}
        </header>

        <div className="space-y-2 pt-2">
          {session.title.startsWith("DEMO") ? (
            <div className="flex justify-end">
              <DemoBadge />
            </div>
          ) : null}
          <label className="block">
            <span className="sr-only">Workout title</span>
            <textarea
              name="title"
              data-workout-title
              defaultValue={session.title}
              rows={2}
              className="font-display min-h-[3.4rem] w-full min-w-0 resize-none bg-transparent text-2xl leading-tight tracking-wide break-words whitespace-normal outline-none"
            />
          </label>
          {session.programDay?.title ? (
            <p className="text-sm text-muted">{session.programDay.title}</p>
          ) : null}
        </div>

        <StatusBanner error={state.error} success={state.success} />
        <input type="hidden" name="workoutId" value={session.id} />
        <input type="hidden" name="setCount" value={sets.length} />

        {showNotes ? (
          <div className="space-y-4 rounded-2xl border border-line bg-card p-4">
            <label className="block text-sm">
              <span className="text-muted">When</span>
              <input
                name="performedAt"
                type="datetime-local"
                defaultValue={toDateInput(session.performedAt)}
                className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Notes</span>
              <textarea
                name="notes"
                defaultValue={session.notes}
                rows={3}
                className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
              />
            </label>
            <fieldset>
              <legend className="text-sm font-medium">Record HR (optional)</legend>
              <p className="mb-3 text-xs text-muted">
                Manual avg / max if no Polar pull. Not a live watch stream.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-2 text-sm">
                  <span>Average bpm</span>
                  <input
                    name="hrAvgBpm"
                    type="number"
                    min={30}
                    max={230}
                    className="w-full rounded-xl border border-line bg-background px-3 py-3"
                  />
                </label>
                <label className="block space-y-2 text-sm">
                  <span>Max bpm</span>
                  <input
                    name="hrMaxBpm"
                    type="number"
                    min={30}
                    max={230}
                    className="w-full rounded-xl border border-line bg-background px-3 py-3"
                  />
                </label>
              </div>
            </fieldset>
          </div>
        ) : (
          <>
            <input type="hidden" name="performedAt" defaultValue={toDateInput(session.performedAt)} />
            <input type="hidden" name="notes" defaultValue={session.notes} />
          </>
        )}

        {grouped.map(([name, group]) => {
          const form = lookupFormVideo(name, session.programDay?.exercises);
          const planned = session.programDay?.exercises.find((row) => row.name === name);
          const mode = resolveLogMode({
            logMode: group[0]?.logMode ?? planned?.logMode,
            name,
            reps: planned?.reps,
          });
          const bike = isBikeIntervalName(name);
          const bikeSession = bike ? bikeSessionForLogger(name, planned) : null;
          const timed = isDurationMode(mode) && !bike;
          const restSeconds = planned?.restSeconds ?? (bike ? 60 : mode === "timed_round" ? 90 : 60);
          const layout = loggerRowLayout(mode, name);
          const columns =
            layout === "bag"
              ? "grid-cols-[5.5rem_1fr_2.75rem]"
              : layout === "weighted_shadow"
                ? "grid-cols-[1fr_4.75rem_2.75rem]"
                : bike
                  ? "grid-cols-[2rem_1fr_2rem]"
                  : hidesLoad(mode)
                    ? "grid-cols-[2rem_1fr_5.5rem_2rem]"
                    : "grid-cols-[2rem_1fr_4.5rem_4.5rem_2rem]";
          const hint = modeHint(mode, name);
          const current = name === cursor.exerciseName && !cursor.done;
          const pounds = prescribedLbLabel(planned?.loadText);
          return (
            <section
              key={name}
              data-exercise-block={name}
              data-log-row={layout}
              data-current-exercise={current ? "true" : undefined}
              className={`scroll-mt-36 rounded-2xl border p-4 ${
                current
                  ? "border-[#CBF805] bg-card shadow-[0_0_0_2px_#CBF805]"
                  : "border-line bg-card"
              }`}
            >
              <div className="flex items-start gap-3">
                <ExerciseThumb
                  name={name}
                  formVideoUrl={form.url}
                  formVideoPending={form.pending}
                />
                <div className="min-w-0 flex-1">
                  {current ? (
                    <p className="font-display text-xs uppercase tracking-wide text-accent">Now</p>
                  ) : null}
                  <h2>{name}</h2>
                  <CoachCredit name={name} />
                  <p className="mt-0.5 text-sm text-muted">
                    {planned
                      ? plannedSetLine({
                          sets: planned.sets,
                          reps: planned.reps,
                          restSeconds: planned.restSeconds,
                          logMode: mode,
                          name,
                          loadText: planned.loadText,
                        })
                      : countLabel(group.length, mode === "timed_round" ? "round" : "set")}
                  </p>
                  {name === firstRirName ? <RirHint /> : null}
                  {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
                  <BagFocusList
                    notes={planned?.notes}
                    activeRound={current && layout === "bag" ? cursor.setIndex : undefined}
                  />
                  {bikeSession ? (
                    <BikeSetTimer
                      key={`${name}-${bikeSession.workSeconds}-${bikeSession.restSeconds}-${bikeSession.roundsPerSet}`}
                      session={bikeSession}
                      canStart={group.some((set) => !set.completed)}
                      onSetComplete={() => {
                        const nextOpen = group.find((set) => !set.completed);
                        if (!nextOpen) return;
                        updateSet(nextOpen.id, { completed: true });
                        const effects = bikeIntervalCompletionEffects({
                          exerciseName: name,
                          restBetweenSetsSeconds: restSeconds,
                        });
                        if (effects.rest) setRestTimer(effects.rest);
                      }}
                    />
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                    {previousLoads[name] ? (
                      <button
                        type="button"
                        data-same-as-last={name}
                        onClick={() =>
                          setSets((current) => copyPreviousOntoExercise(current, name, previousLoads))
                        }
                        className="inline-flex min-h-8 items-center rounded-full border border-line px-2.5 text-xs font-semibold"
                      >
                        Same as last
                      </button>
                    ) : null}
                    {showFormVideoPending(form) ? (
                      <p className="text-xs text-muted">Video pending coach review</p>
                    ) : null}
                  </div>
                  <ExerciseNotepad
                    exerciseName={name}
                    programDayId={session.programDayId ?? ""}
                    workoutId={session.id}
                    logMode={mode}
                    plannedLine={
                      planned
                        ? plannedSetLine({
                            sets: planned.sets,
                            reps: planned.reps,
                            restSeconds: planned.restSeconds,
                            logMode: mode,
                            name,
                            loadText: planned.loadText,
                          })
                        : ""
                    }
                    note={notes[name]}
                  />
                </div>
              </div>

              {restSeconds > 0 ? (
                <p className="mt-3 text-sm text-muted">
                  {bike || mode === "timed_round" ? "Rest between rounds" : "Rest between each set"}
                </p>
              ) : null}

              <div className={`mt-3 grid ${columns} items-center gap-2 text-xs text-muted`}>
                {layout === "bag" ? (
                  <>
                    <span>Round</span>
                    <span>Time</span>
                  </>
                ) : layout === "weighted_shadow" ? (
                  <>
                    <span>Seconds</span>
                    <span>Lbs</span>
                  </>
                ) : (
                  <>
                    <span>{bike || mode !== "timed_round" ? "Set" : "Rd"}</span>
                    <span>Previous</span>
                    {bike ? null : <span>{modeColumnLabel(mode)}</span>}
                    {bike || hidesLoad(mode) ? null : <span>{loadHeader}</span>}
                  </>
                )}
                <span className="sr-only">Done</span>
              </div>

              <div className="mt-1 space-y-2">
                {group.map((set, indexInGroup) => {
                  const index = sets.findIndex((item) => item.id === set.id);
                  const previous = previousLoads[name]?.[set.setNumber] ?? null;
                  const primaryField = layout !== "bike";
                  return (
                    <div key={set.id} className="space-y-1">
                      {layout === "weighted_shadow" && group.length > 1 ? (
                        <p className="text-xs text-muted">Set {indexInGroup + 1}</p>
                      ) : null}
                      <div className={`grid ${columns} items-center gap-2`}>
                      <input
                        type="hidden"
                        name={`sets.${index}.exerciseName`}
                        value={set.exerciseName}
                      />
                      <input
                        type="hidden"
                        name={`sets.${index}.setNumber`}
                        value={set.setNumber}
                      />
                      <input type="hidden" name={`sets.${index}.loadUnit`} value={set.loadUnit} />
                      <input type="hidden" name={`sets.${index}.logMode`} value={mode} />
                      {layout === "bag" ? (
                        <p className="text-sm font-medium">Round {indexInGroup + 1}</p>
                      ) : layout === "weighted_shadow" ? null : (
                        <>
                          <p className="text-sm font-medium">{indexInGroup + 1}</p>
                          <p className="truncate text-sm text-muted">{previousSetLabel(previous)}</p>
                        </>
                      )}
                      {bike ? (
                        <input type="hidden" name={`sets.${index}.durationSeconds`} value="" />
                      ) : timed ? (
                        <label className="block">
                          <span className="sr-only">
                            {layout === "weighted_shadow" ? "Seconds" : layout === "bag" ? "Time" : modeColumnLabel(mode)}
                          </span>
                          <input
                            name={`sets.${index}.durationSeconds`}
                            data-set-field={set.id}
                            type="number"
                            min={0}
                            max={3600}
                            inputMode="numeric"
                            placeholder={layout === "weighted_shadow" ? "sec" : undefined}
                            value={set.durationSeconds ?? ""}
                            onChange={(event) =>
                              updateSet(set.id, {
                                durationSeconds:
                                  event.target.value === "" ? null : Number(event.target.value),
                                logMode: mode,
                              })
                            }
                            className="h-11 w-full scroll-mt-36 rounded-lg border border-line bg-background px-2 text-center"
                          />
                        </label>
                      ) : (
                        <label className="block">
                          <span className="sr-only">Reps</span>
                          <input
                            name={`sets.${index}.reps`}
                            data-set-field={set.id}
                            type="number"
                            min={0}
                            max={200}
                            inputMode="numeric"
                            value={set.reps ?? ""}
                            onChange={(event) =>
                              updateSet(set.id, {
                                reps: event.target.value === "" ? null : Number(event.target.value),
                              })
                            }
                            className="h-11 w-full scroll-mt-36 rounded-lg border border-line bg-background px-2 text-center"
                          />
                        </label>
                      )}
                      {bike || hidesLoad(mode) ? (
                        <input type="hidden" name={`sets.${index}.loadValue`} value="" />
                      ) : (
                        <label className="block">
                          <span className="sr-only">{loadHeader}</span>
                          <input
                            name={`sets.${index}.loadValue`}
                            type="number"
                            min={0}
                            max={2000}
                            step="0.5"
                            inputMode="decimal"
                            placeholder={pounds ?? "lbs"}
                            value={set.loadValue ?? ""}
                            onChange={(event) =>
                              updateSet(set.id, {
                                loadValue:
                                  event.target.value === "" ? null : Number(event.target.value),
                              })
                            }
                            className="h-11 w-full rounded-lg border border-line bg-background px-2 text-center"
                          />
                        </label>
                      )}
                      <label className="flex items-center justify-center">
                        <span className="sr-only">Done</span>
                        <input
                          name={`sets.${index}.completed`}
                          data-set-field={primaryField ? undefined : set.id}
                          type="checkbox"
                          checked={set.completed}
                          onChange={(event) =>
                            markDone(set.id, name, restSeconds, event.target.checked)
                          }
                          className="h-5 w-5 accent-accent"
                        />
                      </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => addSet(name)}
                className="touch-target mt-2 text-sm font-medium underline-offset-4 hover:underline"
              >
                {bike || mode !== "timed_round" ? "+ Add new set" : "+ Add round"}
              </button>
            </section>
          );
        })}

        <div className="h-28" aria-hidden />
        <div className="sticky bottom-0 z-10 -mx-4 space-y-2 border-t border-line bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <button
            type="submit"
            name="intent"
            value="complete"
            disabled={pending}
            onClick={() => primeUnlockAudio()}
            className="touch-target w-full rounded-full bg-accent text-black disabled:opacity-60"
          >
            {pending ? "Saving…" : "SAVE"}
          </button>
          <button
            type="submit"
            name="intent"
            value="draft"
            disabled={pending}
            className="touch-target w-full text-sm font-medium text-muted disabled:opacity-60"
          >
            Save draft
          </button>
        </div>
      </form>

      {moreOpen ? (
        <div
          data-session-overflow
          className="mt-4 space-y-4 rounded-2xl border border-line bg-card p-4"
        >
          <p className="font-display text-sm uppercase tracking-wide">More</p>
          <div data-round-insert className="space-y-3">
            <label className="block text-sm">
              <span className="font-medium">Insert exercise</span>
              <input
                value={insertName}
                onChange={(event) => setInsertName(event.target.value)}
                placeholder="Exercise name"
                className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {["Sparring rounds", "Grappling rounds", "Pad rounds", "Heavy bag rounds"].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  data-insert-chip={chip}
                  onClick={() => {
                    setInsertName(chip);
                    const mode = resolveLogMode({ name: chip });
                    setSets((current) => [
                      ...current,
                      newClientSet(session.id, chip, 1, defaultUnit, mode, 180),
                    ]);
                  }}
                  className="rounded-full border border-line px-3 py-2 text-xs"
                >
                  {chip}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={insertExercise}
              className="touch-target text-sm font-medium underline-offset-4 hover:underline"
            >
              Insert exercise
            </button>
          </div>
          <Link href="/coach" className="block text-sm font-semibold text-accent">
            Ask Coach
          </Link>
          <form action={deleteWorkoutAction}>
            <input type="hidden" name="workoutId" value={session.id} />
            <button
              type="submit"
              className="touch-target text-sm text-danger underline-offset-4 hover:underline"
            >
              Delete this session
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
