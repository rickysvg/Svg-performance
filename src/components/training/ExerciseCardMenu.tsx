"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { anchorPopover } from "@/lib/popover-anchor";
import { swapExerciseAction } from "@/app/actions/exercise-swap";
import {
  removeExerciseAction,
  undoExerciseRemovalAction,
} from "@/app/actions/exercise-removal";
import {
  CATEGORY_FILTERS,
  categoryLabel,
  filterExerciseLibrary,
  libraryExercise,
} from "@/lib/exercise-library";
import { plannedSetLine } from "@/lib/exercise-log-mode";
import { cleanSwapName, swapAlreadyInWorkoutMessage } from "@/lib/exercise-swap";
import type { WorkoutSet } from "@prisma/client";
import type { WorkoutSetInput } from "@/lib/workouts";
import { showRemoveToast } from "@/components/training/RemoveToast";

type Source = {
  sets: number;
  reps: string;
  loadText: string;
  restSeconds: number;
  logMode?: string;
  notes?: string;
};

export function ExerciseCardMenu({
  programSlug,
  dayNumber,
  programDayId,
  originalName,
  currentName,
  source,
  weightAccess,
  workoutSessionId,
  canRemove,
  getCurrentSets,
  onSetsReplaced,
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
  canRemove: boolean;
  getCurrentSets?: () => WorkoutSetInput[];
  onSetsReplaced?: (sets: WorkoutSet[], focusName?: string, updatedAt?: string | null) => void;
  onSwapped?: (
    name: string,
    prescription: {
      sets: number;
      reps: string;
      loadText: string;
      restSeconds: number;
      logMode: string;
      notes: string;
    },
  ) => void;
}) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const confirmRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!picked) return;
    confirmRef.current?.scrollIntoView({ block: "nearest" });
  }, [picked]);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointer(event: PointerEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [menuOpen]);

  useLayoutEffect(() => {
    if (!menuOpen) return;
    function place() {
      const button = buttonRef.current;
      const panel = panelRef.current;
      if (!button || !panel) return;
      const next = anchorPopover(
        button.getBoundingClientRect(),
        { width: panel.offsetWidth || 176, height: panel.offsetHeight || 96 },
        { width: window.innerWidth, height: window.innerHeight },
      );
      setMenuPos((current) =>
        current && current.left === next.left && current.top === next.top ? current : next,
      );
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [menuOpen]);

  function closeSheet() {
    setOpen(false);
    setPicked(null);
    setError("");
    setQuery("");
  }

  function applySets(sets: WorkoutSet[] | null, focusName?: string, updatedAt?: string | null) {
    if (sets && onSetsReplaced) onSetsReplaced(sets, focusName, updatedAt);
    else router.refresh();
  }

  function confirm(scope: "session" | "block") {
    if (!choice) return;
    const replacementName = choice.name;
    const currentSets = getCurrentSets?.() ?? [];
    const already = currentSets.some(
      (set) =>
        cleanSwapName(set.exerciseName) === cleanSwapName(replacementName) &&
        cleanSwapName(set.exerciseName) !== cleanSwapName(currentName),
    );
    setError("");
    startTransition(async () => {
      const result = await swapExerciseAction({
        programSlug,
        dayNumber,
        programDayId,
        originalName,
        currentName,
        replacementName,
        scope,
        workoutSessionId,
        source,
        currentSets,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      closeSheet();
      onSwapped?.(result.replacementName, result.prescription);
      applySets(result.sets, result.replacementName, result.updatedAt);
      if (already) {
        showRemoveToast({ message: swapAlreadyInWorkoutMessage(result.replacementName) });
      }
    });
  }

  function remove() {
    if (!canRemove || pending) return;
    setError("");
    startTransition(async () => {
      const result = await removeExerciseAction({
        programSlug,
        dayNumber,
        programDayId,
        originalName,
        exerciseName: currentName,
        workoutSessionId,
        currentSets: getCurrentSets?.(),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMenuOpen(false);
      applySets(result.sets);
      const removalId = result.removalId;
      showRemoveToast({
        message: `Removed ${currentName}.`,
        undo: async () => {
          const restored = await undoExerciseRemovalAction({
            removalId,
            programDayId,
            workoutSessionId,
            currentSets: getCurrentSets?.(),
          });
          if (!restored.ok) {
            showRemoveToast({ message: restored.error });
            return;
          }
          applySets(restored.sets);
        },
      });
    });
  }

  return (
    <>
      <div ref={menuRef} className="relative shrink-0">
        <button
          ref={buttonRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`Options for ${currentName}`}
          data-exercise-menu={currentName}
          disabled={pending}
          onClick={() => {
            setError("");
            setMenuPos(null);
            setMenuOpen((value) => !value);
          }}
          className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-full border border-line px-2.5 text-xs font-semibold disabled:opacity-60"
        >
          ···
        </button>
        {menuOpen && typeof document !== "undefined"
          ? createPortal(
          <div
            ref={panelRef}
            role="menu"
            aria-label={`Options for ${currentName}`}
            data-exercise-menu-panel
            style={{
              position: "fixed",
              top: menuPos?.top ?? 0,
              left: menuPos?.left ?? 0,
              visibility: menuPos ? "visible" : "hidden",
              width: "11rem",
            }}
            className="z-50 w-44 max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border border-line bg-card shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              data-swap={currentName}
              onClick={() => {
                setEquipment(weightAccess);
                setCategory("all");
                setMenuOpen(false);
                setOpen(true);
              }}
              className="flex min-h-11 w-full items-center px-3 text-left text-sm font-semibold"
            >
              Swap
            </button>
            <button
              type="button"
              role="menuitem"
              data-remove-exercise={currentName}
              disabled={!canRemove || pending}
              onClick={remove}
              className="flex min-h-11 w-full items-center border-t border-line px-3 text-left text-sm font-semibold disabled:text-muted"
            >
              Remove
            </button>
            {!canRemove ? (
              <p className="border-t border-line px-3 py-2 text-xs text-muted">
                Keep at least one exercise.
              </p>
            ) : null}
            {error ? <p className="px-3 pb-2 text-xs text-red-600">{error}</p> : null}
          </div>,
          document.body,
        )
          : null}
      </div>
      {open && typeof document !== "undefined"
        ? createPortal(
        <div
          className="fixed inset-0 z-[80] flex flex-col overflow-hidden bg-background text-foreground"
          data-swap-sheet={currentName}
        >
          <header className="flex items-center gap-2 border-b border-line px-4 py-3">
            <button type="button" onClick={closeSheet} className="touch-target text-2xl leading-none" aria-label="Close">
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
              data-swap-confirm
              className="shrink-0 space-y-2 border-t border-line bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            >
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
                  data-swap-scope="session"
                  onClick={() => confirm("session")}
                  className="touch-target flex-1 rounded-full bg-accent text-sm font-semibold text-black disabled:opacity-60"
                >
                  This session
                </button>
                <button
                  type="button"
                  disabled={pending || !programSlug}
                  data-swap-scope="block"
                  onClick={() => confirm("block")}
                  className="touch-target flex-1 rounded-full border border-line text-sm font-semibold disabled:opacity-60"
                >
                  Rest of the block
                </button>
              </div>
            </div>
          ) : null}
        </div>,
        document.body,
        )
        : null}
    </>
  );
}
