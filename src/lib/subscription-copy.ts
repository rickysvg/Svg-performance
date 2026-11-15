import { normalizePlanId, PLAN_CATALOG } from "@/lib/plans";
import { APP_TIMEZONE, zonedCalendarDaysUntil } from "@/lib/timezone";

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

/**
 * Days left to show for a trial that has not ended.
 * A last calendar day in `timeZone` is 0, so the copy does not say "1 day left"
 * on the same local day the trial ends. The end instant itself is unchanged.
 */
export function trialDaysRemaining(
  trialEnd: Date | null | undefined,
  now = new Date(),
  timeZone = APP_TIMEZONE,
) {
  if (!trialEnd || trialEnd.getTime() <= now.getTime()) return 0;
  const byClock = Math.ceil((trialEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  const byDate = zonedCalendarDaysUntil(now, trialEnd, timeZone);
  return Math.min(byClock, Math.max(0, byDate));
}

/** "Nov 17" in the app timezone. */
export function shortMonthDay(date: Date, timeZone = APP_TIMEZONE) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: timeZone || APP_TIMEZONE,
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
  timeZone = APP_TIMEZONE,
) {
  const parts = [subscriptionFace(input.plan, input.status)];
  if (input.status === "trialing" && input.trialEnd && input.trialEnd.getTime() > now.getTime()) {
    const days = trialDaysRemaining(input.trialEnd, now, timeZone);
    if (days >= 1) {
      const unit = days === 1 ? "day" : "days";
      parts.push(`${days} ${unit} left`);
      parts.push(`ends ${shortMonthDay(input.trialEnd, timeZone)}`);
    } else {
      parts.push("ends today");
    }
  }
  const cancelOn = subscriptionCancelOn(input);
  if (cancelOn && (input.status === "active" || input.status === "trialing" || input.status === "past_due")) {
    parts.push(`Cancels on ${shortMonthDay(cancelOn, timeZone)}`);
  }
  return parts.join(" · ");
}
