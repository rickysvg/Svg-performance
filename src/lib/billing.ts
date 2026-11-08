import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError } from "@/lib/errors";
import { getProfileForUser } from "@/lib/profile";
import { ensureCreditsForPlan } from "@/lib/credits";
import { isPlanAtCap } from "@/lib/waitlist";
import {
  billingPlanFromStored,
  catalogPlanFromStored,
  isRetiredAnnualPrice,
  referencesRetiredAnnual,
} from "@/lib/pro-annual-record";
import {
  CHECKOUT_SKUS,
  type CheckoutSkuId,
  normalizePlanId,
  PLAN_CATALOG,
  planAtLeast,
} from "@/lib/plans";
import { readPriceEnv } from "@/lib/stripe-prices";
import { getLatestSubscription } from "@/lib/access";
import { subscriptionBlocksCheckout } from "@/lib/subscription-access";
import { getVipCheckoutView } from "@/lib/vip-store";
import { upsertSubscriptionFromWebhook } from "@/lib/stripe-webhook";

export { applyStripeEvent, upsertSubscriptionFromWebhook } from "@/lib/stripe-webhook";

export { PLANS, isPlanId, isCheckoutSkuId } from "@/lib/plans";
export type { CheckoutSkuId as PlanId } from "@/lib/plans";

export async function assertCanCheckoutPlan(userId: string, plan: CheckoutSkuId) {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new AppError("BILLING", "Stripe is not configured.");
  }
  const sku = CHECKOUT_SKUS[plan];
  if (!sku.checkoutEnabled) {
    throw new AppError("BILLING", "That plan is not available for checkout.");
  }
  if (sku.requiresGymVerify) {
    const profile = await getProfileForUser(userId);
    if (!profile?.gymMembershipVerified) {
      throw new ForbiddenError(
        "That checkout needs a verified SVG MMA Academy membership. Checking the box yourself is not enough. Academy members get the core app with their dues.",
      );
    }
  }
  if (!readPriceEnv(sku.envPrice)) {
    throw new AppError("BILLING", `${sku.envPrice} is not set.`);
  }
  if (plan === "coaching_monthly") {
    const vip = await getVipCheckoutView(userId);
    if (!vip) {
      throw new ForbiddenError(
        "Checkout stays locked until Ricky approves your VIP Coaching application.",
      );
    }
  }
  const existing = await getLatestSubscription(userId);
  if (existing && subscriptionBlocksCheckout(existing.status)) {
    const current = normalizePlanId(existing.plan);
    const target = sku.catalogId;
    const alreadyCovered =
      current === target || (target === "performance" && planAtLeast(current, "performance"));
    if (alreadyCovered) {
      throw new AppError(
        "BILLING",
        "You already have a subscription. Use Manage billing to update your card. Paid features stay locked until the payment succeeds.",
      );
    }
  }
  if (await isPlanAtCap(sku.catalogId)) {
    throw new AppError(
      "WAITLIST",
      `${sku.catalogId} is at its pilot cap. Join the waitlist instead of checkout.`,
    );
  }
}

export function priceIdForPlan(plan: CheckoutSkuId) {
  const envName = CHECKOUT_SKUS[plan].envPrice;
  const value = readPriceEnv(envName);
  if (!value) {
    throw new AppError("BILLING", `${envName} is not set.`);
  }
  return value;
}


export async function assignPlanForPilot(input: {
  adminUserId: string;
  targetUserId: string;
  plan: string;
}) {
  const admin = await prisma.user.findUnique({ where: { id: input.adminUserId } });
  if (!admin || admin.role !== "admin") {
    throw new ForbiddenError("Only an admin can assign a plan for the pilot.");
  }
  const catalogPlan = catalogPlanFromStored({ plan: input.plan });
  const recordedPlan = referencesRetiredAnnual({ plan: input.plan })
    ? billingPlanFromStored({ plan: input.plan })
    : catalogPlan;
  const existing = await prisma.subscription.findFirst({
    where: { userId: input.targetUserId },
    orderBy: { updatedAt: "desc" },
  });
  // The assigned plan is current. A leftover retired price must not keep the
  // row on Pro annual. Clear that price only. Do not delete the row or the flag.
  const clearRetiredPrice =
    Boolean(existing) &&
    isRetiredAnnualPrice(existing?.stripePriceId) &&
    !referencesRetiredAnnual({ plan: input.plan });
  // Admin override is the pilot escape hatch — caps apply to self-serve checkout only.
  const periodEnd = new Date();
  periodEnd.setUTCDate(periodEnd.getUTCDate() + 30);
  const row = await upsertSubscriptionFromWebhook({
    userId: input.targetUserId,
    plan: recordedPlan,
    status: catalogPlan === "member_access" ? "canceled" : "active",
    currentPeriodEnd: catalogPlan === "member_access" ? null : periodEnd,
    source: "admin",
    ...(clearRetiredPrice ? { stripePriceId: "" } : {}),
  });
  await ensureCreditsForPlan(input.targetUserId, catalogPlan);
  return { ...row, label: PLAN_CATALOG[catalogPlan].label };
}
