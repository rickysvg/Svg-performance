/** Rule-based coach-desk color. No model calls. */
export type DeskTone = "attention" | "clear" | "idle";

/** Seats left at or under this count means the coaching cap is near or full. */
export const COACHING_NEAR_SEATS = 2;

const FAILED_PAYMENT = new Set(["past_due", "unpaid"]);

function count(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

/**
 * Open work wins. A queue with nothing waiting and something already handled is clear.
 * A tile with neither is idle.
 */
export function deskTone(waiting: number, handled: number): DeskTone {
  if (count(waiting) > 0) return "attention";
  if (count(handled) > 0) return "clear";
  return "idle";
}

export function coachingCapacityTone(used: number, cap: number): DeskTone {
  const limit = count(cap);
  if (limit <= 0) return "idle";
  const remaining = Math.max(0, limit - count(used));
  if (remaining <= COACHING_NEAR_SEATS) return "attention";
  return "idle";
}

/** A filled founding deal is finished. Open seats are not a task. */
export function foundingDealTone(claimed: number, cap: number): DeskTone {
  const limit = count(cap);
  if (limit > 0 && count(claimed) >= limit) return "clear";
  return "idle";
}

export function isFailedPaymentStatus(status: string) {
  return FAILED_PAYMENT.has(status);
}

export function queueItemTone(done: boolean): DeskTone {
  return done ? "clear" : "attention";
}

export function memberListTone(week: { missed: boolean; completed: boolean }[]): DeskTone {
  if (week.some((day) => day.missed)) return "attention";
  if (week.some((day) => day.completed)) return "clear";
  return "idle";
}

export function weekDayTone(day: { missed: boolean; completed: boolean }): DeskTone {
  if (day.missed) return "attention";
  if (day.completed) return "clear";
  return "idle";
}

export function deskSurfaceClass(tone: DeskTone) {
  if (tone === "attention") return "desk-attention";
  if (tone === "clear") return "desk-clear";
  return "desk-idle";
}
