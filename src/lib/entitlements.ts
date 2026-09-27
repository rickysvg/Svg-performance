import { getLatestSubscription } from "@/lib/access";
import {
  type CatalogPlanId,
  type FeatureId,
  normalizePlanId,
  PLAN_CATALOG,
  planHasFeature,
} from "@/lib/plans";
import { isTrialActive } from "@/lib/trial";
import { prisma } from "@/lib/prisma";

/** Missing Stripe keys never grant paid access. Free, trial, and admin rows still apply. */
export function previewEntitlementsOpen() {
  return false;
}

export async function getEffectivePlanId(userId: string, now = new Date()): Promise<CatalogPlanId> {
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
  const planId = await getEffectivePlanId(userId, now);
  return planHasFeature(planId, feature);
}
