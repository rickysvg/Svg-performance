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
import { lookupFormVideo } from "@/lib/form-videos";
import {
  plannedSetLine,
  previousSetLabel,
  restBannerSeconds,
} from "@/lib/exercise-media";
import type { PreviousSetLookup } from "@/lib/workouts";
import type { WorkoutSession, WorkoutSet } from "@prisma/client";

type Session = WorkoutSession & {
  sets: WorkoutSet[];
  programDay?: {
    title: string;
    exercises: {
      name: string;
      sets: number;
      reps: string;
      restSeconds: number;
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
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return (
    <span className="tabular-nums text-sm text-muted">
      {minutes}:{String(remain).padStart(2, "0")}
    </span>
  );
}

export function WorkoutLogForm({
  session,
  previousLoads = {},
}: {
  session: Session;
  previousLoads?: PreviousSetLookup;
}) {
  const [state, action, pending] = useActionState(
    saveWorkoutAction,
    {} as WorkoutActionState,
  );
  const [sets, setSets] = useState(session.sets);
  const [showNotes, setShowNotes] = useState(Boolean(session.notes));
  const [insertName, setInsertName] = useState("");

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

  function updateSet(id: string, patch: Partial<WorkoutSet>) {
    setSets((current) =>
      current.map((set) => (set.id === id ? { ...set, ...patch } : set)),
    );
  }

  function addSet(exerciseName: string) {
    setSets((current) => {
      const group = current.filter((set) => set.exerciseName === exerciseName);
      const unit = group[0]?.loadUnit ?? defaultUnit;
      return [
        ...current,
        newClientSet(session.id, exerciseName, group.length + 1, unit),
      ];
    });
  }

  function insertExercise() {
    const name = insertName.trim().slice(0, 80);
    if (!name) return;
    setSets((current) => [
      ...current,
      newClientSet(session.id, name, 1, defaultUnit),
    ]);
    setInsertName("");
  }

  return (
    <div>
      <form action={action} className="space-y-5">
        <header className="-mx-4 flex items-center gap-2 border-b border-line px-4 pb-3">
          <Link
            href={cancelHref}
            className="touch-target inline-flex items-center text-sm font-medium text-muted"
          >
            Cancel
          </Link>
          <div className="flex flex-1 items-center justify-center gap-3">
            <SessionTimer />
            <button
              type="button"
              onClick={() => setShowNotes((open) => !open)}
              className="touch-target text-sm text-accent"
            >
              Notes
            </button>
          </div>
          <button
            type="submit"
            name="intent"
            value="complete"
            disabled={pending}
            className="touch-target text-sm font-semibold text-accent disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </header>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <label className="block">
              <span className="sr-only">Workout title</span>
              <input
                name="title"
                defaultValue={session.title}
                className="w-full bg-transparent text-2xl font-semibold outline-none"
              />
            </label>
            {session.programDay?.title ? (
              <p className="mt-1 text-sm text-muted">{session.programDay.title}</p>
            ) : null}
          </div>
          {session.title.startsWith("DEMO") ? <DemoBadge /> : null}
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
          const restSeconds = planned?.restSeconds ?? 60;
          return (
            <section key={name} className="rounded-2xl border border-line bg-card p-4">
              <div className="flex items-start gap-3">
                <ExerciseThumb
                  name={name}
                  formVideoUrl={form.url}
                  formVideoPending={form.pending}
                />
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{name}</h2>
                  <p className="mt-0.5 text-sm text-muted">
                    {planned
                      ? plannedSetLine({
                          sets: planned.sets,
                          reps: planned.reps,
                          restSeconds: planned.restSeconds,
                        })
                      : `${group.length} sets`}
                  </p>
                  <WatchFormInline url={form.url} pending={form.pending} />
                </div>
              </div>

              {restSeconds > 0 ? (
                <p className="mt-3 flex items-center justify-between rounded-full bg-accent/10 px-3 py-2 text-sm text-accent">
                  <span>Rest between each set</span>
                  <span className="tabular-nums">{restBannerSeconds(restSeconds)}</span>
                </p>
              ) : null}

              <div className="mt-3 grid grid-cols-[2rem_1fr_4.5rem_4.5rem_2rem] items-center gap-2 text-xs text-muted">
                <span>Set</span>
                <span>Previous</span>
                <span>Reps</span>
                <span>{loadHeader}</span>
                <span className="sr-only">Done</span>
              </div>

              <div className="mt-1 space-y-2">
                {group.map((set, indexInGroup) => {
                  const index = sets.findIndex((item) => item.id === set.id);
                  const previous = previousLoads[name]?.[set.setNumber] ?? null;
                  return (
                    <div
                      key={set.id}
                      className="grid grid-cols-[2rem_1fr_4.5rem_4.5rem_2rem] items-center gap-2"
                    >
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
                      <p className="text-sm font-medium">{indexInGroup + 1}</p>
                      <p className="truncate text-sm text-muted">{previousSetLabel(previous)}</p>
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
                      <label className="flex items-center justify-center">
                        <span className="sr-only">Done</span>
                        <input
                          name={`sets.${index}.completed`}
                          type="checkbox"
                          checked={set.completed}
                          onChange={(event) =>
                            updateSet(set.id, { completed: event.target.checked })
                          }
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
                className="touch-target mt-2 text-sm font-medium text-accent"
              >
                + Add new set
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
            className="touch-target text-sm font-medium text-accent"
          >
            Insert exercise
          </button>
        </div>

        <div className="sticky bottom-28 z-10 -mx-4 space-y-2 border-t border-line bg-background/95 px-4 py-3 pr-20 backdrop-blur">
          <button
            type="submit"
            name="intent"
            value="complete"
            disabled={pending}
            className="touch-target w-full rounded-full bg-accent font-semibold text-black disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
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
