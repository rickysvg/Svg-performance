import { subscriptionGrantsAccess } from "@/lib/subscription-access";
import { currentPlanLine } from "@/lib/trial";

/** Shown only while a checkout return is waiting on the subscription row. */
export const BILLING_CONFIRMING_LABEL = "confirming your payment";

type SuccessSubscription = {
  plan: string;
  status: string;
  currentPeriodEnd?: Date | null;
  trialEnd?: Date | null;
  cancelAt?: Date | null;
  cancelAtPeriodEnd?: boolean;
};

/**
 * Same plan line as Profile and Plan.
 * Confirming is only for a checkout that just returned and has not granted access yet.
 * An incomplete VIP row does not become the plan line.
 */
export function billingSuccessPlan(input: {
  sessionId: string;
  synced: boolean;
  trialActive: boolean;
  trialDaysLeft: number;
  trialLengthDays?: number;
  verified?: boolean;
  timeZone?: string;
  planLabel: string;
  subscription?: SuccessSubscription | null;
}) {
  const planLine = currentPlanLine({
    trialActive: input.trialActive,
    trialDaysLeft: input.trialDaysLeft,
    trialLengthDays: input.trialLengthDays,
    verified: input.verified,
    timeZone: input.timeZone,
    planLabel: input.planLabel,
    subscription: input.subscription ?? null,
  });
  const justCheckedOut = input.synced && input.sessionId.startsWith("cs_");
  const written = Boolean(
    input.subscription &&
      subscriptionGrantsAccess(input.subscription.status, input.subscription.currentPeriodEnd),
  );
  return { planLine, confirming: justCheckedOut && !written };
}
