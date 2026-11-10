import type { CheckoutSkuId } from "@/lib/plans";
import { MEMBER_PRO_DAYS, NONMEMBER_TRIAL_DAYS } from "@/lib/pricing";

/** One trial per person. These are the full allowances, not a second trial stacked on the first. */
export const NEW_MEMBER_TRIAL_DAYS = NONMEMBER_TRIAL_DAYS;
export const ACADEMY_TRIAL_DAYS = MEMBER_PRO_DAYS;
/** Stripe rejects subscription_data.trial_end sooner than this. */
export const STRIPE_MIN_TRIAL_END_MS = 48 * 60 * 60 * 1000;

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
 * Full-length Stripe trial days only.
 * Returns nothing when checkout uses a carried trial_end, when the plan is VIP,
 * or when this person already used their one trial.
 * Someone who has never had a trial gets 7 days, or 14 when academy-verified.
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
 * An in-app trial that is still running is carried to Stripe with trial_end
 * when more than 48 hours remain. Shorter than that, Stripe will not accept
 * the timestamp, so checkout bills now instead of extending the trial.
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
    if (ends.getTime() - now.getTime() > STRIPE_MIN_TRIAL_END_MS) {
      return { kind: "end", trialEnd: ends };
    }
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
