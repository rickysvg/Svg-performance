import type { CheckoutSkuId } from "@/lib/plans";
import { MEMBER_PRO_DAYS, NONMEMBER_TRIAL_DAYS } from "@/lib/pricing";

/** One trial per person. These are the full allowances, not a second trial stacked on the first. */
export const NEW_MEMBER_TRIAL_DAYS = NONMEMBER_TRIAL_DAYS;
export const ACADEMY_TRIAL_DAYS = MEMBER_PRO_DAYS;

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
 * Stripe trial days for this checkout.
 * VIP never gets one. A used in-app trial, a used Stripe trial, or a cancel
 * and resubscribe all return no trial so checkout bills today.
 * Someone who has never had a trial gets the full remaining allowance:
 * 7 days for a new member, 14 for a verified academy member.
 */
export function checkoutTrialPeriodDays(input: {
  plan: CheckoutSkuId;
  verified: boolean;
  trialAlreadyUsed: boolean;
}): number | undefined {
  if (input.plan !== "performance_monthly" && input.plan !== "performance_year") return undefined;
  if (input.trialAlreadyUsed) return undefined;
  return input.verified ? ACADEMY_TRIAL_DAYS : NEW_MEMBER_TRIAL_DAYS;
}

/** In-app reminder when 2 days or 1 day remain on the no-card nonmember trial. */
export function nonmemberTrialReminderStage(daysLeft: number): "2d" | "1d" | null {
  if (daysLeft === 2) return "2d";
  if (daysLeft === 1) return "1d";
  return null;
}
