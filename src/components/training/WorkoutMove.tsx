"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  moveWorkoutAction,
  restoreWeekPlanAction,
  swapCalendarDaysAction,
} from "@/app/actions/week-plan";
import type { MoveDayChoice } from "@/lib/week-plan";

type OpenMove = {
  sessionKey: string;
  fromWeekday: string;
  title: string;
};

type WorkoutMoveContextValue = {
  editable: boolean;
  open: (target: OpenMove) => void;
  swapDays: (fromDay: string, toDay: string) => void;
};

const WorkoutMoveContext = createContext<WorkoutMoveContextValue | null>(null);

export function useWorkoutMove() {
  return useContext(WorkoutMoveContext);
}

const HOLD_MS = 450;
const SCROLL_CANCEL_PX = 10;

export function WorkoutMoveProvider({
  editable,
  weekStart,
  days,
  children,
}: {
  editable: boolean;
  weekStart: string;
  days: MoveDayChoice[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<OpenMove | null>(null);
  const [mode, setMode] = useState<"move" | "swap">("move");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; undo: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    if (pending) return;
    setTarget(null);
    setError(null);
    setMode("move");
  }

  function finish(message: string, undo?: string) {
    setTarget(null);
    setMode("move");
    setError(null);
    if (undo) setToast({ message, undo });
    router.refresh();
  }

  function commitMove(sessionKey: string, toDay: string, message: string) {
    setError(null);
    startTransition(async () => {
      const result = await moveWorkoutAction(sessionKey, toDay, weekStart);
      if (result.error) {
        setError(result.error);
        return;
      }
      finish(message, result.undo);
    });
  }

  function commitSwap(fromDay: string, toDay: string) {
    setError(null);
    startTransition(async () => {
      const result = await swapCalendarDaysAction(fromDay, toDay, weekStart);
      if (result.error) {
        setError(result.error);
        return;
      }
      finish(`Swapped ${fromDay} and ${toDay}.`, result.undo);
    });
  }

  function undo() {
    if (!toast || pending) return;
    const payload = toast.undo;
    setToast(null);
    startTransition(async () => {
      const result = await restoreWeekPlanAction(payload);
      if (result.error) {
        setToast({ message: result.error, undo: payload });
        return;
      }
      setToast(null);
      router.refresh();
    });
  }

  const today = days.find((day) => day.isToday);

  return (
    <WorkoutMoveContext.Provider
      value={{
        editable,
        open: (next) => {
          setMode("move");
          setError(null);
          setTarget(next);
        },
        swapDays: (fromDay, toDay) => commitSwap(fromDay, toDay),
      }}
    >
      {children}
      {target ? (
        <div className="fixed inset-0 z-50 flex items-end" data-workout-move-sheet>
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close move"
            onClick={close}
          />
          <div
            role="dialog"
            aria-label={`Move ${target.title}`}
            className="relative max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-card px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-foreground"
          >
            <p className="font-display text-xs uppercase tracking-wide text-accent">Move</p>
            <h2 className="mt-1 text-lg leading-tight">{target.title}</h2>
            <p className="mt-1 text-sm text-muted">On {target.fromWeekday} this week.</p>
            {today && target.fromWeekday !== today.weekday ? (
              <button
                type="button"
                data-move-today
                disabled={pending}
                onClick={() => commitMove(target.sessionKey, today.weekday, "Moved to today.")}
                className="mt-4 flex min-h-11 w-full items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-black disabled:opacity-60"
              >
                Do today
              </button>
            ) : null}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                data-move-to
                aria-pressed={mode === "move"}
                onClick={() => setMode("move")}
                className={`min-h-11 rounded-full px-3 text-sm font-semibold ${
                  mode === "move" ? "bg-black text-white" : "border border-line"
                }`}
              >
                Move to…
              </button>
              <button
                type="button"
                data-swap-with
                aria-pressed={mode === "swap"}
                onClick={() => setMode("swap")}
                className={`min-h-11 rounded-full px-3 text-sm font-semibold ${
                  mode === "swap" ? "bg-black text-white" : "border border-line"
                }`}
              >
                Swap with…
              </button>
            </div>
            <ul className="mt-3 space-y-2">
              {days.map((day) => {
                const current = day.weekday === target.fromWeekday;
                const blocked = mode === "move" && day.isPast && !day.isToday;
                const disabled = pending || current || blocked;
                return (
                  <li key={`${mode}-${day.weekday}`}>
                    <button
                      type="button"
                      data-move-day={mode === "move" ? day.weekday : undefined}
                      data-swap-day={mode === "swap" ? day.weekday : undefined}
                      disabled={disabled}
                      onClick={() => {
                        if (mode === "swap") {
                          commitSwap(target.fromWeekday, day.weekday);
                          return;
                        }
                        commitMove(
                          target.sessionKey,
                          day.weekday,
                          `Moved to ${day.weekday}.`,
                        );
                      }}
                      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border border-line px-3 py-2 text-left disabled:opacity-45"
                    >
                      <span className="min-w-0">
                        <span className="block font-semibold">{day.label}</span>
                        <span className="block truncate text-sm text-muted">{day.detail}</span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted">
                        {current ? "Here" : blocked ? "Past" : mode === "swap" ? "Swap" : "Move"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {error ? <p className="mt-3 text-sm text-muted">{error}</p> : null}
            <button
              type="button"
              onClick={close}
              disabled={pending}
              className="mt-3 min-h-11 w-full rounded-full border border-line text-sm font-semibold disabled:opacity-60"
            >
              {pending ? "Saving…" : "Cancel"}
            </button>
          </div>
        </div>
      ) : null}
      {toast ? (
        <div
          data-move-toast
          role="status"
          className="fixed inset-x-4 z-50 flex items-center justify-between gap-3 rounded-2xl bg-black px-4 py-3 text-white shadow-lg"
          style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
        >
          <p className="text-sm">{toast.message}</p>
          {toast.undo ? (
            <button
              type="button"
              data-move-undo
              onClick={undo}
              disabled={pending}
              className="inline-flex min-h-11 shrink-0 items-center font-semibold text-highlighter disabled:opacity-60"
            >
              Undo
            </button>
          ) : null}
        </div>
      ) : null}
    </WorkoutMoveContext.Provider>
  );
}

export function WorkoutMoveButton({
  sessionKey,
  fromWeekday,
  title,
}: {
  sessionKey: string;
  fromWeekday: string;
  title: string;
}) {
  const move = useWorkoutMove();
  if (!move || !move.editable) return null;
  return (
    <button
      type="button"
      data-move-workout
      className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-accent px-3 text-sm font-semibold text-black"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        move.open({ sessionKey, fromWeekday, title });
      }}
    >
      Move
    </button>
  );
}

/** Long-press opens Move. A short tap still follows the link. */
export function HoldToMove({
  sessionKey,
  fromWeekday,
  title,
  children,
}: {
  sessionKey: string;
  fromWeekday: string;
  title: string;
  children: ReactNode;
}) {
  const move = useWorkoutMove();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startY = useRef(0);
  const ignoreClick = useRef(false);
  if (!move || !move.editable) return <>{children}</>;

  function clearTimer() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  return (
    <div
      data-hold-move={sessionKey}
      style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        ignoreClick.current = false;
        startY.current = event.clientY;
        clearTimer();
        timer.current = setTimeout(() => {
          timer.current = null;
          ignoreClick.current = true;
          move.open({ sessionKey, fromWeekday, title });
        }, HOLD_MS);
      }}
      onPointerMove={(event) => {
        if (!timer.current) return;
        if (Math.abs(event.clientY - startY.current) > SCROLL_CANCEL_PX) clearTimer();
      }}
      onPointerUp={clearTimer}
      onPointerCancel={clearTimer}
      onContextMenu={(event) => {
        event.preventDefault();
        clearTimer();
        ignoreClick.current = true;
        move.open({ sessionKey, fromWeekday, title });
      }}
      onClickCapture={(event) => {
        if (!ignoreClick.current) return;
        event.preventDefault();
        event.stopPropagation();
        ignoreClick.current = false;
      }}
    >
      {children}
    </div>
  );
}
