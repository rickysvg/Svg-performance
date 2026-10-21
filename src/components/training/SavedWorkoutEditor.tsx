"use client";

import { useActionState, useState } from "react";
import { updateSavedWorkoutAction, type SavedWorkoutActionState } from "@/app/actions/my-workouts";
import { ExerciseLibrarySheet } from "@/components/training/ExerciseLibrarySheet";
import { draftsForLibraryExercise } from "@/lib/logger-insert";
import { rirFromLoadText } from "@/lib/rir";
import type { LibraryExercise } from "@/lib/exercise-library";
import type { SavedExercise } from "@/lib/my-workout-plan";

function moveItem(list: SavedExercise[], index: number, direction: "up" | "down") {
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  const [row] = next.splice(index, 1);
  next.splice(target, 0, row!);
  return next;
}

export function SavedWorkoutEditor({
  id,
  name,
  exercises,
  weightAccess,
}: {
  id: string;
  name: string;
  exercises: SavedExercise[];
  weightAccess: "gym" | "none";
}) {
  const [rows, setRows] = useState(exercises);
  const [title, setTitle] = useState(name);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [state, action, pending] = useActionState(updateSavedWorkoutAction, {} as SavedWorkoutActionState);

  function addFromLibrary(exercise: LibraryExercise) {
    const drafts = draftsForLibraryExercise(
      rows.map((row) => row.name),
      exercise,
    );
    const draft = drafts[0];
    if (!draft) return;
    const next: SavedExercise = {
      name: draft.exerciseName,
      sets: drafts.length,
      reps: exercise.reps,
      loadText: exercise.loadText,
      restSeconds: draft.restSeconds,
      rir: rirFromLoadText(exercise.loadText) ?? "",
      logMode: draft.logMode,
      notes: exercise.notes,
    };
    const at = insertAt ?? rows.length;
    setRows((current) => [...current.slice(0, at), next, ...current.slice(at)]);
    setInsertAt(null);
  }

  return (
    <form action={action} className="space-y-3" data-saved-editor>
      <input type="hidden" name="savedWorkoutId" value={id} />
      <input type="hidden" name="exercises" value={JSON.stringify(rows)} />
      <label className="block text-sm">
        <span className="font-medium">Name</span>
        <input
          name="name"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={80}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        />
      </label>
      <p className="text-sm text-muted">
        Editing this list does not change a day you already applied. Apply it again to update that day.
      </p>
      {rows.map((row, index) => (
        <div key={`${row.name}-${index}`}>
          <div className="mb-2 flex items-center gap-3">
            <div className="h-px flex-1 bg-line" />
            <button
              type="button"
              data-insert-exercise={index}
              aria-label={`Add exercise above ${row.name}`}
              onClick={() => setInsertAt(index)}
              className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-line text-sm"
            >
              +
            </button>
            <div className="h-px flex-1 bg-line" />
          </div>
          <section data-saved-exercise={row.name} className="rounded-2xl border border-line bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base">{row.name}</h2>
              <div className="flex gap-2 text-xs">
                <button type="button" data-move-up={row.name} onClick={() => setRows((current) => moveItem(current, index, "up"))}>
                  Up
                </button>
                <button type="button" data-move-down={row.name} onClick={() => setRows((current) => moveItem(current, index, "down"))}>
                  Down
                </button>
                <button
                  type="button"
                  data-remove-added={row.name}
                  className="text-danger"
                  onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                >
                  Remove
                </button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <label>
                Sets
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={row.sets}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item, rowIndex) =>
                        rowIndex === index ? { ...item, sets: Number(event.target.value) } : item,
                      ),
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-line bg-background px-2 py-2"
                />
              </label>
              <label>
                Reps
                <input
                  value={row.reps}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item, rowIndex) =>
                        rowIndex === index ? { ...item, reps: event.target.value } : item,
                      ),
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-line bg-background px-2 py-2"
                />
              </label>
              <label>
                Rest (sec)
                <input
                  type="number"
                  min={0}
                  max={600}
                  value={row.restSeconds}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item, rowIndex) =>
                        rowIndex === index ? { ...item, restSeconds: Number(event.target.value) } : item,
                      ),
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-line bg-background px-2 py-2"
                />
              </label>
              <label>
                RIR
                <input
                  value={row.rir}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item, rowIndex) =>
                        rowIndex === index ? { ...item, rir: event.target.value } : item,
                      ),
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-line bg-background px-2 py-2"
                />
              </label>
              <label className="col-span-2">
                Load notes
                <input
                  value={row.loadText}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item, rowIndex) =>
                        rowIndex === index ? { ...item, loadText: event.target.value } : item,
                      ),
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-line bg-background px-2 py-2"
                />
              </label>
            </div>
          </section>
        </div>
      ))}
      <button
        type="button"
        data-add-exercise
        onClick={() => setInsertAt(rows.length)}
        className="touch-target w-full rounded-2xl border border-dashed border-line text-sm font-semibold"
      >
        + Add exercise
      </button>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state.saved ? <p className="text-sm font-semibold">Saved.</p> : null}
      <button
        type="submit"
        disabled={pending || rows.length === 0}
        className="touch-target w-full rounded-full bg-accent font-semibold text-black disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save workout"}
      </button>
      {insertAt != null ? (
        <ExerciseLibrarySheet
          variant="add"
          title="Add exercise"
          weightAccess={weightAccess}
          onClose={() => setInsertAt(null)}
          footer={(choice) => (
            <button
              type="button"
              data-library-add
              onClick={() => addFromLibrary(choice)}
              className="touch-target w-full rounded-full bg-accent font-semibold text-black"
            >
              Add {choice.name}
            </button>
          )}
        />
      ) : null}
    </form>
  );
}
