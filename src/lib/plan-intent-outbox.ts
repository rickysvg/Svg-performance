import type { SessionUndoTarget } from "@/lib/plan-intent";

export type PlanIntent = SessionUndoTarget & {
  intentSeq: number;
  intent: "move" | "restore";
};

export type PlanIntentResult = {
  intentSeq?: number;
  applied: boolean;
  seq: number;
  error?: string;
  /** A later click replaced this one before the server answered. */
  superseded?: boolean;
  /** Try the same intent again. The server has not acknowledged it. */
  retry?: boolean;
};

const latest = new Map<string, PlanIntent>();
const waiters = new Map<string, Array<(result: PlanIntentResult) => void>>();
const listeners = new Set<() => void>();

let pumping = false;
let retryDelayMs = 150;
let installed = false;

function waiterKey(intent: Pick<PlanIntent, "sessionKey" | "intentSeq">) {
  return `${intent.sessionKey}#${intent.intentSeq}`;
}

function emit() {
  for (const listener of listeners) listener();
}

export function subscribePlanIntentOutbox(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function planIntentOutboxSize() {
  return latest.size;
}

export function setPlanIntentRetryDelay(ms: number) {
  retryDelayMs = ms;
}

export function resetPlanIntentOutboxForTests() {
  latest.clear();
  waiters.clear();
  pumping = false;
  retryDelayMs = 0;
  emit();
}

function resolveWaiters(intent: Pick<PlanIntent, "sessionKey" | "intentSeq">, result: PlanIntentResult) {
  const key = waiterKey(intent);
  const pending = waiters.get(key);
  if (!pending) return;
  waiters.delete(key);
  for (const resolve of pending) resolve(result);
}

export function planIntentUnloadBody() {
  if (latest.size === 0) return null;
  return JSON.stringify({ intents: [...latest.values()] });
}

async function postPlanIntents(intents: PlanIntent[]): Promise<PlanIntentResult[]> {
  const response = await fetch("/api/training/plan-intent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    keepalive: true,
    body: JSON.stringify({ intents }),
  });
  if (response.status >= 500) throw new Error("The move did not save.");
  const body = (await response.json().catch(() => null)) as { error?: string; results?: PlanIntentResult[] } | null;
  if (!response.ok) {
    const message = body?.error || "That move did not save. Try again.";
    return intents.map((item) => ({
      intentSeq: item.intentSeq,
      applied: false,
      seq: item.intentSeq,
      error: message,
    }));
  }
  return body?.results ?? [];
}

let transport: (intents: PlanIntent[]) => Promise<PlanIntentResult[]> = postPlanIntents;

export function setPlanIntentTransport(
  next: ((intents: PlanIntent[]) => Promise<PlanIntentResult[]>) | null,
) {
  transport = next ?? postPlanIntents;
}

function delay(ms: number) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    while (latest.size > 0) {
      const batch = [...latest.values()];
      let acks: PlanIntentResult[];
      try {
        acks = await transport(batch);
      } catch {
        await delay(retryDelayMs);
        continue;
      }
      for (const item of batch) {
        const current = latest.get(item.sessionKey);
        if (!current || current.intentSeq !== item.intentSeq) continue;
        const ack = acks.find((row) => row.intentSeq === item.intentSeq);
        if (!ack || ack.retry) continue;
        latest.delete(item.sessionKey);
        resolveWaiters(item, ack);
      }
      emit();
      if (latest.size > 0) await delay(retryDelayMs);
    }
  } finally {
    pumping = false;
    emit();
    if (latest.size > 0) void pump();
  }
}

/** Queue the latest day for this session and wait until the server acknowledges it. */
export function submitPlanIntent(intent: PlanIntent): Promise<PlanIntentResult> {
  installUnloadFlush();
  const key = waiterKey(intent);
  const result = new Promise<PlanIntentResult>((resolve) => {
    const pending = waiters.get(key) ?? [];
    pending.push(resolve);
    waiters.set(key, pending);
  });
  const previous = latest.get(intent.sessionKey);
  latest.set(intent.sessionKey, intent);
  if (previous && previous.intentSeq < intent.intentSeq) {
    resolveWaiters(previous, {
      applied: false,
      seq: intent.intentSeq,
      superseded: true,
    });
  }
  emit();
  void pump();
  return result;
}

/** Last chance to send a click the page is about to drop. Same sequence is safe to send twice. */
export function flushPendingIntentsOnUnload() {
  const body = planIntentUnloadBody();
  if (!body) return;
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon("/api/training/plan-intent", blob)) return;
  }
  void fetch("/api/training/plan-intent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    keepalive: true,
    body,
  });
}

function installUnloadFlush() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("pagehide", flushPendingIntentsOnUnload);
  window.addEventListener("beforeunload", flushPendingIntentsOnUnload);
}
