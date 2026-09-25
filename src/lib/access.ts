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
 * Training (M1) stays open for every signed-in member.
 * Nutrition / SVG Coach require Performance+ (nutrition feature)
 * only when Stripe TEST keys are actually configured.
 * Learn stays reachable on Member Access as beginner-only.
 * An active Performance trial counts as subscribed until trialEndsAt.
 */
export async function canUseMemberTools(userId: string): Promise<{
  allowed: boolean;
  reason: "preview" | "subscribed" | "paywall";
}> {
  if (!isStripeConfigured()) {
    return { allowed: true, reason: "preview" };
  }
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
    select: { trialEndsAt: true },
  });
  if (isTrialActive(profile?.trialEndsAt ?? null)) {
    return { allowed: true, reason: "subscribed" };
  }
  return { allowed: false, reason: "paywall" };
}
