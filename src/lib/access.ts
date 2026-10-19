import { prisma } from "@/lib/prisma";
import { normalizePlanId, planHasFeature } from "@/lib/plans";
import { isTrialActive } from "@/lib/trial";
import { isTesterFlagActive } from "@/lib/tester-access";

export function isStripeConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_WEBHOOK_SECRET &&
      process.env.STRIPE_PRICE_STANDALONE,
  );
}

export async function getLatestSubscription(userId: string) {
  return prisma.subscription.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function hasWebhookGrantedAccess(userId: string) {
  const subscription = await getLatestSubscription(userId);
  if (subscription?.status !== "active") {
    return false;
  }
  if (subscription.currentPeriodEnd && subscription.currentPeriodEnd < new Date()) {
    return false;
  }
  return true;
}

/**
 * Fuel / SVG Coach need the academy tier (verified member) or Pro
 * (subscription, tester code, 7-day trial, or the 30-day member Pro month).
 * A nonmember whose trial ended gets the paywall. Missing Stripe keys do not unlock those tools.
 * A tester code does not create a subscription.
 */
export async function canUseMemberTools(userId: string): Promise<{
  allowed: boolean;
  reason: "subscribed" | "paywall";
}> {
  const subscription = await getLatestSubscription(userId);
  if (
    subscription?.status === "active" &&
    !(subscription.currentPeriodEnd && subscription.currentPeriodEnd < new Date()) &&
    planHasFeature(normalizePlanId(subscription.plan), "nutrition")
  ) {
    return { allowed: true, reason: "subscribed" };
  }
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { trialEndsAt: true, gymMembershipVerified: true, tester: true },
  });
  if (isTesterFlagActive(Boolean(profile?.tester))) {
    return { allowed: true, reason: "subscribed" };
  }
  if (profile?.gymMembershipVerified) {
    return { allowed: true, reason: "subscribed" };
  }
  if (isTrialActive(profile?.trialEndsAt ?? null)) {
    return { allowed: true, reason: "subscribed" };
  }
  return { allowed: false, reason: "paywall" };
}
