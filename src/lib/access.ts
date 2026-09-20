import { prisma } from "@/lib/prisma";

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
  return subscription?.status === "active";
}

/**
 * Training (M1) stays open for every signed-in member.
 * Nutrition / Learn / Coach require a webhook-confirmed subscription
 * only when Stripe TEST keys are actually configured.
 */
export async function canUseMemberTools(userId: string): Promise<{
  allowed: boolean;
  reason: "preview" | "subscribed" | "paywall";
}> {
  if (!isStripeConfigured()) {
    return { allowed: true, reason: "preview" };
  }
  if (await hasWebhookGrantedAccess(userId)) {
    return { allowed: true, reason: "subscribed" };
  }
  return { allowed: false, reason: "paywall" };
}
