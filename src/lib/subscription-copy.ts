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

export function trialDaysRemaining(trialEnd: Date | null | undefined, now = new Date()) {
  if (!trialEnd || trialEnd.getTime() <= now.getTime()) return 0;
  return Math.ceil((trialEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

/** "Nov 17" in the app timezone. */
export function shortMonthDay(date: Date, timeZone = "America/Denver") {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone,
  }).format(date);
}

export function subscriptionCancelOn(input: {
  cancelAt?: Date | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: Date | null;
}) {
  if (input.cancelAt) return input.cancelAt;
  if (input.cancelAtPeriodEnd && input.currentPeriodEnd) return input.currentPeriodEnd;
  return null;
}

/** Plan line with trial days left and a scheduled cancel. */
export function subscriptionScheduleLine(
  input: {
    plan: string;
    status: string;
    trialEnd?: Date | null;
    cancelAt?: Date | null;
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: Date | null;
  },
  now = new Date(),
) {
  const parts = [subscriptionFace(input.plan, input.status)];
  if (input.status === "trialing" && input.trialEnd && input.trialEnd.getTime() > now.getTime()) {
    const days = trialDaysRemaining(input.trialEnd, now);
    const unit = days === 1 ? "day" : "days";
    parts.push(`${days} ${unit} left`);
    parts.push(`ends ${shortMonthDay(input.trialEnd)}`);
  }
  const cancelOn = subscriptionCancelOn(input);
  if (cancelOn && (input.status === "active" || input.status === "trialing" || input.status === "past_due")) {
    parts.push(`Cancels on ${shortMonthDay(cancelOn)}`);
  }
  return parts.join(" · ");
}
