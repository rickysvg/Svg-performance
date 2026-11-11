/**
 * One rule for "this subscription is paying right now."
 * Canceled, incomplete, and expired rows never grant VIP or any other paid plan.
 */

const INACTIVE_STATUSES = new Set([
  "canceled",
  "cancelled",
  "incomplete",
  "incomplete_expired",
  "expired",
  "unpaid",
  "past_due",
]);

export function subscriptionStatusIsCurrent(status: string | null | undefined) {
  const normalized = String(status ?? "").trim().toLowerCase();
  if (!normalized || INACTIVE_STATUSES.has(normalized)) return false;
  return normalized === "active";
}

/** A period that already ended is expired, even when the status string still says active. */
export function subscriptionPeriodOpen(
  currentPeriodEnd: Date | null | undefined,
  now: Date,
) {
  return !(currentPeriodEnd && currentPeriodEnd.getTime() < now.getTime());
}
