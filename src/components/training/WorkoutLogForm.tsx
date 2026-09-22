"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  deleteWorkoutAction,
  saveWorkoutAction,
  type WorkoutActionState,
} from "@/app/actions/workouts";
import { StatusBanner } from "@/components/StatusBanner";
import { DemoBadge } from "@/components/DemoBadge";
import { WatchForm } from "@/components/training/WatchForm";
import { lookupFormVideo } from "@/lib/form-videos";
import type { WorkoutSession, WorkoutSet } from "@prisma/client";

type Session = WorkoutSession & {
  sets: WorkoutSet[];
  programDay?: {
    exercises: { name: string; formVideoUrl: string; formVideoPending: boolean }[];
  } | null;
};

function toDateInput(value: Date | string) {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function WorkoutLogForm({ session }: { session: Session }) {
  const [state, action, pending] = useActionState(
    saveWorkoutAction,
    {} as WorkoutActionState,
  );
  const [sets, setSets] = useState(session.sets);

  const grouped = useMemo(() => {
    const map = new Map<string, WorkoutSet[]>();
    for (const set of sets) {
      const list = map.get(set.exerciseName) ?? [];
      list.push(set);
      map.set(set.exerciseName, list);
    }
    return [...map.entries()];
  }, [sets]);

  function updateSet(id: string, patch: Partial<WorkoutSet>) {
    setSets((current) =>
      current.map((set) => (set.id === id ? { ...set, ...patch } : set)),
    );
  }

  return (
    <div>
      <Link href="/training/history" className="text-sm text-accent underline-offset-4 hover:underline">
        Back to history
      </Link>
      <div className="mt-2 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Log workout</h1>
        {session.title.startsWith("DEMO") ? <DemoBadge /> : null}
      </div>
      <p className="mt-1 text-sm text-muted">
        Saved sets stay after refresh. Use this same screen to correct a mistaken entry.
      </p>

      <form action={action} className="mt-6 space-y-5">
        <StatusBanner error={state.error} success={state.success} />
        <input type="hidden" name="workoutId" value={session.id} />
        <input type="hidden" name="setCount" value={sets.length} />

        <label className="block">
          <span className="text-sm font-medium">Title</span>
          <input
            name="title"
            defaultValue={session.title}
            className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-3"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">When</span>
          <input
            name="performedAt"
            type="datetime-local"
            defaultValue={toDateInput(session.performedAt)}
            className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-3"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Notes</span>
          <textarea
            name="notes"
            defaultValue={session.notes}
            rows={3}
            className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-3"
          />
        </label>
        <fieldset className="rounded-2xl border border-line bg-card p-4">
          <legend className="px-1 text-sm font-medium">Record HR (optional)</legend>
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

        {grouped.map(([name, group]) => {
          const form = lookupFormVideo(name, session.programDay?.exercises);
          return (
          <fieldset key={name} className="rounded-2xl border border-line bg-card p-4">
            <legend className="px-1 text-base font-semibold">{name}</legend>
            <WatchForm url={form.url} pending={form.pending} />
            <div className="space-y-3">
              {group.map((set, indexInGroup) => {
                const index = sets.findIndex((item) => item.id === set.id);
                return (
                  <div key={set.id} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-12">
                    <input type="hidden" name={`sets.${index}.exerciseName`} value={set.exerciseName} />
                    <input type="hidden" name={`sets.${index}.setNumber`} value={set.setNumber} />
                    <p className="col-span-2 text-sm text-muted sm:pb-3">Set {indexInGroup + 1}</p>
                    <label className="block text-xs sm:col-span-3">
                      Reps
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
                        className="mt-1 w-full rounded-lg border border-line bg-background px-2 py-2"
                      />
                    </label>
                    <label className="block text-xs sm:col-span-3">
                      Load
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
                        className="mt-1 w-full rounded-lg border border-line bg-background px-2 py-2"
                      />
                    </label>
                    <label className="block text-xs sm:col-span-2">
                      Unit
                      <select
                        name={`sets.${index}.loadUnit`}
                        value={set.loadUnit}
                        onChange={(event) => updateSet(set.id, { loadUnit: event.target.value })}
                        className="mt-1 w-full rounded-lg border border-line bg-background px-2 py-2"
                      >
                        <option value="lb">lb</option>
                        <option value="kg">kg</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-xs sm:col-span-2 sm:pb-3">
                      <input
                        name={`sets.${index}.completed`}
                        type="checkbox"
                        checked={set.completed}
                        onChange={(event) =>
                          updateSet(set.id, { completed: event.target.checked })
                        }
                        className="h-5 w-5 accent-accent"
                      />
                      Done
                    </label>
                  </div>
                );
              })}
            </div>
          </fieldset>
          );
        })}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            name="intent"
            value="complete"
            disabled={pending}
            className="touch-target flex-1 rounded-full bg-accent font-semibold text-black disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save completed workout"}
          </button>
          <button
            type="submit"
            name="intent"
            value="draft"
            disabled={pending}
            className="touch-target flex-1 rounded-full border border-line font-medium disabled:opacity-60"
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
