import { prisma } from "@/lib/prisma";
import { normalizePlanId, planHasFeature } from "@/lib/plans";
import { isTrialActive } from "@/lib/trial";

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

export type AccessSubscription = {
  status: string;
  source?: string | null;
  currentPeriodEnd?: Date | null;
};

/**
 * Active rows grant access until currentPeriodEnd.
 * Admin comps (source admin, no end date) stay open.
 * incomplete, past_due, and canceled do not grant access.
 */
export function subscriptionGrantsAccess(
  subscription: AccessSubscription | null | undefined,
  now = new Date(),
) {
  if (!subscription || subscription.status !== "active") {
    return false;
  }
  if (subscription.source === "admin" && !subscription.currentPeriodEnd) {
    return true;
  }
  if (subscription.currentPeriodEnd && subscription.currentPeriodEnd < now) {
    return false;
  }
  return true;
}

export async function hasWebhookGrantedAccess(userId: string) {
  const subscription = await getLatestSubscription(userId);
  return subscriptionGrantsAccess(subscription);
}

/**
 * Training stays open for every signed-in member.
 * Nutrition / SVG Coach require Performance+ (nutrition feature),
 * an active no-card trial, or an admin/staff plan override.
 * Missing Stripe keys do not unlock those tools.
 * Learn stays reachable on Member Access as beginner-only.
 */
export async function canUseMemberTools(userId: string): Promise<{
  allowed: boolean;
  reason: "subscribed" | "paywall";
}> {
  const subscription = await getLatestSubscription(userId);
  if (
    subscription &&
    subscriptionGrantsAccess(subscription) &&
    planHasFeature(normalizePlanId(subscription.plan), "nutrition")
  ) {
    return { allowed: true, reason: "subscribed" };
  }
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { trialEndsAt: true },
  });
  if (isTrialActive(profile?.trialEndsAt ?? null)) {
    return { allowed: true, reason: "subscribed" };
  }
  return { allowed: false, reason: "paywall" };
}
