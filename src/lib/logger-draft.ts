import type { RestTimerState } from "@/lib/rest-timer";
import { remainingRestSeconds } from "@/lib/rest-timer";

export const LOGGER_DRAFT_VERSION = 1;

export type DraftSetSnapshot = {
  exerciseName: string;
  setNumber: number;
  reps: number | null;
  loadValue: number | null;
  loadUnit: string;
  logMode: string;
  durationSeconds: number | null;
  completed: boolean;
  notes: string;
  prescriptionKey: string;
  rir: string;
};

export type LoggerDraft = {
  version: typeof LOGGER_DRAFT_VERSION;
  sessionId: string;
  savedAt: number;
  sets: DraftSetSnapshot[];
  rest: RestTimerState | null;
};

export function loggerDraftStorageKey(sessionId: string) {
  return `svg-logger-draft:${sessionId}`;
}

export function slotIdentity(exerciseName: string, setNumber: number) {
  return `${exerciseName}\u0000${setNumber}`;
}

/** Local values win. Server ids stay so the form still posts the saved rows. */
export function mergeDraftOntoSets<T extends DraftSetSnapshot>(
  serverSets: T[],
  draft: LoggerDraft | null,
): T[] {
  if (!draft) return serverSets;
  const pending = new Map(draft.sets.map((set) => [slotIdentity(set.exerciseName, set.setNumber), set]));
  return serverSets.map((set) => {
    const snap = pending.get(slotIdentity(set.exerciseName, set.setNumber));
    if (!snap) return set;
    return {
      ...set,
      reps: snap.reps,
      loadValue: snap.loadValue,
      loadUnit: snap.loadUnit || set.loadUnit,
      logMode: snap.logMode || set.logMode,
      durationSeconds: snap.durationSeconds,
      completed: snap.completed,
      notes: snap.notes,
      prescriptionKey: snap.prescriptionKey || set.prescriptionKey,
      rir: snap.rir || set.rir,
    };
  });
}

export function extraDraftSets(
  serverSets: DraftSetSnapshot[],
  draft: LoggerDraft | null,
): DraftSetSnapshot[] {
  if (!draft) return [];
  const have = new Set(serverSets.map((set) => slotIdentity(set.exerciseName, set.setNumber)));
  return draft.sets.filter((set) => !have.has(slotIdentity(set.exerciseName, set.setNumber)));
}

/** Keep a rest that has not reached its original end time. Do not restart it. */
export function activeRest(
  rest: RestTimerState | null | undefined,
  nowMs: number,
): RestTimerState | null {
  if (!rest) return null;
  if (remainingRestSeconds(rest, nowMs) <= 0) return null;
  return rest;
}

export function readLoggerDraft(sessionId: string): LoggerDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(loggerDraftStorageKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LoggerDraft;
    if (parsed?.version !== LOGGER_DRAFT_VERSION || parsed.sessionId !== sessionId) return null;
    if (!Array.isArray(parsed.sets)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeLoggerDraft(draft: LoggerDraft) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(loggerDraftStorageKey(draft.sessionId), JSON.stringify(draft));
  } catch {
    /* private mode or a full disk — the in-memory logger still works */
  }
}

export function clearLoggerDraft(sessionId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(loggerDraftStorageKey(sessionId));
  } catch {
    /* ignore */
  }
}

export type DraftHydration =
  | { phase: "server" }
  | { phase: "client"; draft: LoggerDraft | null; nowMs: number };

export const SERVER_DRAFT_HYDRATION: DraftHydration = { phase: "server" };

/**
 * One store per logger mount. The snapshot is read once after subscribe so a
 * reload sees the latest local draft and a fresh clock, without a module cache
 * that would replay an older visit.
 */
export function createLoggerHydrationStore(sessionId: string) {
  let snap: DraftHydration = SERVER_DRAFT_HYDRATION;
  const listeners = new Set<() => void>();

  function emit() {
    for (const listener of listeners) listener();
  }

  function load() {
    if (snap.phase === "client") return;
    snap = {
      phase: "client",
      draft: readLoggerDraft(sessionId),
      nowMs: Date.now(),
    };
    emit();
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      const id = window.setTimeout(load, 0);
      return () => {
        listeners.delete(listener);
        window.clearTimeout(id);
      };
    },
    getSnapshot() {
      return snap;
    },
    getServerSnapshot() {
      return SERVER_DRAFT_HYDRATION;
    },
  };
}
