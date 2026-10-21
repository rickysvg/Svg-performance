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
  swapWorkoutAction,
} from "@/app/actions/week-plan";
import type { MoveDayChoice, MoveSessionChoice } from "@/lib/week-plan";
import { Toast } from "@/components/Toast";
import { REMOVE_TOAST_MS } from "@/components/training/RemoveToast";
import { futureWorkoutPulledBack, sessionMoveCaution } from "@/lib/week-plan-swaps";

type OpenMove = {
  sessionKey: string;
  fromWeekday: string;
  title: string;
  heavy: boolean;
};

type PendingCaution = {
  message: string;
  run: () => void;
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
  const [caution, setCaution] = useState<PendingCaution | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string; undo: string } | null>(null);
  const toastSerial = useRef(0);
  const [pending, startTransition] = useTransition();

  function close() {
    if (pending) return;
    setTarget(null);
    setError(null);
    setCaution(null);
    setMode("move");
  }

  function finish(message: string, undo?: string) {
    setTarget(null);
    setMode("move");
    setError(null);
    setCaution(null);
    if (undo) setToast({ id: ++toastSerial.current, message, undo });
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

  function commitSessionSwap(otherKey: string, otherTitle: string) {
    if (!target) return;
    setError(null);
    startTransition(async () => {
      const result = await swapWorkoutAction(target.sessionKey, otherKey, weekStart);
      if (result.error) {
        setError(result.error);
        return;
      }
      finish(`Swapped with ${otherTitle}.`, result.undo);
    });
  }

  function landingCaution(heavy: boolean, day: MoveDayChoice) {
    return sessionMoveCaution({
      heavy,
      outside: day.outside,
      beforeSparring: day.beforeSparring,
      dayName: day.weekday,
    });
  }

  function guarded(note: string | null, run: () => void) {
    if (!note) {
      setCaution(null);
      run();
      return;
    }
    setCaution({ message: note, run });
  }

  function requestMove(toDay: string, message: string) {
    if (!target) return;
    const day = days.find((item) => item.weekday === toDay);
    guarded(day ? landingCaution(target.heavy, day) : null, () =>
      commitMove(target.sessionKey, toDay, message),
    );
  }

  function requestSessionSwap(session: MoveSessionChoice, day: MoveDayChoice) {
    if (!target) return;
    const home = days.find((item) => item.weekday === target.fromWeekday);
    const outbound = landingCaution(target.heavy, day);
    const inbound = home ? landingCaution(session.heavy, home) : null;
    const note =
      outbound && inbound && outbound !== inbound ? `${outbound} ${inbound}` : outbound ?? inbound;
    guarded(note, () => commitSessionSwap(session.sessionKey, session.title));
  }

  function undo() {
    if (!toast || pending) return;
    const payload = toast.undo;
    setToast(null);
    startTransition(async () => {
      const result = await restoreWeekPlanAction(payload);
      if (result.error) {
        setToast({ id: ++toastSerial.current, message: result.error, undo: payload });
        return;
      }
      setToast(null);
      router.refresh();
    });
  }

  const today = days.find((day) => day.isToday);
  const todayName = today?.weekday ?? null;
  const fromDay = target ? days.find((day) => day.weekday === target.fromWeekday) : undefined;
  const swapLocked = Boolean(fromDay && fromDay.isPast && !fromDay.isToday);
  const swapTargets = target
    ? days.flatMap((day) =>
        day.sessions
          .filter((session) => session.sessionKey !== target.sessionKey && day.weekday !== target.fromWeekday)
          .map((session) => ({ day, session })),
      )
    : [];

  return (
    <WorkoutMoveContext.Provider
      value={{
        editable,
        open: (next) => {
          setMode("move");
          setError(null);
          setCaution(null);
          setTarget(next);
        },
        swapDays: (fromDay, toDay) => commitSwap(fromDay, toDay),
      }}
    >
      {children}
      {target ? (
        <div className="fixed inset-0 z-50 flex items-end overflow-x-hidden" data-workout-move-sheet>
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close move"
            onClick={close}
          />
          <div
            role="dialog"
            aria-label={`Move ${target.title}`}
            className="relative max-h-[85vh] w-full max-w-full overflow-x-hidden overflow-y-auto rounded-t-3xl bg-card px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-foreground"
          >
            <p className="font-display text-xs uppercase tracking-wide text-accent">This session</p>
            <h2 className="mt-1 text-lg leading-tight">{target.title}</h2>
            <p className="mt-1 text-sm text-muted">
              On {target.fromWeekday}. The other sessions that day stay put. Workouts are
              interchangeable through the week.
            </p>
            <div aria-label={`Move ${target.title}`} className="mt-4 space-y-2">
              {today &&
              target.fromWeekday !== today.weekday &&
              !futureWorkoutPulledBack(target.sessionKey, today.weekday, todayName) ? (
                <button
                  type="button"
                  data-move-today
                  disabled={pending}
                  onClick={() => requestMove(today.weekday, "Moved to today.")}
                  className="flex min-h-11 w-full items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-black disabled:opacity-60"
                >
                  Do today
                </button>
              ) : null}
                <button
                type="button"
                data-move-to
                aria-pressed={mode === "move"}
                onClick={() => {
                  setCaution(null);
                  setMode("move");
                }}
                className={`min-h-11 w-full rounded-full px-3 text-sm font-semibold ${
                  mode === "move" ? "bg-black text-white" : "border border-line"
                }`}
              >
                Move to another day
              </button>
                <button
                type="button"
                data-swap-with
                aria-pressed={mode === "swap"}
                onClick={() => {
                  setCaution(null);
                  setMode("swap");
                }}
                className={`min-h-11 w-full rounded-full px-3 text-sm font-semibold ${
                  mode === "swap" ? "bg-black text-white" : "border border-line"
                }`}
              >
                Swap with a session
              </button>
            </div>
            {caution ? (
              <div data-move-caution className="mt-3 rounded-2xl bg-black px-4 py-3 text-white">
                <p className="text-sm">{caution.message}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-move-anyway
                    disabled={pending}
                    onClick={() => {
                      const run = caution.run;
                      setCaution(null);
                      run();
                    }}
                    className="inline-flex min-h-11 items-center rounded-full bg-accent px-4 text-sm font-semibold text-black disabled:opacity-60"
                  >
                    Move anyway
                  </button>
                  <button
                    type="button"
                    data-move-dismiss
                    disabled={pending}
                    onClick={() => setCaution(null)}
                    className="inline-flex min-h-11 items-center rounded-full border border-white/40 px-4 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Not now
                  </button>
                </div>
              </div>
            ) : null}
            {mode === "swap" && swapLocked ? (
              <p className="mt-3 text-sm text-muted">
                Swap needs two days from today on. Use Move to put this missed session on today
                or a later day.
              </p>
            ) : null}
            <ul className="mt-3 space-y-2">
              {mode === "move"
                ? days.map((day) => {
                    const current = day.weekday === target.fromWeekday;
                    const pastDay = day.isPast && !day.isToday;
                    const blocked =
                      pastDay || futureWorkoutPulledBack(target.sessionKey, day.weekday, todayName);
                    const disabled = pending || current || blocked;
                    return (
                      <li key={day.weekday}>
                        <button
                          type="button"
                          data-move-day={day.weekday}
                          disabled={disabled}
                          onClick={() => requestMove(day.weekday, `Moved to ${day.weekday}.`)}
                          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border border-line px-3 py-2 text-left disabled:opacity-45"
                        >
                          <span className="min-w-0">
                            <span className="block font-semibold">{day.label}</span>
                            <span className="block truncate text-sm text-muted">{day.detail}</span>
                          </span>
                          <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted">
                            {current ? "Here" : pastDay ? "Past" : "Move"}
                          </span>
                        </button>
                      </li>
                    );
                  })
                : swapTargets.map(({ day, session }) => {
                    const blocked =
                      swapLocked ||
                      (day.isPast && !day.isToday) ||
                      session.completed ||
                      futureWorkoutPulledBack(target.sessionKey, day.weekday, todayName) ||
                      futureWorkoutPulledBack(session.sessionKey, target.fromWeekday, todayName);
                    const label = session.completed ? "Done" : day.isPast && !day.isToday ? "Past" : "Swap";
                    return (
                      <li key={session.sessionKey}>
                        <button
                          type="button"
                          data-swap-session={session.sessionKey}
                          disabled={pending || blocked}
                          onClick={() => requestSessionSwap(session, day)}
                          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border border-line px-3 py-2 text-left disabled:opacity-45"
                        >
                          <span className="min-w-0">
                            <span className="block font-semibold">{session.title}</span>
                            <span className="block truncate text-sm text-muted">{day.label}</span>
                          </span>
                          <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted">
                            {label}
                          </span>
                        </button>
                      </li>
                    );
                  })}
            </ul>
            {mode === "swap" && !swapLocked && swapTargets.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No other session to swap with this week.</p>
            ) : null}
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
        <Toast
          key={toast.id}
          message={toast.message}
          tone="dark"
          durationMs={REMOVE_TOAST_MS}
          onDismiss={() => setToast(null)}
          attrs={{ "data-move-toast": "" }}
          action={
            toast.undo
              ? {
                  label: "Undo",
                  attrs: { "data-move-undo": "" },
                  disabled: pending,
                  onClick: undo,
                }
              : undefined
          }
        />
      ) : null}
    </WorkoutMoveContext.Provider>
  );
}

export function WorkoutMoveButton({
  sessionKey,
  fromWeekday,
  title,
  heavy = false,
}: {
  sessionKey: string;
  fromWeekday: string;
  title: string;
  heavy?: boolean;
}) {
  const move = useWorkoutMove();
  if (!move || !move.editable) return null;
  return (
    <button
      type="button"
      data-move-workout
      data-session-menu
      aria-haspopup="menu"
      className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-accent px-3 text-sm font-semibold text-black"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        move.open({ sessionKey, fromWeekday, title, heavy });
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
  heavy = false,
  children,
}: {
  sessionKey: string;
  fromWeekday: string;
  title: string;
  heavy?: boolean;
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
          move.open({ sessionKey, fromWeekday, title, heavy });
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
        move.open({ sessionKey, fromWeekday, title, heavy });
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
