"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { swapExerciseAction } from "@/app/actions/exercise-swap";
import {
  CATEGORY_FILTERS,
  categoryLabel,
  filterExerciseLibrary,
  libraryExercise,
  type ExerciseCategory,
} from "@/lib/exercise-library";
import { plannedSetLine } from "@/lib/exercise-log-mode";
import type { WorkoutSet } from "@prisma/client";
import type { WorkoutSetInput } from "@/lib/workouts";

type Source = {
  sets: number;
  reps: string;
  loadText: string;
  restSeconds: number;
  logMode?: string;
  notes?: string;
};

export function ExerciseSwapButton({
  programSlug,
  dayNumber,
  programDayId,
  originalName,
  currentName,
  source,
  weightAccess,
  workoutSessionId,
  getCurrentSets,
  onSwapped,
}: {
  programSlug: string;
  dayNumber: number;
  programDayId?: string;
  originalName: string;
  currentName: string;
  source: Source;
  weightAccess: "gym" | "none";
  workoutSessionId?: string;
  getCurrentSets?: () => WorkoutSetInput[];
  onSwapped?: (sets: WorkoutSet[]) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORY_FILTERS)[number]["id"]>("all");
  const [equipment, setEquipment] = useState<"gym" | "none">(weightAccess);
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const results = useMemo(
    () =>
      filterExerciseLibrary({
        query,
        category,
        equipment,
        excludeName: currentName,
      }),
    [query, category, equipment, currentName],
  );
  const choice = picked ? libraryExercise(picked) : null;

  function close() {
    setOpen(false);
    setPicked(null);
    setError("");
    setQuery("");
  }

  function confirm(scope: "session" | "block") {
    if (!choice) return;
    setError("");
    startTransition(async () => {
      const result = await swapExerciseAction({
        programSlug,
        dayNumber,
        programDayId,
        originalName,
        currentName,
        replacementName: choice.name,
        scope,
        workoutSessionId,
        source,
        currentSets: getCurrentSets?.(),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.sets) onSwapped?.(result.sets);
      close();
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setEquipment(weightAccess);
          setCategory("all");
          setOpen(true);
        }}
        data-swap={currentName}
        className="inline-flex min-h-8 items-center rounded-full border border-line px-2.5 text-xs font-semibold"
      >
        Swap
      </button>
      {open ? (
        <div className="fixed inset-0 z-40 flex flex-col bg-background text-foreground">
          <header className="flex items-center gap-2 border-b border-line px-4 py-3">
            <button type="button" onClick={close} className="touch-target text-2xl leading-none" aria-label="Close">
              ×
            </button>
            <div className="min-w-0 flex-1">
              <p className="font-display text-xs uppercase tracking-wide text-accent">Swap</p>
              <p className="truncate text-sm">{currentName}</p>
            </div>
          </header>
          <div className="space-y-3 border-b border-line px-4 py-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search exercises"
              aria-label="Search exercises"
              className="w-full rounded-xl border border-line bg-background px-3 py-3 text-base"
              autoFocus
            />
            <div className="flex gap-2" role="group" aria-label="Equipment">
              {(
                [
                  ["gym", "Gym"],
                  ["none", "No weights"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setEquipment(id)}
                  className={`min-h-9 flex-1 rounded-full text-sm font-semibold ${
                    equipment === id ? "bg-accent text-black" : "border border-line"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Category">
              {CATEGORY_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setCategory(filter.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                    category === filter.id ? "bg-accent text-black" : "border border-line"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {results.length === 0 ? (
              <li className="px-4 py-6 text-sm text-muted">No exercises match that search.</li>
            ) : (
              results.map((exercise) => {
                const selected = picked === exercise.name;
                return (
                  <li key={exercise.name} className="border-b border-line">
                    <button
                      type="button"
                      onClick={() => setPicked(exercise.name)}
                      className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left ${
                        selected ? "bg-accent text-black" : ""
                      }`}
                    >
                      <span>
                        <span className="block font-semibold">{exercise.name}</span>
                        <span className={`mt-0.5 block text-xs ${selected ? "text-black/70" : "text-muted"}`}>
                          {categoryLabel(exercise.category)}
                          {exercise.equipment === "none" ? " · No weights" : exercise.equipment === "both" ? " · Gym or floor" : " · Gym"}
                        </span>
                      </span>
                      <span className={`shrink-0 text-xs ${selected ? "text-black/80" : "text-muted"}`}>
                        {plannedSetLine({
                          sets: exercise.sets,
                          reps: exercise.reps,
                          restSeconds: exercise.restSeconds,
                          logMode: exercise.logMode,
                          name: exercise.name,
                          loadText: exercise.loadText,
                        })}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          {choice ? (
            <div className="space-y-2 border-t border-line bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <p className="text-sm">
                <span className="font-semibold">{choice.name}</span>
                <span className="text-muted">
                  {" "}
                  keeps a prescription that fits it. Same kind of work holds onto today&apos;s sets, RIR, and rest.
                </span>
              </p>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => confirm("session")}
                  className="touch-target flex-1 rounded-full border border-line text-sm font-semibold disabled:opacity-60"
                >
                  This session
                </button>
                <button
                  type="button"
                  disabled={pending || !programSlug}
                  onClick={() => confirm("block")}
                  className="touch-target flex-1 rounded-full bg-accent text-sm font-semibold text-black disabled:opacity-60"
                >
                  Rest of the block
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
