"use client";

import Link from "next/link";
import { Fragment, useActionState, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { saveWorkoutAction, type WorkoutActionState } from "@/app/actions/workouts";
import { primeUnlockAudio } from "@/lib/badge-sfx";
import { holdMediaRoute, primeMediaOutput } from "@/lib/media-output";
import { syncWorkoutDraftAction } from "@/app/actions/workouts";
import { StatusBanner } from "@/components/StatusBanner";
import { memberFacingTitle } from "@/lib/member-copy";
import { ExerciseThumb } from "@/components/training/ExerciseThumb";
import { BikeSetTimer } from "@/components/training/BikeSetTimer";
import { bikeSessionForLogger, isBikeIntervalName } from "@/lib/bike-sessions";
import { CoachCredit } from "@/components/training/CoachCredit";
import { creditForExercise } from "@/lib/coach-credits";
import { BagFocusList } from "@/components/training/BagFocusList";
import { bagFocusLines } from "@/lib/bag-themes";
import { RirHint } from "@/components/training/RirHint";
import { hasRirCue } from "@/lib/rir";
import { bikeIntervalCompletionEffects } from "@/lib/bike-interval-timer";
import { releaseSetWakeLock, requestSetWakeLock } from "@/lib/bike-interval-signals";
import { lookupFormVideo, showFormVideoPending } from "@/lib/form-videos";
import { plannedSetLine, prescribedRestSeconds, previousSetLabel, restBannerSeconds } from "@/lib/exercise-media";
import {
  countLabel,
  hidesLoad,
  isDurationMode,
  loggerCardLine,
  loggerRowLayout,
  modeColumnLabel,
  modeHint,
  prescribedLbLabel,
  resolveLogMode,
  type LogMode,
} from "@/lib/exercise-log-mode";
import {
  loggerCursor,
  loggerProgressDetail,
  orderWorkoutSets,
  timedRoundMarkAllowed,
} from "@/lib/logger-progress";
import {
  addRestSeconds,
  clockNow,
  formatRestClock,
  formatRestPill,
  isRestActive,
  primeRestAudio,
  readRestNow,
  remainingRestSeconds,
  restAfterExerciseChange,
  restCueForTick,
  signalRestComplete,
  signalRestWarning,
  startRestTimer,
  type RestTimerState,
} from "@/lib/rest-timer";
import { nextIncompleteSetId } from "@/lib/logger-progress";
import { fieldEnterFinishesWorkout } from "@/lib/workout-form-submit";
import { APP_TIMEZONE, formatDateTimeLocal } from "@/lib/timezone";
import { restoreLoggerSets } from "@/lib/logger-sets";
import { gymExerciseKey } from "@/lib/gym-exercise";
import { setHasLoggedWork } from "@/lib/logged-work";
import {
  applyPreviousToSet,
  copyPreviousOntoExercise,
  restTimerAfterSetDone,
} from "@/lib/logger-prefill";
import {
  activeRest,
  clearLoggerDraft,
  createLoggerHydrationStore,
  readLoggerDraft,
  writeLoggerDraft,
  type DraftSetSnapshot,
  type LoggerDraft,
} from "@/lib/logger-draft";
import { prescriptionSlotKey } from "@/lib/prescription-slot";
import type { PreviousSetLookup } from "@/lib/workouts";
import type { WorkoutSession, WorkoutSet } from "@prisma/client";
import { ExerciseNotepad } from "@/components/training/ExerciseNotepad";
import { ExerciseCardMenu } from "@/components/training/ExerciseCardMenu";
import { ExerciseLibrarySheet } from "@/components/training/ExerciseLibrarySheet";
import { SaveWorkoutButton } from "@/components/training/SaveWorkoutButton";
import { RemoveToast } from "@/components/training/RemoveToast";
import { libraryExercise, type LibraryExercise } from "@/lib/exercise-library";
import {
  addedPrescriptionKey,
  draftsForLibraryExercise,
  insertSetsAtExercise,
  libraryBaseName,
  moveExercise,
  parseAddedPlan,
  removeExerciseSets,
} from "@/lib/logger-insert";
import { defaultSavedWorkoutName, exercisesFromLoggerGroups } from "@/lib/my-workout-plan";
import { rirFromLoadText } from "@/lib/rir";
import type { ExerciseNoteView } from "@/lib/exercise-notes";
import type { SwapSlot } from "@/lib/exercise-swap";
import { convertLoad, roundLoadForInput } from "@/lib/units";
import { WorkoutCoachCues } from "@/components/training/WorkoutCoachCues";
import { COACH_WORKOUT_MOTIVATION_ENABLED } from "@/lib/coach/config";
import type { MotivationView } from "@/lib/coach/motivation";
import type { WorkoutSetInput } from "@/lib/workouts";

type Session = WorkoutSession & {
  sets: WorkoutSet[];
  programDay?: {
    title: string;
    exercises: {
      name: string;
      sets: number;
      reps: string;
      restSeconds: number;
      logMode?: string;
      notes?: string;
      loadText?: string;
      formVideoUrl: string;
      formVideoPending: boolean;
    }[];
  } | null;
};

function toDateInput(value: Date | string, timeZone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatDateTimeLocal(date, timeZone);
}

function setsInLb(sets: WorkoutSet[]): WorkoutSet[] {
  return orderWorkoutSets(sets).map((set) => {
    if (set.loadUnit !== "kg") {
      return { ...set, loadUnit: "lb" };
    }
    return {
      ...set,
      loadUnit: "lb",
      loadValue:
        set.loadValue == null ? null : roundLoadForInput(convertLoad(set.loadValue, "kg", "lb")),
    };
  });
}

function newClientSet(
  sessionId: string,
  exerciseName: string,
  setNumber: number,
  loadUnit: string,
  logMode: LogMode = "timed",
  durationSeconds: number | null = null,
  id = `local-${crypto.randomUUID()}`,
): WorkoutSet {
  return {
    id,
    workoutSessionId: sessionId,
    exerciseName,
    setNumber,
    sortOrder: 0,
    reps: null,
    loadValue: null,
    loadUnit: loadUnit === "kg" ? "lb" : loadUnit || "lb",
    logMode,
    durationSeconds,
    completed: false,
    notes: "",
    prescriptionKey: prescriptionSlotKey({ exerciseName }),
    rir: "",
  };
}

function toSetInput(set: WorkoutSet): WorkoutSetInput {
  return {
    exerciseName: set.exerciseName,
    setNumber: set.setNumber,
    reps: set.reps,
    loadValue: set.loadValue,
    loadUnit: "lb",
    logMode: resolveLogMode({ logMode: set.logMode, name: set.exerciseName }),
    durationSeconds: set.durationSeconds,
    completed: set.completed,
    notes: set.notes,
    prescriptionKey: set.prescriptionKey,
    rir: set.rir,
  };
}

function swapSource(
  name: string,
  group: WorkoutSet[],
  planned:
    | {
        sets: number;
        reps: string;
        restSeconds: number;
        loadText?: string;
        notes?: string;
        logMode?: string;
      }
    | undefined,
  restSeconds: number,
  mode: LogMode,
  slots: SwapSlot[] | undefined,
) {
  const slot = slots?.find((row) => row.currentName === name);
  if (slot) {
    return {
      sets: slot.sets,
      reps: slot.reps,
      loadText: slot.loadText,
      restSeconds: slot.restSeconds,
      logMode: slot.logMode,
      notes: slot.notes,
    };
  }
  return {
    sets: planned?.sets ?? Math.max(1, group.length),
    reps: planned?.reps ?? "",
    loadText: planned?.loadText ?? "",
    restSeconds: planned?.restSeconds ?? restSeconds,
    logMode: planned?.logMode ?? mode,
    notes: planned?.notes ?? "",
  };
}

function prescribedRowId(sessionId: string, exerciseName: string, setNumber: number) {
  return `prescribed-${sessionId}-${exerciseName}-${setNumber}`;
}

function setsForLogger(session: Session, draft: LoggerDraft | null = null): WorkoutSet[] {
  const base = setsInLb(session.sets);
  const prescriptions = session.programDay?.exercises ?? [];
  return restoreLoggerSets(
    base,
    draft,
    prescriptions.map((row) => ({ name: row.name, sets: row.sets })),
    (exerciseName, setNumber) => {
      const planned = prescriptions.find(
        (row) => gymExerciseKey(row.name) === gymExerciseKey(exerciseName),
      );
      const name = planned?.name ?? exerciseName;
      const mode = resolveLogMode({
        logMode: planned?.logMode,
        name,
        reps: planned?.reps,
      });
      return newClientSet(
        session.id,
        name,
        setNumber,
        "lb",
        mode,
        null,
        prescribedRowId(session.id, name, setNumber),
      );
    },
    gymExerciseKey,
  );
}

const SAVE_FAILED =
  "Could not save this workout. Your entries are still on this phone. Tap Retry.";

function isNextRedirect(error: unknown) {
  if (typeof error !== "object" || error === null || !("digest" in error)) return false;
  return String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT");
}

async function saveWorkoutWithNotice(
  prev: WorkoutActionState,
  formData: FormData,
): Promise<WorkoutActionState> {
  try {
    return await saveWorkoutAction(prev, formData);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    return { error: SAVE_FAILED };
  }
}

function toDraftSet(set: WorkoutSet): DraftSetSnapshot {
  return {
    exerciseName: set.exerciseName,
    setNumber: set.setNumber,
    reps: set.reps,
    loadValue: set.loadValue,
    loadUnit: set.loadUnit,
    logMode: set.logMode,
    durationSeconds: set.durationSeconds,
    completed: set.completed,
    notes: set.notes,
    prescriptionKey: set.prescriptionKey,
    rir: set.rir,
  };
}

function previousChipClass(hasPrevious: boolean) {
  return hasPrevious
    ? "flex h-11 w-full items-center whitespace-nowrap rounded-lg bg-accent px-2 text-left text-sm font-semibold leading-none text-black"
    : "flex h-11 w-full items-center whitespace-nowrap rounded-lg px-1 text-left text-sm leading-none text-muted";
}

function serverRest(session: { restExerciseName: string; restEndsAt: Date | null }, now = Date.now()): RestTimerState | null {
  if (!session.restEndsAt || !session.restExerciseName) return null;
  const endsAtMs = new Date(session.restEndsAt).getTime();
  return activeRest(
    {
      exerciseName: session.restExerciseName,
      endsAtMs,
      durationSeconds: Math.max(1, Math.ceil((endsAtMs - now) / 1000)),
    },
    now,
  );
}

function SessionTimer({ startedAtMs }: { startedAtMs: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = window.setInterval(tick, 1000);
    const onWake = () => tick();
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, []);
  const seconds = Math.max(0, Math.floor((now - startedAtMs) / 1000));
  return (
    <span className="tabular-nums text-sm text-muted" data-session-elapsed={seconds}>
      {formatRestClock(seconds)}
    </span>
  );
}

export function WorkoutLogForm({
  session,
  previousLoads = {},
  notes = {},
  swap,
  coachId = "skye",
  coachMotivation = true,
  timeZone = APP_TIMEZONE,
}: {
  session: Session;
  previousLoads?: PreviousSetLookup;
  notes?: Record<string, ExerciseNoteView>;
  coachId?: string;
  coachMotivation?: boolean;
  timeZone?: string;
  swap?: {
    programSlug: string;
    dayNumber: number;
    weightAccess: "gym" | "none";
    slots: SwapSlot[];
    retiredNames: string[];
    removedNames?: string[];
  };
}) {
  const [activeName, setActiveName] = useState<string | null>(null);
  const [restByName, setRestByName] = useState<Record<string, number>>({});
  const [swapOverlay, setSwapOverlay] = useState<
    Record<
      string,
      {
        sets: number;
        reps: string;
        loadText: string;
        restSeconds: number;
        logMode: string;
        notes: string;
      }
    >
  >({});
  const [state, action, pending] = useActionState(
    saveWorkoutWithNotice,
    {} as WorkoutActionState,
  );
  const [sets, setSets] = useState(() => setsForLogger(session));
  const [showNotes, setShowNotes] = useState(Boolean(session.notes));
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const [addedNames, setAddedNames] = useState<Set<string>>(() => new Set());
  const [moreOpen, setMoreOpen] = useState(false);
  const [restTimer, setRestTimer] = useState<RestTimerState | null>(null);
  const [restGo, setRestGo] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [appliedPhase, setAppliedPhase] = useState<"server" | "client">("server");
  const formRef = useRef<HTMLFormElement>(null);
  const saveErrorRef = useRef<HTMLDivElement>(null);
  const setsRef = useRef<WorkoutSet[]>([]);
  const pendingRef = useRef(false);
  const syncChain = useRef(Promise.resolve());
  const draftBaseRef = useRef(new Date(session.updatedAt).toISOString());
  const scrolled = useRef(false);
  const routeRelease = useRef<(() => void) | null>(null);
  const wakeLock = useRef<{ release: () => Promise<void> | void } | null>(null);
  const [hydrationStore] = useState(() => createLoggerHydrationStore(session.id));
  const hydration = useSyncExternalStore(
    hydrationStore.subscribe,
    hydrationStore.getSnapshot,
    hydrationStore.getServerSnapshot,
  );

  if (hydration.phase === "client" && appliedPhase !== "client") {
    setAppliedPhase("client");
    if (session.status !== "complete") {
      const draft = hydration.draft;
      const hidden = new Set([...(swap?.retiredNames ?? []), ...(swap?.removedNames ?? [])]);
      const visibleDraft =
        draft && hidden.size > 0
          ? { ...draft, sets: draft.sets.filter((set) => !hidden.has(set.exerciseName)) }
          : draft;
      setSets(setsForLogger(session, visibleDraft));
      setRestTimer(
        draft ? activeRest(draft.rest, hydration.nowMs) : serverRest(session, hydration.nowMs),
      );
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, WorkoutSet[]>();
    for (const set of sets) {
      const list = map.get(set.exerciseName) ?? [];
      list.push(set);
      map.set(set.exerciseName, list);
    }
    return [...map.entries()];
  }, [sets]);

  const cursor = useMemo(
    () =>
      loggerCursor(
        grouped.map(([name, group]) => ({
          name,
          sets: group.map((set) => ({ id: set.id, completed: set.completed })),
        })),
      ),
    [grouped],
  );
  const currentPlanned = session.programDay?.exercises.find(
    (row) => row.name === cursor.exerciseName,
  );
  const currentGroup = grouped.find(([name]) => name === cursor.exerciseName)?.[1];
  const currentMode = resolveLogMode({
    logMode: currentGroup?.[0]?.logMode ?? currentPlanned?.logMode,
    name: cursor.exerciseName,
    reps: currentPlanned?.reps,
  });
  const groupKey = grouped.map(([name]) => name).join("\u0000");
  useEffect(() => {
    const form = formRef.current;
    if (!form || typeof IntersectionObserver === "undefined") return;
    const blocks = [...form.querySelectorAll<HTMLElement>("[data-exercise-block]")];
    if (blocks.length === 0) return;
    const ratios = new Map<Element, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        let best: Element | null = null;
        let bestRatio = 0;
        for (const [element, ratio] of ratios) {
          if (ratio > bestRatio) {
            best = element;
            bestRatio = ratio;
          }
        }
        const name = best instanceof HTMLElement ? best.dataset.exerciseBlock : "";
        if (name) setActiveName(name);
      },
      { threshold: [0.2, 0.45, 0.7], rootMargin: "-18% 0px -42% 0px" },
    );
    for (const block of blocks) observer.observe(block);
    return () => observer.disconnect();
  }, [groupKey]);

  function restForName(name: string, plannedRest: number | undefined, mode: LogMode) {
    return prescribedRestSeconds({
      override: restByName[name],
      slot: swap?.slots.find((row) => row.currentName === name)?.restSeconds,
      planned: plannedRest,
      fallback: isBikeIntervalName(name) ? 60 : mode === "timed_round" ? 90 : 60,
    });
  }

  const currentRestSeconds = cursor.done
    ? 0
    : restForName(cursor.exerciseName, currentPlanned?.restSeconds, currentMode);
  const checkedCount = currentGroup?.filter((set) => set.completed).length ?? 0;
  const firstRirName = session.programDay?.exercises.find((row) => hasRirCue(row.loadText))?.name;

  const defaultUnit = "lb";
  const loadHeader = "Lbs";
  const cancelHref = session.programDayId
    ? `/training/${session.programDayId}`
    : "/training";
  const restRemaining = remainingRestSeconds(restTimer, nowMs);
  const restRunning = isRestActive(restTimer, nowMs);
  const motivationView = useMemo<MotivationView>(() => {
    return {
      restRemaining: restRunning ? restRemaining : null,
      restActive: restRunning,
      restKey: restTimer ? `${restTimer.exerciseName}:${restTimer.endsAtMs}` : "",
      groups: grouped.map(([name, group]) => {
        const planned = session.programDay?.exercises.find((row) => row.name === name);
        return {
          name,
          logMode: resolveLogMode({
            logMode: group[0]?.logMode ?? planned?.logMode,
            name,
            reps: planned?.reps,
          }),
          previousLoad: null,
          sets: group.map((set) => ({
            id: set.id,
            completed: set.completed,
            loadValue: set.loadValue,
            rir: set.rir ?? "",
            previousLoad: previousLoads[name]?.[set.setNumber]?.loadValue ?? null,
          })),
        };
      }),
    };
  }, [grouped, previousLoads, restRemaining, restRunning, restTimer, session.programDay]);

  function remember(nextSets: WorkoutSet[], nextRest: RestTimerState | null) {
    if (session.status === "complete") return;
    writeLoggerDraft({
      version: 1,
      sessionId: session.id,
      savedAt: Date.now(),
      sets: nextSets.map(toDraftSet),
      rest: nextRest,
    });
  }

  function syncDraft(nextSets: WorkoutSet[], nextRest: RestTimerState | null) {
    if (session.status === "complete") return;
    const form = formRef.current;
    const title =
      form?.querySelector<HTMLTextAreaElement>("[data-workout-title]")?.value || session.title;
    const performedAt =
      form?.querySelector<HTMLInputElement>('[name="performedAt"]')?.value ||
      toDateInput(session.performedAt, timeZone);
    const notesField = form?.querySelector<HTMLTextAreaElement>('[name="notes"]');
    const notes = notesField ? notesField.value : session.notes;
    const payload = {
      workoutId: session.id,
      title,
      performedAt,
      notes,
      baseUpdatedAt: draftBaseRef.current,
      rest: nextRest
        ? { exerciseName: nextRest.exerciseName, endsAtMs: nextRest.endsAtMs }
        : null,
      sets: nextSets.map((set) => ({
        exerciseName: set.exerciseName,
        setNumber: set.setNumber,
        reps: set.reps,
        loadValue: set.loadValue,
        loadUnit: set.loadUnit === "kg" ? "lb" : (set.loadUnit as "lb"),
        logMode: resolveLogMode({ logMode: set.logMode, name: set.exerciseName }),
        durationSeconds: set.durationSeconds,
        completed: set.completed,
        notes: set.notes,
        prescriptionKey: set.prescriptionKey,
        rir: set.rir,
      })),
    };
    syncChain.current = syncChain.current
      .then(() => syncWorkoutDraftAction(payload))
      .then((result) => {
        if (result.ok) draftBaseRef.current = result.updatedAt;
      })
      .catch(() => undefined);
  }

  useEffect(() => {
    setsRef.current = sets;
  }, [sets]);

  useEffect(() => {
    const incoming = new Date(session.updatedAt).getTime();
    if (Number.isNaN(incoming)) return;
    const current = new Date(draftBaseRef.current).getTime();
    if (incoming > current) draftBaseRef.current = new Date(incoming).toISOString();
  }, [session.updatedAt]);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    void fetch("/api/session/touch", { method: "POST" }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!state.error) return;
    saveErrorRef.current?.scrollIntoView({ block: "center" });
  }, [state.error]);

  function discardIfEmpty() {
    if (pendingRef.current || session.status === "complete") return;
    if (setsRef.current.some(setHasLoggedWork)) return;
    const stored = readLoggerDraft(session.id);
    if (stored?.sets.some(setHasLoggedWork)) return;
    clearLoggerDraft(session.id);
    const body = JSON.stringify({ workoutId: session.id });
    void fetch("/api/workouts/discard-empty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  }

  useEffect(() => {
    const onHide = () => discardIfEmpty();
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
    // discardIfEmpty reads the latest refs. session id is the discard target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id, session.status]);

  useEffect(() => {
    if (appliedPhase !== "client") return;
    if (session.status === "complete") {
      clearLoggerDraft(session.id);
      return;
    }
    if (!scrolled.current) {
      scrolled.current = true;
      const resting =
        restTimer && remainingRestSeconds(restTimer) > 0 ? restTimer.exerciseName : "";
      const restingBlock = resting
        ? formRef.current?.querySelector<HTMLElement>(
            `[data-exercise-block="${typeof CSS !== "undefined" && CSS.escape ? CSS.escape(resting) : resting}"]`,
          )
        : null;
      if (restingBlock) {
        restingBlock.scrollIntoView({ block: "center" });
      } else {
        const focus = sets.find((set) => !set.completed);
        if (focus) {
          const escaped = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(focus.id) : focus.id;
          formRef.current
            ?.querySelector<HTMLElement>(`[data-set-row="${escaped}"]`)
            ?.scrollIntoView({ block: "center" });
        }
      }
    }
    const handle = window.setTimeout(() => {
      remember(sets, restTimer);
      if (sets.some((set) => set.completed) || restTimer) {
        syncDraft(sets, restTimer);
      }
    }, 400);
    return () => window.clearTimeout(handle);
    // remember/syncDraft close over the latest form fields on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedPhase, sets, restTimer, session.status, session.id]);

  useEffect(() => {
    if (!moreOpen) return;
    document.querySelector("[data-session-overflow]")?.scrollIntoView({ block: "nearest" });
  }, [moreOpen]);

  function engageRestRoute() {
    primeMediaOutput();
    routeRelease.current?.();
    routeRelease.current = holdMediaRoute();
    void requestSetWakeLock().then((lock) => {
      if (wakeLock.current && wakeLock.current !== lock) releaseSetWakeLock(wakeLock.current);
      wakeLock.current = lock;
    });
  }

  function disengageRestRoute() {
    const release = routeRelease.current;
    routeRelease.current = null;
    release?.();
    releaseSetWakeLock(wakeLock.current);
    wakeLock.current = null;
  }

  useEffect(() => {
    const node = formRef.current;
    if (!node) return;
    const onPointer = () => primeMediaOutput();
    node.addEventListener("pointerdown", onPointer);
    return () => node.removeEventListener("pointerdown", onPointer);
  }, []);

  useEffect(() => {
    return () => {
      routeRelease.current?.();
      routeRelease.current = null;
      releaseSetWakeLock(wakeLock.current);
      wakeLock.current = null;
    };
  }, []);

  useEffect(() => {
    if (!restTimer) return;
    let prev = remainingRestSeconds(restTimer, clockNow());
    if (restCueForTick(null, prev) === "warning") signalRestWarning();
    let ended = false;
    const finish = (cue: ReturnType<typeof restCueForTick>) => {
      if (ended) return;
      if (cue === "warning") signalRestWarning();
      if (cue !== "complete") return;
      ended = true;
      signalRestComplete();
      setRestGo(true);
      setRestTimer(null);
      disengageRestRoute();
      window.setTimeout(() => setRestGo(false), 900);
    };
    const sample = () => {
      const now = Date.now();
      const next = remainingRestSeconds(restTimer, now);
      const cue = restCueForTick(prev, next);
      prev = next;
      setNowMs(now);
      finish(cue);
    };
    const tick = window.setInterval(sample, 200);
    const onVisible = () => {
      if (document.visibilityState === "visible") sample();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [restTimer]);

  function updateSet(id: string, patch: Partial<WorkoutSet>) {
    const name = sets.find((set) => set.id === id)?.exerciseName;
    if (name) setActiveName(name);
    setSets((current) =>
      current.map((set) => (set.id === id ? { ...set, ...patch } : set)),
    );
  }

  function commitSets(next: WorkoutSet[]) {
    setsRef.current = next;
    setSets(next);
    remember(next, restTimer);
    syncDraft(next, restTimer);
  }

  function addSet(exerciseName: string) {
    const current = setsRef.current;
    const group = current.filter((set) => set.exerciseName === exerciseName);
    const unit = group[0]?.loadUnit ?? defaultUnit;
    const planned = session.programDay?.exercises.find((row) => row.name === exerciseName);
    const mode = resolveLogMode({
      logMode: group[0]?.logMode ?? planned?.logMode,
      name: exerciseName,
      reps: planned?.reps,
    });
    const created = {
      ...newClientSet(session.id, exerciseName, group.length + 1, unit, mode),
      prescriptionKey:
        group[0]?.prescriptionKey || prescriptionSlotKey({ exerciseName, reps: planned?.reps }),
      rir: group[0]?.rir ?? "",
    };
    const last = current.findLastIndex((set) => set.exerciseName === exerciseName);
    const next =
      last < 0
        ? [...current, created]
        : [...current.slice(0, last + 1), created, ...current.slice(last + 1)];
    commitSets(next);
  }

  function markDone(
    setId: string,
    exerciseName: string,
    restSeconds: number,
    completed: boolean,
  ) {
    const target = sets.find((set) => set.id === setId);
    const mode = resolveLogMode({ logMode: target?.logMode, name: exerciseName });
    if (
      !timedRoundMarkAllowed({
        mode,
        markingDone: completed,
        durationSeconds: target?.durationSeconds,
      })
    ) {
      return;
    }
    setActiveName(exerciseName);
    const nextSets = sets.map((set) => (set.id === setId ? { ...set, completed } : set));
    setSets(nextSets);
    let nextRest = restTimer;
    if (completed) {
      primeRestAudio();
      primeUnlockAudio();
      const started = restTimerAfterSetDone({
        completed,
        exerciseName,
        restSeconds,
      });
      if (started) {
        nextRest = started;
        setRestGo(false);
        setNowMs(clockNow());
        engageRestRoute();
        setRestTimer(started);
      }
    }
    remember(nextSets, nextRest);
    if (completed) syncDraft(nextSets, nextRest);
    if (!completed) return;
    const nextId = nextIncompleteSetId(nextSets, setId);
    if (!nextId) return;
    const escaped = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(nextId) : nextId;
    requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLElement>(`[data-set-field="${escaped}"]`)?.focus();
    });
  }

  function beginRest() {
    if (!cursor.exerciseName || currentRestSeconds <= 0 || restRunning) return;
    primeRestAudio();
    primeMediaOutput();
    setRestGo(false);
    engageRestRoute();
    commitRest(startRestTimer(cursor.exerciseName, currentRestSeconds, readRestNow()));
  }

  function commitRest(next: RestTimerState | null) {
    setNowMs(readRestNow());
    primeMediaOutput();
    if (!next || remainingRestSeconds(next) <= 0) {
      if (next) {
        signalRestComplete();
        setRestGo(true);
        window.setTimeout(() => setRestGo(false), 900);
      }
      disengageRestRoute();
      setRestTimer(null);
      remember(sets, null);
      syncDraft(sets, null);
      return;
    }
    setRestTimer(next);
    remember(sets, next);
    syncDraft(sets, next);
  }

  function addFromLibrary(exercise: LibraryExercise) {
    const index = pickerIndex ?? grouped.length;
    const drafts = draftsForLibraryExercise(
      setsRef.current.map((set) => set.exerciseName),
      exercise,
    );
    if (drafts.length === 0) return;
    const incoming = drafts.map((draft) => ({
      ...newClientSet(
        session.id,
        draft.exerciseName,
        draft.setNumber,
        defaultUnit,
        resolveLogMode({ logMode: draft.logMode, name: draft.exerciseName, reps: draft.prescriptionReps }),
        draft.durationSeconds,
      ),
      reps: draft.reps,
      prescriptionKey: addedPrescriptionKey({
        exerciseName: draft.exerciseName,
        reps: draft.prescriptionReps,
        restSeconds: draft.restSeconds,
      }),
      rir: rirFromLoadText(exercise.loadText) ?? "",
    }));
    const name = drafts[0]!.exerciseName;
    setAddedNames((current) => new Set(current).add(name));
    setRestByName((current) => ({ ...current, [name]: drafts[0]!.restSeconds }));
    setSwapOverlay((current) => ({
      ...current,
      [name]: {
        sets: drafts.length,
        reps: exercise.reps,
        loadText: exercise.loadText,
        restSeconds: drafts[0]!.restSeconds,
        logMode: drafts[0]!.logMode,
        notes: exercise.notes,
      },
    }));
    setPickerIndex(null);
    setActiveName(name);
    commitSets(insertSetsAtExercise(setsRef.current, index, incoming));
    requestAnimationFrame(() => {
      const escaped = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(name) : name;
      formRef.current
        ?.querySelector<HTMLElement>(`[data-exercise-block="${escaped}"]`)
        ?.scrollIntoView({ block: "center" });
    });
  }

  function moveLoggedExercise(name: string, direction: "up" | "down") {
    commitSets(moveExercise(setsRef.current, name, direction));
  }

  function removeAddedExercise(name: string) {
    setAddedNames((current) => {
      const next = new Set(current);
      next.delete(name);
      return next;
    });
    commitSets(removeExerciseSets(setsRef.current, name));
  }

  function setAddedRest(name: string, raw: number) {
    const rest = Math.max(0, Math.min(600, Number.isFinite(raw) ? Math.round(raw) : 0));
    setRestByName((current) => ({ ...current, [name]: rest }));
    const next = setsRef.current.map((set) => {
      if (set.exerciseName !== name) return set;
      const plan = parseAddedPlan(set.prescriptionKey);
      return {
        ...set,
        prescriptionKey: addedPrescriptionKey({
          exerciseName: name,
          reps: plan?.reps ?? "",
          restSeconds: rest,
          loadText: plan?.loadText,
          notes: plan?.notes,
        }),
      };
    });
    commitSets(next);
  }

  const saveExercises = exercisesFromLoggerGroups(
    grouped.map(([name, group]) => {
      const overlay = swapOverlay[name];
      const stored = parseAddedPlan(group[0]?.prescriptionKey);
      const planned = session.programDay?.exercises.find(
        (row) => gymExerciseKey(row.name) === gymExerciseKey(name),
      );
      const mode = resolveLogMode({
        logMode: group[0]?.logMode ?? overlay?.logMode ?? planned?.logMode,
        name,
        reps: overlay?.reps || stored?.reps || planned?.reps,
      });
      return {
        name,
        restSeconds: restForName(
          name,
          overlay?.restSeconds ?? stored?.restSeconds ?? planned?.restSeconds,
          mode,
        ),
        planned: {
          reps: overlay?.reps || stored?.reps || planned?.reps || "",
          loadText: overlay?.loadText || stored?.loadText || planned?.loadText || "",
          notes: overlay?.notes || stored?.notes || planned?.notes || "",
          logMode: mode,
        },
        sets: group.map((set) => ({
          reps: set.reps,
          loadValue: set.loadValue,
          loadUnit: set.loadUnit,
          rir: set.rir,
          logMode: set.logMode,
          notes: set.notes,
          durationSeconds: set.durationSeconds,
        })),
      };
    }),
  );
  const saveDefaultName = defaultSavedWorkoutName({
    title: session.title,
    date: new Date(session.performedAt),
    timeZone,
  });

  return (
    <div>
      <RemoveToast />
      <form
        ref={formRef}
        action={action}
        className="space-y-5"
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;
          const inputType =
            target instanceof HTMLInputElement || target instanceof HTMLButtonElement
              ? target.type
              : null;
          if (!fieldEnterFinishesWorkout(target.tagName, inputType)) return;
          event.preventDefault();
        }}
      >
        <header
          data-logger-chrome
          className="sticky top-0 z-30 -mx-4 overflow-hidden border-b border-line bg-background pt-[env(safe-area-inset-top)] backdrop-blur md:top-[calc(env(safe-area-inset-top)+3.5rem)] md:z-10 md:pt-0"
        >
          <div className="flex items-center gap-2 px-4 py-2">
            <Link
              href={cancelHref}
              onClick={() => discardIfEmpty()}
              className="touch-target inline-flex items-center text-sm font-medium text-muted"
            >
              Cancel
            </Link>
            <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-center">
              {cursor.exerciseCount > 0 ? (
                <p data-logger-progress className="font-display text-sm uppercase leading-tight">
                  Exercise {cursor.exerciseIndex} of {cursor.exerciseCount}
                  <span className="mt-0.5 block text-xs" data-logger-detail>
                    {loggerProgressDetail({
                      mode: currentMode,
                      setIndex: cursor.setIndex,
                      setCount: cursor.setCount,
                      checked: checkedCount,
                    })}
                  </span>
                </p>
              ) : null}
              <SessionTimer startedAtMs={new Date(session.createdAt).getTime()} />
            </div>
            <div className="flex flex-col items-end">
              {COACH_WORKOUT_MOTIVATION_ENABLED ? (
                <WorkoutCoachCues
                  initialEnabled={coachMotivation}
                  coachId={coachId}
                  view={motivationView}
                />
              ) : null}
              <button
                type="button"
                onClick={() => setShowNotes((open) => !open)}
                className="touch-target text-sm font-medium underline-offset-4 hover:underline"
              >
                Notes
              </button>
              <button
                type="button"
                data-session-more
                onClick={() => setMoreOpen((open) => !open)}
                className="text-sm font-medium text-muted underline-offset-4 hover:underline"
              >
                More
              </button>
            </div>
          </div>
          {restGo ? (
            <div data-rest-complete className="bg-black px-4 py-3 text-white">
              <p className="font-display text-xs uppercase tracking-wide text-[#CBF805]">Rest over</p>
              <p className="font-display mt-1 text-2xl leading-none text-[#CBF805]">Go</p>
            </div>
          ) : null}
          {restRunning ? (
            <div
              data-rest-countdown
              data-rest-warning={restRemaining <= 3 ? "1" : undefined}
              className="mx-4 mb-3 flex items-center justify-between gap-2 rounded-xl bg-black px-3 py-2 text-white"
            >
              <div className="min-w-0">
                <p className="font-display text-[10px] uppercase tracking-wide text-highlighter">
                  Rest
                </p>
                {restRemaining <= 3 ? (
                  <p
                    data-rest-get-ready
                    className="font-display mt-1 text-[11px] uppercase tracking-[0.14em] text-[#CBF805]"
                  >
                    Get ready
                  </p>
                ) : null}
                <p
                  className={`font-display text-5xl leading-none tabular-nums text-[#CBF805] ${
                    restRemaining <= 3 ? "motion-safe:animate-pulse" : ""
                  }`}
                >
                  {formatRestClock(restRemaining)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  data-rest-minus
                  onClick={() => commitRest(restTimer ? addRestSeconds(restTimer, -15) : null)}
                  className="touch-target rounded-full border border-white/40 px-3 text-sm"
                >
                  −15s
                </button>
                <button
                  type="button"
                  data-rest-skip
                  onClick={() => commitRest(null)}
                  className="touch-target rounded-full border border-white/40 px-3 text-sm"
                >
                  Skip
                </button>
                <button
                  type="button"
                  data-rest-plus
                  onClick={() => commitRest(restTimer ? addRestSeconds(restTimer, 15) : null)}
                  className="touch-target rounded-full bg-accent px-3 text-sm text-black"
                >
                  +15s
                </button>
              </div>
            </div>
          ) : currentRestSeconds > 0 ? (
            <div className="px-4 pb-3">
              <button
                type="button"
                data-start-rest
                onClick={beginRest}
                className="touch-target min-h-14 w-full rounded-full bg-accent font-display text-base uppercase tracking-wide text-black"
              >
                Start rest {formatRestPill(currentRestSeconds)}
              </button>
            </div>
          ) : null}
        </header>

        <div className="space-y-2 pt-2">
          <label className="block">
            <span className="sr-only">Workout title</span>
            <textarea
              name="title"
              data-workout-title
              defaultValue={memberFacingTitle(session.title)}
              rows={2}
              className="font-display min-h-[3.4rem] w-full min-w-0 resize-none bg-transparent text-2xl leading-tight tracking-wide break-words whitespace-normal outline-none"
            />
          </label>
          {session.programDay?.title ? (
            <p className="text-sm text-muted">{memberFacingTitle(session.programDay.title)}</p>
          ) : null}
        </div>

        <StatusBanner error={state.error} success={state.success} />
        <input type="hidden" name="workoutId" value={session.id} />
        <input type="hidden" name="setCount" value={sets.length} />

        {showNotes ? (
          <div className="space-y-4 rounded-2xl border border-line bg-card p-4">
            <label className="block text-sm">
              <span className="text-muted">When</span>
              <input
                name="performedAt"
                type="datetime-local"
                defaultValue={toDateInput(session.performedAt, timeZone)}
                className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Notes</span>
              <textarea
                name="notes"
                defaultValue={session.notes}
                rows={3}
                className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
              />
            </label>
            <fieldset>
              <legend className="text-sm font-medium">Record HR (optional)</legend>
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
          </div>
        ) : (
          <>
            <input type="hidden" name="performedAt" defaultValue={toDateInput(session.performedAt, timeZone)} />
            <input type="hidden" name="notes" defaultValue={session.notes} />
          </>
        )}

        {grouped.map(([name, group], exerciseIndex) => {
          const form = lookupFormVideo(name, session.programDay?.exercises);
          const overlay = swapOverlay[name];
          const storedPlan = parseAddedPlan(group[0]?.prescriptionKey);
          const library =
            libraryExercise(name) ?? libraryExercise(libraryBaseName(name));
          const addedRest = restByName[name] ?? storedPlan?.restSeconds;
          const nameKey = gymExerciseKey(name);
          const added = addedNames.has(name) || Boolean(storedPlan);
          const addedPlan =
            added && (library || storedPlan)
              ? {
                  name,
                  sets: group.length,
                  reps: overlay?.reps || storedPlan?.reps || library?.reps || "",
                  loadText: overlay?.loadText || storedPlan?.loadText || library?.loadText || "",
                  restSeconds: addedRest ?? library?.restSeconds ?? 60,
                  logMode: overlay?.logMode || group[0]?.logMode || library?.logMode || "",
                  notes: overlay?.notes || storedPlan?.notes || library?.notes || "",
                  formVideoUrl: "",
                  formVideoPending: false,
                }
              : undefined;
          const plannedMatch = session.programDay?.exercises.find(
            (row) => gymExerciseKey(row.name) === nameKey,
          );
          const planned = plannedMatch ?? (overlay
            ? {
                name,
                sets: overlay.sets,
                reps: overlay.reps,
                loadText: overlay.loadText,
                restSeconds: overlay.restSeconds,
                logMode: overlay.logMode,
                notes: overlay.notes,
                formVideoUrl: "",
                formVideoPending: false,
              }
            : addedPlan);
          const title = planned?.name ?? name;
          const mode = resolveLogMode({
            logMode: group[0]?.logMode ?? planned?.logMode,
            name,
            reps: planned?.reps,
          });
          const bike = isBikeIntervalName(name);
          const bikeSession = bike ? bikeSessionForLogger(name, planned) : null;
          const timed = isDurationMode(mode) && !bike;
          const restSeconds = restForName(name, planned?.restSeconds, mode);
          const layout = loggerRowLayout(mode, name);
          const columns =
            layout === "bag"
              ? "grid-cols-[5.5rem_1fr_2.75rem]"
              : layout === "weighted_shadow"
                ? "grid-cols-[1fr_4.75rem_2.75rem]"
                : bike
                  ? "grid-cols-[2rem_1fr_2rem]"
                  : hidesLoad(mode)
                    ? "grid-cols-[2rem_1fr_5.5rem_2rem]"
                    : "grid-cols-[1.75rem_minmax(7.5rem,1fr)_3.5rem_3.5rem_1.75rem]";
          const hint = modeHint(mode, name);
          const current = name === cursor.exerciseName && !cursor.done;
          const pounds = prescribedLbLabel(planned?.loadText);
          return (
            <Fragment key={name}>
            {session.status !== "complete" ? (
              <div className="flex items-center gap-3" data-insert-at={exerciseIndex}>
                <div className="h-px flex-1 bg-line" />
                <button
                  type="button"
                  data-insert-exercise={exerciseIndex}
                  aria-label={`Add exercise above ${title}`}
                  onClick={() => setPickerIndex(exerciseIndex)}
                  className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-line text-sm leading-none"
                >
                  +
                </button>
                <div className="h-px flex-1 bg-line" />
              </div>
            ) : null}
            <section
              data-exercise-block={name}
              data-log-row={layout}
              data-current-exercise={current ? "true" : undefined}
              className={`scroll-mt-52 rounded-2xl border p-4 ${
                current
                  ? "border-[#CBF805] bg-card shadow-[0_0_0_2px_#CBF805]"
                  : "border-line bg-card"
              }`}
            >
              <div className="flex items-start gap-3">
                <ExerciseThumb
                  name={name}
                  formVideoUrl={form.url}
                  formVideoPending={form.pending}
                />
                <div className="min-w-0 flex-1">
                  {current ? (
                    <p className="font-display text-xs uppercase tracking-wide text-accent">Now</p>
                  ) : null}
                  <h2>{title}</h2>
                  <p className="mt-0.5 text-sm text-muted" data-logger-prescription>
                    {planned
                      ? loggerCardLine({
                          sets: added ? group.length : planned.sets,
                          reps: planned.reps,
                          restSeconds: added ? restSeconds : planned.restSeconds,
                          logMode: mode,
                          name: title,
                          loadText: planned.loadText,
                        })
                      : countLabel(group.length, mode === "timed_round" ? "round" : "set")}
                  </p>
                  {name === firstRirName ? <RirHint /> : null}
                  {hint || (planned?.notes && !bagFocusLines(planned.notes)) || creditForExercise(title) ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-semibold">Coaching</summary>
                      <div className="mt-2 space-y-1">
                        <CoachCredit name={title} />
                        {hint ? <p className="text-xs text-muted">{hint}</p> : null}
                        {planned?.notes && !bagFocusLines(planned.notes) ? (
                          <p className="text-sm text-muted">{planned.notes}</p>
                        ) : null}
                      </div>
                    </details>
                  ) : null}
                  <BagFocusList
                    notes={planned?.notes}
                    activeRound={current && layout === "bag" ? cursor.setIndex : undefined}
                  />
                  {bikeSession ? (
                    <BikeSetTimer
                      key={`${name}-${bikeSession.workSeconds}-${bikeSession.restSeconds}-${bikeSession.roundsPerSet}`}
                      session={bikeSession}
                      canStart={group.some((set) => !set.completed)}
                      onSetComplete={() => {
                        const nextOpen = group.find((set) => !set.completed);
                        if (!nextOpen) return;
                        const loggedSeconds = Math.max(
                          1,
                          (bikeSession?.workSeconds ?? 1) * Math.max(1, bikeSession?.roundsPerSet ?? 1),
                        );
                        updateSet(nextOpen.id, {
                          completed: true,
                          durationSeconds:
                            nextOpen.durationSeconds && nextOpen.durationSeconds > 0
                              ? nextOpen.durationSeconds
                              : loggedSeconds,
                        });
                        const effects = bikeIntervalCompletionEffects({
                          exerciseName: name,
                          restBetweenSetsSeconds: restSeconds,
                        });
                        if (effects.rest) {
                          setRestGo(false);
                          setNowMs(clockNow());
                          engageRestRoute();
                          setRestTimer(effects.rest);
                        }
                      }}
                    />
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                    {session.status !== "complete" ? (
                      <>
                        <button
                          type="button"
                          data-move-up={name}
                          aria-label={`Move ${title} up`}
                          disabled={exerciseIndex === 0}
                          onClick={() => moveLoggedExercise(name, "up")}
                          className="inline-flex min-h-8 items-center rounded-full border border-line px-2.5 text-xs font-semibold disabled:text-muted"
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          data-move-down={name}
                          aria-label={`Move ${title} down`}
                          disabled={exerciseIndex === grouped.length - 1}
                          onClick={() => moveLoggedExercise(name, "down")}
                          className="inline-flex min-h-8 items-center rounded-full border border-line px-2.5 text-xs font-semibold disabled:text-muted"
                        >
                          Down
                        </button>
                        {added ? (
                          <button
                            type="button"
                            data-remove-added={name}
                            onClick={() => removeAddedExercise(name)}
                            className="inline-flex min-h-8 items-center text-xs font-semibold text-danger"
                          >
                            Remove
                          </button>
                        ) : null}
                      </>
                    ) : null}
                    {session.status !== "complete" && !added ? (
                      <ExerciseCardMenu
                        programSlug={swap?.programSlug ?? ""}
                        dayNumber={swap?.dayNumber ?? 0}
                        programDayId={session.programDayId ?? undefined}
                        originalName={
                          swap?.slots.find((slot) => slot.currentName === name)?.programmedName ?? name
                        }
                        currentName={name}
                        source={swapSource(name, group, planned, restSeconds, mode, swap?.slots)}
                        weightAccess={swap?.weightAccess ?? "gym"}
                        workoutSessionId={session.id}
                        canRemove={grouped.length > 1}
                        getCurrentSets={() => setsRef.current.map(toSetInput)}
                        snapshotSets={() => setsRef.current.map((set) => ({ ...set }))}
                        onSwapped={(swappedName, prescription) => {
                          setSwapOverlay((current) => ({ ...current, [swappedName]: prescription }));
                          setRestByName((current) => ({
                            ...current,
                            [swappedName]: prescription.restSeconds,
                          }));
                          setActiveName(swappedName);
                        }}
                        onSetsReplaced={(next, focusName, updatedAt) => {
                          if (updatedAt) draftBaseRef.current = updatedAt;
                          const lb = setsInLb(next);
                          const previous = new Set(setsRef.current.map((set) => set.exerciseName));
                          const added = lb.find((set) => !previous.has(set.exerciseName))?.exerciseName;
                          const names = new Set(lb.map((set) => set.exerciseName));
                          const focus = focusName && names.has(focusName) ? focusName : added;
                          const nextRest = restAfterExerciseChange(restTimer, names, focus, clockNow());
                          setsRef.current = lb;
                          setSets(lb);
                          setRestTimer(nextRest);
                          remember(lb, nextRest);
                          syncDraft(lb, nextRest);
                          if (!focus) return;
                          setActiveName(focus);
                          requestAnimationFrame(() => {
                            const escaped =
                              typeof CSS !== "undefined" && CSS.escape ? CSS.escape(focus) : focus;
                            formRef.current
                              ?.querySelector<HTMLElement>(`[data-exercise-block="${escaped}"]`)
                              ?.scrollIntoView({ block: "center" });
                          });
                        }}
                      />
                    ) : null}
                    {previousLoads[name] ? (
                      <button
                        type="button"
                        data-same-as-last={name}
                        onClick={() =>
                          setSets((current) => copyPreviousOntoExercise(current, name, previousLoads))
                        }
                        className="inline-flex min-h-8 items-center rounded-full border border-line px-2.5 text-xs font-semibold"
                      >
                        Same as last
                      </button>
                    ) : null}
                    {showFormVideoPending(form) ? (
                      <p className="text-xs text-muted">Video pending coach review</p>
                    ) : null}
                  </div>
                  <ExerciseNotepad
                    exerciseName={name}
                    programDayId={session.programDayId ?? ""}
                    workoutId={session.id}
                    logMode={mode}
                    plannedLine={
                      planned
                        ? plannedSetLine({
                            sets: planned.sets,
                            reps: planned.reps,
                            restSeconds: planned.restSeconds,
                            logMode: mode,
                            name,
                            loadText: planned.loadText,
                          })
                        : ""
                    }
                    note={notes[name]}
                  />
                </div>
              </div>

              {added ? (
                <label
                  className="mt-3 flex items-center justify-between gap-3 text-sm"
                  data-added-rest={name}
                >
                  <span>Rest between each set</span>
                  <span className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={600}
                      inputMode="numeric"
                      aria-label={`Rest for ${title}`}
                      value={restSeconds}
                      onChange={(event) =>
                        setAddedRest(name, event.target.value === "" ? 0 : Number(event.target.value))
                      }
                      className="h-11 w-20 rounded-lg border border-line bg-background text-center text-base"
                    />
                    <span className="text-muted">sec</span>
                  </span>
                </label>
              ) : restSeconds > 0 ? (
                <p
                  className="mt-3 flex items-center justify-between gap-3 text-sm text-muted"
                  data-prescribed-rest={restSeconds}
                >
                  <span>
                    {bike || mode === "timed_round" ? "Rest between rounds" : "Rest between each set"}
                  </span>
                  <span className="shrink-0 rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold tabular-nums text-foreground">
                    {restBannerSeconds(restSeconds)}
                  </span>
                </p>
              ) : null}

              <div className={`mt-3 grid ${columns} items-center gap-2 text-xs text-muted`}>
                {layout === "bag" ? (
                  <>
                    <span>Round</span>
                    <span>Time</span>
                  </>
                ) : layout === "weighted_shadow" ? (
                  <>
                    <span>Seconds</span>
                    <span>Lbs</span>
                  </>
                ) : (
                  <>
                    <span>{bike || mode !== "timed_round" ? "Set" : "Rd"}</span>
                    <span>Previous</span>
                    {bike ? null : <span>{modeColumnLabel(mode)}</span>}
                    {bike || hidesLoad(mode) ? null : <span>{loadHeader}</span>}
                  </>
                )}
                <span className="sr-only">Done</span>
              </div>

              <div className="mt-1 space-y-2">
                {group.map((set, indexInGroup) => {
                  const index = sets.findIndex((item) => item.id === set.id);
                  const previous = previousLoads[name]?.[set.setNumber] ?? null;
                  const primaryField = layout !== "bike";
                  const previousLabel = previousSetLabel(previous);
                  return (
                    <div key={set.id} data-set-row={set.id} className="space-y-1">
                      {layout === "weighted_shadow" && group.length > 1 ? (
                        <p className="text-xs text-muted">Set {indexInGroup + 1}</p>
                      ) : null}
                      {layout === "bag" || layout === "weighted_shadow" ? (
                        <button
                          type="button"
                          data-use-previous={set.id}
                          disabled={!previous}
                          onClick={() =>
                            setSets((current) => applyPreviousToSet(current, set.id, previous))
                          }
                          className={previousChipClass(Boolean(previous))}
                          aria-label={previous ? `Use previous ${previousLabel}` : "No previous set"}
                        >
                          {previousLabel}
                        </button>
                      ) : null}
                      <div className={`grid ${columns} items-center gap-2`}>
                      <input
                        type="hidden"
                        name={`sets.${index}.exerciseName`}
                        value={set.exerciseName}
                      />
                      <input
                        type="hidden"
                        name={`sets.${index}.setNumber`}
                        value={set.setNumber}
                      />
                      <input type="hidden" name={`sets.${index}.loadUnit`} value={set.loadUnit} />
                      <input type="hidden" name={`sets.${index}.logMode`} value={mode} />
                      <input
                        type="hidden"
                        name={`sets.${index}.prescriptionKey`}
                        value={set.prescriptionKey}
                      />
                      <input type="hidden" name={`sets.${index}.rir`} value={set.rir} />
                      {layout === "bag" ? (
                        <p className="text-sm font-medium">Round {indexInGroup + 1}</p>
                      ) : layout === "weighted_shadow" ? null : (
                        <>
                          <p className="text-sm font-medium">{indexInGroup + 1}</p>
                          <button
                            type="button"
                            data-use-previous={set.id}
                            disabled={!previous}
                            onClick={() =>
                              setSets((current) => applyPreviousToSet(current, set.id, previous))
                            }
                            className={previousChipClass(Boolean(previous))}
                            aria-label={previous ? `Use previous ${previousLabel}` : "No previous set"}
                          >
                            {previousLabel}
                          </button>
                        </>
                      )}
                      {bike ? (
                        <input
                          type="hidden"
                          name={`sets.${index}.durationSeconds`}
                          value={
                            set.completed
                              ? String(
                                  set.durationSeconds && set.durationSeconds > 0
                                    ? set.durationSeconds
                                    : Math.max(
                                        1,
                                        (bikeSession?.workSeconds ?? 1) *
                                          Math.max(1, bikeSession?.roundsPerSet ?? 1),
                                      ),
                                )
                              : ""
                          }
                        />
                      ) : timed ? (
                        <label className="block">
                          <span className="sr-only">
                            {layout === "weighted_shadow" ? "Seconds" : layout === "bag" ? "Time" : modeColumnLabel(mode)}
                          </span>
                          <input
                            name={`sets.${index}.durationSeconds`}
                            data-set-field={set.id}
                            type="number"
                            min={0}
                            max={3600}
                            inputMode="numeric"
                            placeholder={layout === "weighted_shadow" ? "sec" : undefined}
                            value={set.durationSeconds ?? ""}
                            onChange={(event) =>
                              updateSet(set.id, {
                                durationSeconds:
                                  event.target.value === "" ? null : Number(event.target.value),
                                logMode: mode,
                              })
                            }
                            className="h-14 w-full scroll-mt-52 rounded-lg border border-line bg-background px-2 text-center text-lg"
                          />
                        </label>
                      ) : (
                        <label className="block">
                          <span className="sr-only">Reps</span>
                          <input
                            name={`sets.${index}.reps`}
                            data-set-field={set.id}
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
                            className="h-14 w-full scroll-mt-52 rounded-lg border border-line bg-background px-2 text-center text-lg"
                          />
                        </label>
                      )}
                      {bike || hidesLoad(mode) ? (
                        <input type="hidden" name={`sets.${index}.loadValue`} value="" />
                      ) : (
                        <label className="block">
                          <span className="sr-only">{loadHeader}</span>
                          <input
                            name={`sets.${index}.loadValue`}
                            type="number"
                            min={0}
                            max={2000}
                            step="0.5"
                            inputMode="decimal"
                            placeholder={pounds ?? "lbs"}
                            value={set.loadValue ?? ""}
                            onChange={(event) =>
                              updateSet(set.id, {
                                loadValue:
                                  event.target.value === "" ? null : Number(event.target.value),
                              })
                            }
                            className="h-14 w-full rounded-lg border border-line bg-background px-2 text-center text-lg"
                          />
                        </label>
                      )}
                      <label className="flex items-center justify-center">
                        <span className="sr-only">Done</span>
                        <input
                          name={`sets.${index}.completed`}
                          data-set-field={primaryField ? undefined : set.id}
                          data-round-needs-seconds={
                            mode === "timed_round" &&
                            !(set.durationSeconds != null && set.durationSeconds > 0)
                              ? "1"
                              : undefined
                          }
                          type="checkbox"
                          checked={set.completed}
                          title={
                            mode === "timed_round" &&
                            !(set.durationSeconds != null && set.durationSeconds > 0)
                              ? "Enter seconds before marking this round done."
                              : undefined
                          }
                          onChange={(event) =>
                            markDone(set.id, name, restSeconds, event.target.checked)
                          }
                          className="h-5 w-5 accent-accent"
                        />
                      </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                data-add-set
                onClick={() => addSet(name)}
                className="touch-target mt-2 text-sm font-medium underline-offset-4 hover:underline"
              >
                {bike || mode !== "timed_round" ? "+ Add new set" : "+ Add round"}
              </button>
            </section>
            </Fragment>
          );
        })}

        {session.status !== "complete" ? (
          <button
            type="button"
            data-add-exercise
            onClick={() => setPickerIndex(grouped.length)}
            className="touch-target w-full rounded-2xl border border-dashed border-line text-sm font-semibold"
          >
            + Add exercise
          </button>
        ) : null}

        <div
          data-logger-save
          className="space-y-2 border-t border-line pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          {state.error ? (
            <div
              ref={saveErrorRef}
              role="alert"
              data-save-error
              className="rounded-xl border border-danger bg-card px-3 py-3 text-sm"
            >
              <p>{state.error}</p>
              <button
                type="button"
                data-save-retry
                onClick={() =>
                  formRef.current?.querySelector<HTMLButtonElement>("[data-save-workout]")?.click()
                }
                className="mt-2 font-semibold underline-offset-4 hover:underline"
              >
                Retry save
              </button>
            </div>
          ) : null}
          {saveExercises.length > 0 ? (
            <SaveWorkoutButton
              workoutId={session.id}
              defaultName={saveDefaultName}
              exercises={saveExercises}
            />
          ) : null}
          <button
            type="submit"
            name="intent"
            value="complete"
            data-save-workout
            disabled={pending}
            onClick={() => primeUnlockAudio()}
            className="touch-target w-full rounded-full bg-accent text-black disabled:opacity-60"
          >
            {pending ? "Saving…" : "SAVE"}
          </button>
          <button
            type="submit"
            name="intent"
            value="draft"
            disabled={pending}
            className="touch-target w-full text-sm font-medium text-muted disabled:opacity-60"
          >
            Save draft
          </button>
        </div>
      </form>

      {moreOpen ? (
        <div
          data-session-overflow
          className="mt-4 space-y-4 rounded-2xl border border-line bg-card p-4"
        >
          <p className="font-display text-sm uppercase tracking-wide">More</p>
          <div data-round-insert className="space-y-3">
            <p className="text-sm font-medium">Add rounds</p>
            <div className="flex flex-wrap gap-2">
              {["Sparring rounds", "Grappling rounds", "Pad rounds", "Heavy bag rounds"].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  data-insert-chip={chip}
                  onClick={() => {
                    const mode = resolveLogMode({ name: chip });
                    const current = setsRef.current;
                    const count = current.filter((set) => set.exerciseName === chip).length;
                    const created = newClientSet(session.id, chip, count + 1, defaultUnit, mode, 180);
                    const last = current.findLastIndex((set) => set.exerciseName === chip);
                    const next =
                      last < 0
                        ? [...current, created]
                        : [...current.slice(0, last + 1), created, ...current.slice(last + 1)];
                    commitSets(next);
                  }}
                  className="rounded-full border border-line px-3 py-2 text-xs"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
          <Link href="/coach" className="block text-sm font-semibold text-accent">
            Ask Coach
          </Link>
        </div>
      ) : null}
      {pickerIndex != null && session.status !== "complete" ? (
        <ExerciseLibrarySheet
          variant="add"
          title="Add exercise"
          subtitle="Live clips"
          weightAccess={swap?.weightAccess ?? "gym"}
          onClose={() => setPickerIndex(null)}
          footer={(choice) => (
            <button
              type="button"
              data-add-library={choice.name}
              onClick={() => addFromLibrary(choice)}
              className="touch-target w-full rounded-full bg-accent text-sm font-semibold text-black"
            >
              Add {choice.name}
            </button>
          )}
        />
      ) : null}
    </div>
  );
}
