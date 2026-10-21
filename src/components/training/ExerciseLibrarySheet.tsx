"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  CATEGORY_FILTERS,
  categoryLabel,
  filterExerciseLibrary,
  libraryExercise,
  type LibraryExercise,
} from "@/lib/exercise-library";
import { plannedSetLine } from "@/lib/exercise-log-mode";

/**
 * The member swap picker. Hidden library rows (unreviewed or untrimmed clips)
 * stay out. Add-exercise uses the same list.
 */
export function ExerciseLibrarySheet({
  variant,
  sheetName,
  title,
  subtitle,
  weightAccess,
  excludeName,
  nearName,
  pending = false,
  error = "",
  onClose,
  footer,
}: {
  variant: "swap" | "add";
  sheetName?: string;
  title: string;
  subtitle?: string;
  weightAccess: "gym" | "none";
  excludeName?: string;
  nearName?: string;
  pending?: boolean;
  error?: string;
  onClose: () => void;
  footer: (choice: LibraryExercise) => ReactNode;
}) {
  const confirmRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORY_FILTERS)[number]["id"]>("all");
  const [equipment, setEquipment] = useState<"gym" | "none">(weightAccess);
  const [picked, setPicked] = useState<string | null>(null);

  const results = useMemo(
    () =>
      filterExerciseLibrary({
        query,
        category,
        equipment,
        excludeName,
        nearName,
      }),
    [query, category, equipment, excludeName, nearName],
  );
  const choice = picked ? libraryExercise(picked) : null;

  useEffect(() => {
    if (!choice) return;
    confirmRef.current?.scrollIntoView({ block: "nearest" });
  }, [choice]);

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex flex-col overflow-hidden bg-background text-foreground"
      {...(variant === "swap"
        ? { "data-swap-sheet": sheetName ?? "" }
        : { "data-add-sheet": "true" })}
    >
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <button type="button" onClick={onClose} className="touch-target text-2xl leading-none" aria-label="Close">
          ×
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xs uppercase tracking-wide text-accent">{title}</p>
          {subtitle ? <p className="truncate text-sm">{subtitle}</p> : null}
        </div>
      </header>
      <div className="space-y-3 border-b border-line px-4 py-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault();
          }}
          placeholder="Search exercises"
          aria-label="Search exercises"
          enterKeyHint="search"
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
        <div className="no-scrollbar flex max-w-full min-w-0 gap-2 overflow-x-auto pb-1" role="group" aria-label="Category">
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
                  data-library-choice={exercise.name}
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
        <div
          ref={confirmRef}
          data-library-confirm
          className="shrink-0 space-y-2 border-t border-line bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className={pending ? "pointer-events-none opacity-60" : undefined}>{footer(choice)}</div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
