"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { anchorPopover } from "@/lib/popover-anchor";
import { swapExerciseAction } from "@/app/actions/exercise-swap";
import {
  removeExerciseAction,
  undoExerciseRemovalAction,
} from "@/app/actions/exercise-removal";
import type { LibraryExercise } from "@/lib/exercise-library";
import { cleanSwapName, swapAlreadyInWorkoutMessage } from "@/lib/exercise-swap";
import type { WorkoutSet } from "@prisma/client";
import type { WorkoutSetInput } from "@/lib/workouts";
import { ExerciseLibrarySheet } from "@/components/training/ExerciseLibrarySheet";
import { showRemoveToast } from "@/components/training/RemoveToast";

function removalSetInput(set: WorkoutSet): WorkoutSetInput {
  return {
    exerciseName: set.exerciseName,
    setNumber: set.setNumber,
    reps: set.reps,
    loadValue: set.loadValue,
    loadUnit: "lb",
    logMode: (set.logMode || undefined) as WorkoutSetInput["logMode"],
    durationSeconds: set.durationSeconds,
    completed: set.completed,
    notes: set.notes ?? "",
    prescriptionKey: set.prescriptionKey ?? "",
    rir: set.rir ?? "",
  };
}

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
  snapshotSets,
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
  snapshotSets?: () => WorkoutSet[];
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
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

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
    setError("");
  }

  function applySets(sets: WorkoutSet[] | null, focusName?: string, updatedAt?: string | null) {
    if (sets && onSetsReplaced) onSetsReplaced(sets, focusName, updatedAt);
    else router.refresh();
  }

  function confirm(scope: "session" | "block", choice: LibraryExercise) {
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
    const before = snapshotSets?.().map((set) => ({ ...set })) ?? null;
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
      const removedSets = result.sets?.map(removalSetInput);
      showRemoveToast({
        message: `Removed ${currentName}.`,
        undo: async () => {
          if (before) applySets(before);
          const restored = await undoExerciseRemovalAction({
            removalId,
            programDayId,
            workoutSessionId,
            currentSets: removedSets ?? getCurrentSets?.(),
          });
          if (!restored.ok) {
            applySets(result.sets);
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
      {open && typeof document !== "undefined" ? (
        <ExerciseLibrarySheet
          variant="swap"
          sheetName={currentName}
          title="Swap"
          subtitle={currentName}
          weightAccess={weightAccess}
          excludeName={currentName}
          nearName={currentName}
          pending={pending}
          error={error}
          onClose={closeSheet}
          footer={(choice) => (
            <>
              <p className="text-sm">
                <span className="font-semibold">{choice.name}</span>
                <span className="text-muted">
                  {" "}
                  keeps a prescription that fits it. Same kind of work holds onto today&apos;s sets, RIR, and rest.
                </span>
              </p>
              <div className="flex gap-2" data-swap-confirm>
                <button
                  type="button"
                  disabled={pending}
                  data-swap-scope="session"
                  onClick={() => confirm("session", choice)}
                  className="touch-target flex-1 rounded-full bg-accent text-sm font-semibold text-black disabled:opacity-60"
                >
                  This session
                </button>
                <button
                  type="button"
                  disabled={pending || !programSlug}
                  data-swap-scope="block"
                  onClick={() => confirm("block", choice)}
                  className="touch-target flex-1 rounded-full border border-line text-sm font-semibold disabled:opacity-60"
                >
                  Rest of the block
                </button>
              </div>
            </>
          )}
        />
      ) : null}
    </>
  );
}
