"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import {
  deleteWorkoutAction,
  saveWorkoutAction,
  type WorkoutActionState,
} from "@/app/actions/workouts";
import { StatusBanner } from "@/components/StatusBanner";
import { DemoBadge } from "@/components/DemoBadge";
import { WatchFormInline } from "@/components/training/WatchForm";
import { ExerciseThumb } from "@/components/training/ExerciseThumb";
import { BikeSetTimer } from "@/components/training/BikeSetTimer";
import { bikeSessionForLogger, isBikeIntervalName } from "@/lib/bike-sessions";
import { CoachCredit } from "@/components/training/CoachCredit";
import { bikeIntervalCompletionEffects } from "@/lib/bike-interval-timer";
import { lookupFormVideo } from "@/lib/form-videos";
import { plannedSetLine, previousSetLabel } from "@/lib/exercise-media";
import {
  hidesLoad,
  isDurationMode,
  modeColumnLabel,
  modeHint,
  resolveLogMode,
  type LogMode,
} from "@/lib/exercise-log-mode";
import {
  formatRestClock,
  formatRestPill,
  isRestActive,
  remainingRestSeconds,
  signalRestComplete,
  startRestTimer,
  type RestTimerState,
} from "@/lib/rest-timer";
import {
  copyPreviousOntoExercise,
  restTimerAfterSetDone,
  seedSetsFromPrevious,
} from "@/lib/logger-prefill";
import type { PreviousSetLookup } from "@/lib/workouts";
import type { WorkoutSession, WorkoutSet } from "@prisma/client";
import { ExerciseNotepad } from "@/components/training/ExerciseNotepad";
import type { ExerciseNoteView } from "@/lib/exercise-notes";

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
    loadUnit,
    logMode,
    durationSeconds,
    completed: false,
    notes: "",
  };
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 4.5V8l2.25 1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
      <rect x="4.25" y="4.25" width="7.5" height="7.5" rx="1" fill="currentColor" />
    </svg>
  );
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
  const [sets, setSets] = useState(() => seedSetsFromPrevious(session.sets, previousLoads));
  const [showNotes, setShowNotes] = useState(Boolean(session.notes));
  const [insertName, setInsertName] = useState("");
  const [restTimer, setRestTimer] = useState<RestTimerState | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const grouped = useMemo(() => {
    const map = new Map<string, WorkoutSet[]>();
    for (const set of sets) {
      const list = map.get(set.exerciseName) ?? [];
      list.push(set);
      map.set(set.exerciseName, list);
    }
    return [...map.entries()];
  }, [sets]);

  const defaultUnit = sets[0]?.loadUnit === "kg" ? "kg" : "lb";
  const loadHeader = defaultUnit === "kg" ? "Kg" : "Lbs";
  const cancelHref = session.programDayId
    ? `/training/${session.programDayId}`
    : "/training";
  const restRemaining = remainingRestSeconds(restTimer, nowMs);
  const restRunning = isRestActive(restTimer, nowMs);

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
        newClientSet(session.id, exerciseName, group.length + 1, unit, mode, group[0]?.durationSeconds ?? null),
      ];
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
      <form action={action} className="space-y-5">
        <header className="sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-10 -mx-4 overflow-hidden border-b border-line bg-background/95 backdrop-blur">
          <div className="flex items-center gap-2 px-4 py-2">
            <Link
              href={cancelHref}
              className="touch-target inline-flex items-center text-sm font-medium text-muted"
            >
              Cancel
            </Link>
            <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5">
              {restRunning ? (
                <p className="stat-display rounded-full bg-accent px-3 py-1 text-2xl font-semibold leading-none text-black">
                  {formatRestClock(restRemaining)}
                </p>
              ) : null}
              <SessionTimer />
            </div>
            <button
              type="button"
              onClick={() => setShowNotes((open) => !open)}
              className="touch-target text-sm font-medium underline-offset-4 hover:underline"
            >
              Notes
            </button>
          </div>
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
              className="font-display min-h-[3.4rem] w-full min-w-0 resize-none bg-transparent text-2xl font-semibold leading-tight tracking-wide break-words whitespace-normal outline-none"
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
          const thisRest = restRunning && restTimer?.exerciseName === name;
          const columns = bike
            ? "grid-cols-[2rem_1fr_2rem]"
            : hidesLoad(mode)
              ? "grid-cols-[2rem_1fr_5.5rem_2rem]"
              : "grid-cols-[2rem_1fr_4.5rem_4.5rem_2rem]";
          const hint = modeHint(mode, name);
          return (
            <section
              key={name}
              data-exercise-block={name}
              className="rounded-2xl border border-line bg-card p-4"
            >
              <div className="flex items-start gap-3">
                <ExerciseThumb
                  name={name}
                  formVideoUrl={form.url}
                  formVideoPending={form.pending}
                />
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{name}</h2>
                  <CoachCredit name={name} />
                  <p className="mt-0.5 text-sm text-muted">
                    {planned
                      ? plannedSetLine({
                          sets: planned.sets,
                          reps: planned.reps,
                          restSeconds: planned.restSeconds,
                          logMode: mode,
                          name,
                        })
                      : `${group.length} ${mode === "timed_round" ? "rounds" : "sets"}`}
                  </p>
                  {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
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
                    <WatchFormInline url={form.url} pending={form.pending} />
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
                          })
                        : ""
                    }
                    note={notes[name]}
                  />
                </div>
              </div>

              {restSeconds > 0 ? (
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-sm text-muted">
                    {bike
                      ? "Rest between sets"
                      : mode === "timed_round"
                        ? "Rest between rounds"
                        : "Rest between each set"}
                  </p>
                  {thisRest ? (
                    <button
                      type="button"
                      data-rest-stop={name}
                      onClick={() => setRestTimer(null)}
                      className="font-display inline-flex min-h-9 items-center gap-1.5 rounded-full bg-accent px-3 text-sm font-semibold uppercase tracking-wide text-black"
                    >
                      <StopIcon />
                      Stop
                    </button>
                  ) : (
                    <button
                      type="button"
                      data-rest-start={name}
                      onClick={() => setRestTimer(startRestTimer(name, restSeconds))}
                      className="font-display inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line px-3 text-sm uppercase tracking-wide hover:border-accent"
                    >
                      <ClockIcon />
                      {formatRestPill(restSeconds)}
                    </button>
                  )}
                </div>
              ) : null}

              <div className={`mt-3 grid ${columns} items-center gap-2 text-xs text-muted`}>
                <span>{bike || mode !== "timed_round" ? "Set" : "Rd"}</span>
                <span>Previous</span>
                {bike ? null : <span>{modeColumnLabel(mode)}</span>}
                {bike || hidesLoad(mode) ? null : <span>{loadHeader}</span>}
                <span className="sr-only">Done</span>
              </div>

              <div className="mt-1 space-y-2">
                {group.map((set, indexInGroup) => {
                  const index = sets.findIndex((item) => item.id === set.id);
                  const previous = previousLoads[name]?.[set.setNumber] ?? null;
                  return (
                    <div key={set.id} className={`grid ${columns} items-center gap-2`}>
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
                      <p className="text-sm font-medium">{indexInGroup + 1}</p>
                      <p className="truncate text-sm text-muted">{previousSetLabel(previous)}</p>
                      {bike ? (
                        <input type="hidden" name={`sets.${index}.durationSeconds`} value="" />
                      ) : timed ? (
                        <label className="block">
                          <span className="sr-only">{modeColumnLabel(mode)} seconds</span>
                          <input
                            name={`sets.${index}.durationSeconds`}
                            type="number"
                            min={0}
                            max={3600}
                            inputMode="numeric"
                            placeholder="sec"
                            value={set.durationSeconds ?? ""}
                            onChange={(event) =>
                              updateSet(set.id, {
                                durationSeconds:
                                  event.target.value === "" ? null : Number(event.target.value),
                                logMode: mode,
                              })
                            }
                            className="h-11 w-full rounded-lg border border-line bg-background px-2 text-center"
                          />
                        </label>
                      ) : (
                        <label className="block">
                          <span className="sr-only">Reps</span>
                          <input
                            name={`sets.${index}.reps`}
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
                            className="h-11 w-full rounded-lg border border-line bg-background px-2 text-center"
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
                          type="checkbox"
                          checked={set.completed}
                          onChange={(event) => {
                            const completed = event.target.checked;
                            updateSet(set.id, { completed });
                            const nextRest = restTimerAfterSetDone({
                              completed,
                              exerciseName: name,
                              restSeconds,
                            });
                            if (nextRest) setRestTimer(nextRest);
                          }}
                          className="h-5 w-5 accent-accent"
                        />
                      </label>
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

        <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-line p-4">
          <label className="block text-sm">
            <span className="font-medium">Insert exercise</span>
            <input
              value={insertName}
              onChange={(event) => setInsertName(event.target.value)}
              placeholder="Exercise name"
              className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-3"
            />
          </label>
          <button
            type="button"
            onClick={insertExercise}
            className="touch-target text-sm font-medium underline-offset-4 hover:underline"
          >
            Insert exercise
          </button>
        </div>

        <div className="h-28" aria-hidden />
        <div className="sticky bottom-0 z-10 -mx-4 space-y-2 border-t border-line bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <button
            type="submit"
            name="intent"
            value="complete"
            disabled={pending}
            className="touch-target w-full rounded-full bg-accent font-semibold text-black disabled:opacity-60"
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

      <form action={deleteWorkoutAction} className="mt-6">
        <input type="hidden" name="workoutId" value={session.id} />
        <button
          type="submit"
          className="touch-target text-sm text-danger underline-offset-4 hover:underline"
        >
          Delete this session
        </button>
      </form>
    </div>
  );
}
