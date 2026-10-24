"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import {
  moveWorkoutAction,
  restoreWeekPlanAction,
  swapCalendarDaysAction,
  swapWorkoutAction,
} from "@/app/actions/week-plan";
import type { MoveDayChoice, MoveSessionChoice } from "@/lib/week-plan";
import { Toast } from "@/components/Toast";
import { onSheetBackdropMouseDown, useSheetBehavior } from "@/components/useSheetBehavior";
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
  /** Session key → weekday while a move is ahead of the server list. */
  placements: Record<string, string>;
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
  onCommitted,
  children,
}: {
  editable: boolean;
  weekStart: string;
  days: MoveDayChoice[];
  /** Parent refreshes the list. Undo stays available while that refresh is in flight. */
  onCommitted?: () => void;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const swapSessionTestId = pathname.startsWith("/training/calendar")
    ? "workout-move-session-btn-2"
    : "workout-move-session-btn";
  const [target, setTarget] = useState<OpenMove | null>(null);
  const [mode, setMode] = useState<"move" | "swap">("move");
  const [error, setError] = useState<string | null>(null);
  const [caution, setCaution] = useState<PendingCaution | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string; undo: string } | null>(null);
  const toastSerial = useRef(0);
  const [saving, setSaving] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const placementsRef = useRef<Record<string, string>>({});
  const placementStack = useRef<{ key: string; from: string }[][]>([]);

  function rememberPlacements(next: Record<string, string>, undo: { key: string; from: string }[]) {
    placementStack.current.push(undo);
    placementsRef.current = next;
    setPlacements(next);
  }

  function sittingWeekday(sessionKey: string) {
    const over = placementsRef.current[sessionKey];
    if (over) return over;
    return days.find((day) => day.sessions.some((session) => session.sessionKey === sessionKey))?.weekday;
  }

  function placeSession(sessionKey: string, weekday: string) {
    const from = sittingWeekday(sessionKey);
    if (!from || from === weekday) return;
    rememberPlacements({ ...placementsRef.current, [sessionKey]: weekday }, [{ key: sessionKey, from }]);
  }

  function placeDaySwap(fromDay: string, toDay: string) {
    const next = { ...placementsRef.current };
    const undo: { key: string; from: string }[] = [];
    for (const day of days) {
      for (const session of day.sessions) {
        const sitting = sittingWeekday(session.sessionKey);
        if (sitting === fromDay) {
          next[session.sessionKey] = toDay;
          undo.push({ key: session.sessionKey, from: sitting });
        } else if (sitting === toDay) {
          next[session.sessionKey] = fromDay;
          undo.push({ key: session.sessionKey, from: sitting });
        }
      }
    }
    if (undo.length > 0) rememberPlacements(next, undo);
  }

  function close() {
    if (saving) return;
    setTarget(null);
    setError(null);
    setCaution(null);
    setMode("move");
  }
  const panelRef = useSheetBehavior(close, Boolean(target));

  function finish(message: string, undo?: string) {
    setTarget(null);
    setMode("move");
    setError(null);
    setCaution(null);
    if (undo) setToast({ id: ++toastSerial.current, message, undo });
  }

  async function commitMove(sessionKey: string, toDay: string, message: string) {
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      const result = await moveWorkoutAction(sessionKey, toDay, weekStart);
      if (result.error) {
        setError(result.error);
        return;
      }
      placeSession(sessionKey, toDay);
      finish(message, result.undo);
      onCommitted?.();
    } finally {
      setSaving(false);
    }
  }

  async function commitSwap(fromDay: string, toDay: string) {
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      const result = await swapCalendarDaysAction(fromDay, toDay, weekStart);
      if (result.error) {
        setError(result.error);
        return;
      }
      placeDaySwap(fromDay, toDay);
      finish(`Swapped ${fromDay} and ${toDay}.`, result.undo);
      onCommitted?.();
    } finally {
      setSaving(false);
    }
  }

  async function commitSessionSwap(otherKey: string, otherTitle: string) {
    if (!target || saving) return;
    setError(null);
    setSaving(true);
    try {
      const result = await swapWorkoutAction(target.sessionKey, otherKey, weekStart);
      if (result.error) {
        setError(result.error);
        return;
      }
      const from = sittingWeekday(target.sessionKey) ?? target.fromWeekday;
      const otherDay = days.find((day) => day.sessions.some((session) => session.sessionKey === otherKey));
      const otherFrom = sittingWeekday(otherKey) ?? otherDay?.weekday;
      if (otherFrom && from) {
        rememberPlacements(
          {
            ...placementsRef.current,
            [target.sessionKey]: otherFrom,
            [otherKey]: from,
          },
          [
            { key: target.sessionKey, from },
            { key: otherKey, from: otherFrom },
          ],
        );
      }
      finish(`Swapped with ${otherTitle}.`, result.undo);
      onCommitted?.();
    } finally {
      setSaving(false);
    }
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

  async function undo() {
    if (!toast || undoing) return;
    const payload = toast.undo;
    setToast(null);
    setUndoing(true);
    try {
      const result = await restoreWeekPlanAction(payload);
      if (result.error) {
        setToast({ id: ++toastSerial.current, message: result.error, undo: payload });
        return;
      }
      const previous = placementStack.current.pop();
      if (previous) {
        const next = { ...placementsRef.current };
        for (const step of previous) next[step.key] = step.from;
        placementsRef.current = next;
        setPlacements(next);
      }
      onCommitted?.();
    } finally {
      setUndoing(false);
    }
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
  const pending = saving || undoing;

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
        placements,
      }}
    >
      {children}
      {pending ? (
        <div
          role="status"
          data-plan-pending
          className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-black px-4 py-3 text-sm font-semibold text-white"
        >
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-[#CBF805]"
            aria-hidden
          />
          Updating the week…
        </div>
      ) : null}
      {target ? (
        <div
          className="fixed inset-0 z-50 flex items-end overflow-x-hidden bg-black/50"
          data-workout-move-sheet
          data-testid="training-move-sheet"
          onMouseDown={(event) => onSheetBackdropMouseDown(event, close)}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Move ${target.title}`}
            tabIndex={-1}
            className="relative max-h-[85vh] w-full max-w-full overflow-x-hidden overflow-y-auto rounded-t-3xl bg-card px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-foreground outline-none"
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
                  disabled={saving}
                  onClick={() => requestMove(today.weekday, "Moved to today.")}
                  className="flex min-h-11 w-full items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-black disabled:opacity-60"
                >
                  Do today
                </button>
              ) : null}
                <button
                data-testid="training-move-to-another-day"
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
                data-testid="training-swap-with-a-session"
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
                    data-testid="training-move-anyway"
                    type="button"
                    data-move-anyway
                    disabled={saving}
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
                    disabled={saving}
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
                    const disabled = saving || current || blocked;
                    return (
                      <li key={day.weekday}>
                        <button
                          data-testid={`training-move-day-${day.weekday}`}
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
                          data-testid={`${swapSessionTestId}-${session.sessionKey.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}`}
                          data-swap-session={session.sessionKey}
                          disabled={saving || blocked}
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
              data-testid="workout-move-cancel"
              onClick={close}
              disabled={saving}
              className="mt-3 min-h-11 w-full rounded-full border border-line text-sm font-semibold disabled:opacity-60"
            >
              {saving ? "Saving…" : "Cancel"}
            </button>
          </div>
        </div>
      ) : null}
      {toast ? (
        <Toast
          closeTestId="training-move-toast-close"
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
                  disabled: undoing,
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
      data-testid="training-move"
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
      data-testid="training-hold-move"
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
