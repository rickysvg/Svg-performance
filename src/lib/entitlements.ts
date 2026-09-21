import { getLatestSubscription, isStripeConfigured } from "@/lib/access";
import {
  type CatalogPlanId,
  type FeatureId,
  normalizePlanId,
  PLAN_CATALOG,
  planHasFeature,
} from "@/lib/plans";

export function previewEntitlementsOpen() {
  return !isStripeConfigured();
}

export async function getEffectivePlanId(userId: string): Promise<CatalogPlanId> {
  if (previewEntitlementsOpen()) {
    return "platinum";
  }
  const subscription = await getLatestSubscription(userId);
  if (
    subscription?.status === "active" &&
    !(subscription.currentPeriodEnd && subscription.currentPeriodEnd < new Date())
  ) {
    return normalizePlanId(subscription.plan);
  }
  return "member_access";
}

export async function getMemberEntitlements(userId: string) {
  const planId = await getEffectivePlanId(userId);
  const plan = PLAN_CATALOG[planId];
  const preview = previewEntitlementsOpen();
  return {
    planId,
    plan,
    preview,
    features: plan.features,
  };
}

export async function canUseFeature(userId: string, feature: FeatureId) {
  if (previewEntitlementsOpen()) {
    return true;
  }
  const planId = await getEffectivePlanId(userId);
  return planHasFeature(planId, feature);
}
