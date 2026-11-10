/** Paid access. past_due, unpaid, and canceled lock immediately. There is no grace period. */
export function subscriptionGrantsAccess(
  status: string | null | undefined,
  periodEnd?: Date | null,
  now = new Date(),
) {
  if (status !== "active" && status !== "trialing") return false;
  if (periodEnd && periodEnd.getTime() < now.getTime()) return false;
  return true;
}

/** An open Stripe subscription. A new checkout must not start a second one. */
export function subscriptionBlocksCheckout(status: string | null | undefined) {
  return status === "active" || status === "trialing" || status === "past_due" || status === "unpaid";
}

/** Banner states. Access is already locked for all three. */
export function subscriptionNeedsBillingBanner(status: string | null | undefined) {
  return status === "past_due" || status === "unpaid" || status === "canceled";
}
