import type { CheckoutSkuId } from "@/lib/plans";
import { MEMBER_PRO_DAYS, NONMEMBER_TRIAL_DAYS } from "@/lib/pricing";

/** One trial per person. These are the full allowances, not a second trial stacked on the first. */
export const NEW_MEMBER_TRIAL_DAYS = NONMEMBER_TRIAL_DAYS;
export const ACADEMY_TRIAL_DAYS = MEMBER_PRO_DAYS;
/** Stripe rejects subscription_data.trial_end sooner than this. */
export const STRIPE_MIN_TRIAL_END_MS = 48 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whole days to send as trial_period_days for time still left on an in-app trial.
 * Stripe floors a trial_end a few minutes under a whole day count, so a fresh 7-day
 * clock displays as 6. Rounding up keeps the promised count. The extension is
 * always under one day, the trial never ends sooner, and the result is at least
 * 3 days so it stays more than 48 hours out. Returns null at 48 hours or less.
 */
export function stripeWholeTrialDays(remainingMs: number): number | null {
  if (!(remainingMs > STRIPE_MIN_TRIAL_END_MS)) return null;
  const days = Math.ceil(remainingMs / DAY_MS);
  if (!Number.isFinite(days) || days < 3) return null;
  const extraMs = days * DAY_MS - remainingMs;
  if (extraMs < 0 || extraMs >= DAY_MS) return null;
  return days;
}

export type CheckoutTrialSpec =
  | { kind: "none" }
  | { kind: "days"; days: number }
  | { kind: "end"; trialEnd: Date };

export function accountTrialAlreadyUsed(input: {
  trialStartedAt?: Date | null;
  trialEndsAt?: Date | null;
  memberProStartedAt?: Date | null;
  proTrialUsedAt?: Date | null;
  stripeTrialSeen?: boolean;
}) {
  return Boolean(
    input.trialStartedAt ||
      input.trialEndsAt ||
      input.memberProStartedAt ||
      input.proTrialUsedAt ||
      input.stripeTrialSeen,
  );
}

/**
 * Full-length Stripe trial days for a person who has not started a clock.
 * Returns nothing for VIP and for anyone who already used their one trial.
 * Someone who has never had a trial gets 7 days, or 14 when academy-verified.
 * A clock that is already running is decided by checkoutTrialSpec.
 */
export function checkoutTrialPeriodDays(input: {
  plan: CheckoutSkuId;
  verified: boolean;
  trialAlreadyUsed: boolean;
}): number | undefined {
  const spec = checkoutTrialSpec(input);
  return spec.kind === "days" ? spec.days : undefined;
}

/**
 * Pro checkout trial.
 * An in-app trial with more than 48 hours left is sent as trial_period_days,
 * rounded up to a whole day so Checkout shows the full day count. That round-up
 * stays under one extra day and never ends before the in-app clock. At 48 hours
 * or less, Stripe will not accept the timestamp, so checkout bills now.
 * A trial that already ended, or a second subscribe, gets no trial.
 * VIP never gets one.
 */
export function checkoutTrialSpec(input: {
  plan: CheckoutSkuId;
  verified: boolean;
  trialAlreadyUsed: boolean;
  trialEndsAt?: Date | null;
  now?: Date;
}): CheckoutTrialSpec {
  if (input.plan !== "performance_monthly" && input.plan !== "performance_year") {
    return { kind: "none" };
  }
  const now = input.now ?? new Date();
  const ends = input.trialEndsAt ?? null;
  if (ends && ends.getTime() > now.getTime()) {
    const remaining = ends.getTime() - now.getTime();
    const days = stripeWholeTrialDays(remaining);
    if (days) return { kind: "days", days };
    if (remaining > STRIPE_MIN_TRIAL_END_MS) return { kind: "end", trialEnd: ends };
    return { kind: "none" };
  }
  if (input.trialAlreadyUsed) return { kind: "none" };
  return { kind: "days", days: input.verified ? ACADEMY_TRIAL_DAYS : NEW_MEMBER_TRIAL_DAYS };
}

/** In-app reminder when 2 days or 1 day remain on the no-card nonmember trial. */
export function nonmemberTrialReminderStage(daysLeft: number): "2d" | "1d" | null {
  if (daysLeft === 2) return "2d";
  if (daysLeft === 1) return "1d";
  return null;
}
