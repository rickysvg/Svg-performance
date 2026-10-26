"use client";

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useSheetBehavior } from "@/components/useSheetBehavior";
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
  suggestions = [],
  scope = "session",
  allowBlock = true,
  onScope,
  onQuickPick,
  onClose,
  closeTestId = "training-library-close",
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
  suggestions?: LibraryExercise[];
  scope?: "session" | "block";
  allowBlock?: boolean;
  onScope?: (scope: "session" | "block") => void;
  /** One tap applies the current scope. Search below still opens the confirm footer. */
  onQuickPick?: (choice: LibraryExercise) => void;
  onClose: () => void;
  closeTestId?: string;
  footer: (choice: LibraryExercise) => ReactNode;
}) {
  const confirmRef = useRef<HTMLDivElement>(null);
  const panelRef = useSheetBehavior(onClose);
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

  useLayoutEffect(() => {
    if (!picked) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
    const footer = confirmRef.current;
    if (!footer) return;
    footer.scrollTop = footer.scrollHeight;
    footer
      .querySelector<HTMLElement>("[data-swap-scope='session']")
      ?.scrollIntoView({ block: "end", inline: "nearest" });
  }, [picked]);

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
      data-testid={variant === "swap" ? "training-swap-sheet" : "training-add-sheet"}
      className="fixed inset-0 z-[80] flex h-dvh max-h-[100dvh] w-full max-w-[100vw] min-h-0 flex-col overflow-x-hidden overflow-y-hidden bg-background text-foreground outline-none"
      {...(variant === "swap"
        ? { "data-swap-sheet": sheetName ?? "" }
        : { "data-add-sheet": "true" })}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-3">
        <button type="button" data-testid={closeTestId} onClick={onClose} className="touch-target text-2xl leading-none" aria-label="Close">
          ×
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xs uppercase tracking-wide text-accent">{title}</p>
          {subtitle ? <p className="truncate text-sm">{subtitle}</p> : null}
        </div>
      </header>
      {variant === "swap" && suggestions.length > 0 ? (
        <div className="shrink-0 space-y-3 border-b border-line bg-black px-4 py-3" data-best-replacements>
          <p className="font-display text-xs uppercase tracking-wide text-[#CBF805]">Best replacements</p>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Swap applies to" data-swap-scope-picker>
            <button
              type="button"
              data-swap-scope="session"
              aria-pressed={scope === "session"}
              onClick={() => onScope?.("session")}
              className={`min-h-11 rounded-full text-sm font-semibold ${
                scope === "session" ? "bg-[#CBF805] text-black" : "border border-line text-white"
              }`}
            >
              This session
            </button>
            <button
              type="button"
              data-swap-scope="block"
              aria-pressed={scope === "block"}
              disabled={!allowBlock || pending}
              onClick={() => onScope?.("block")}
              className={`min-h-11 rounded-full text-sm font-semibold disabled:opacity-40 ${
                scope === "block" ? "bg-[#CBF805] text-black" : "border border-line text-white"
              }`}
            >
              Rest of the block
            </button>
          </div>
          <ul className="space-y-2">
            {suggestions.map((exercise, index) => (
              <li key={exercise.name}>
                <button
                  type="button"
                  data-best-replacement={exercise.name}
                  disabled={pending}
                  onClick={() => onQuickPick?.(exercise)}
                  className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left disabled:opacity-60 ${
                    index === 0 ? "bg-[#CBF805] text-black" : "border border-[#CBF805]/50 bg-black text-white"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">{exercise.name}</span>
                    <span className={`mt-0.5 block text-xs ${index === 0 ? "text-black/70" : "text-white/60"}`}>
                      {categoryLabel(exercise.category)}
                    </span>
                  </span>
                  <span className={`shrink-0 text-xs ${index === 0 ? "text-black/80" : "text-[#CBF805]"}`}>
                    {index === 0 ? "Best" : "Swap"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="shrink-0 space-y-3 border-b border-line px-4 py-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault();
          }}
          placeholder="Search exercises"
          aria-label="Search exercises"
          enterKeyHint="search"
          className="w-full rounded-xl border border-line bg-black px-3 py-3 text-base text-white"
          autoFocus={suggestions.length === 0}
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
              data-testid={`training-library-equipment-${id}`}
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
              data-testid={`training-library-category-${filter.id}`}
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
      <ul className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
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
                  className={`flex w-full min-w-0 items-start justify-between gap-3 px-4 py-3 text-left ${
                    selected ? "bg-accent text-black" : ""
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">{exercise.name}</span>
                    <span className={`mt-0.5 block text-xs ${selected ? "text-black/70" : "text-muted"}`}>
                      {categoryLabel(exercise.category)}
                      {exercise.equipment === "none" ? " · No weights" : exercise.equipment === "both" ? " · Gym or floor" : " · Gym"}
                    </span>
                  </span>
                  <span className={`max-w-[46%] shrink text-right text-xs whitespace-normal ${selected ? "text-black/80" : "text-muted"}`}>
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
          className="sticky bottom-0 z-10 max-h-[46dvh] shrink-0 space-y-2 overflow-y-auto border-t border-line bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className={pending ? "pointer-events-none opacity-60" : undefined}>{footer(choice)}</div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
