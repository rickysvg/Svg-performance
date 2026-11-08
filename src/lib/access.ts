import { prisma } from "@/lib/prisma";
import { billingPlanFromStored, referencesRetiredAnnual } from "@/lib/pro-annual-record";
import { normalizePlanId, planHasFeature } from "@/lib/plans";
import { stripeBillingEnvPresent } from "@/lib/stripe-prices";
import { isTrialActive } from "@/lib/trial";
import { subscriptionGrantsAccess } from "@/lib/subscription-access";

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET && stripeBillingEnvPresent());
}

export async function getLatestSubscription(userId: string) {
  const row = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  // View only. The stored plan string and boolean stay in the database.
  if (!row || !referencesRetiredAnnual(row)) return row;
  return { ...row, plan: billingPlanFromStored(row) };
}

export async function hasWebhookGrantedAccess(userId: string) {
  const subscription = await getLatestSubscription(userId);
  return subscriptionGrantsAccess(subscription?.status, subscription?.currentPeriodEnd);
}

/**
 * Fuel needs the academy tier (verified member) or Pro
 * (subscription, 7-day trial, or the member Pro grant).
 * SVG Coach chat is separate: Pro, VIP Coaching, an active Pro trial, or an admin.
 * A nonmember whose trial ended gets the paywall. Missing Stripe keys do not unlock those tools.
 */
export async function canUseMemberTools(userId: string): Promise<{
  allowed: boolean;
  reason: "subscribed" | "paywall";
}> {
  const subscription = await getLatestSubscription(userId);
  if (
    subscription &&
    subscriptionGrantsAccess(subscription.status, subscription.currentPeriodEnd) &&
    planHasFeature(normalizePlanId(subscription.plan), "nutrition")
  ) {
    return { allowed: true, reason: "subscribed" };
  }
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { trialEndsAt: true, gymMembershipVerified: true },
  });
  if (profile?.gymMembershipVerified) {
    return { allowed: true, reason: "subscribed" };
  }
  if (isTrialActive(profile?.trialEndsAt ?? null)) {
    return { allowed: true, reason: "subscribed" };
  }
  return { allowed: false, reason: "paywall" };
}
