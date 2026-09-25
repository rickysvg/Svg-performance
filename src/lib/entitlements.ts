import { getLatestSubscription, isStripeConfigured } from "@/lib/access";
import {
  type CatalogPlanId,
  type FeatureId,
  normalizePlanId,
  PLAN_CATALOG,
  planHasFeature,
} from "@/lib/plans";
import { isTrialActive } from "@/lib/trial";
import { prisma } from "@/lib/prisma";

export function previewEntitlementsOpen() {
  return !isStripeConfigured();
}

export async function getEffectivePlanId(userId: string, now = new Date()): Promise<CatalogPlanId> {
  if (previewEntitlementsOpen()) {
    return "platinum";
  }
  const subscription = await getLatestSubscription(userId);
  if (
    subscription?.status === "active" &&
    !(subscription.currentPeriodEnd && subscription.currentPeriodEnd < now)
  ) {
    return normalizePlanId(subscription.plan);
  }
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { trialEndsAt: true },
  });
  if (isTrialActive(profile?.trialEndsAt ?? null, now)) {
    return "performance";
  }
  return "member_access";
}

export async function getMemberEntitlements(userId: string, now = new Date()) {
  const planId = await getEffectivePlanId(userId, now);
  const plan = PLAN_CATALOG[planId];
  const preview = previewEntitlementsOpen();
  return {
    planId,
    plan,
    preview,
    features: plan.features,
  };
}

export async function canUseFeature(userId: string, feature: FeatureId, now = new Date()) {
  if (previewEntitlementsOpen()) {
    return true;
  }
  const planId = await getEffectivePlanId(userId, now);
  return planHasFeature(planId, feature);
}
