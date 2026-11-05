import { normalizePlanId, PLAN_CATALOG } from "@/lib/plans";

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Past due",
  canceled: "Canceled",
  incomplete: "Incomplete",
  incomplete_expired: "Ended",
  unpaid: "Unpaid",
};

/** Member-facing status. Never the stored plan id. */
export function subscriptionStatusLabel(status: string) {
  return STATUS_LABELS[status] ?? "On file";
}

/** Member-facing plan name from a stored plan id. */
export function subscriptionPlanLabel(plan: string) {
  const catalogId = normalizePlanId(plan);
  return PLAN_CATALOG[catalogId]?.label ?? "Your plan";
}

/** "SVG Pro · Active" instead of an internal plan id and status code. */
export function subscriptionFace(plan: string, status: string) {
  return `${subscriptionPlanLabel(plan)} · ${subscriptionStatusLabel(status)}`;
}
