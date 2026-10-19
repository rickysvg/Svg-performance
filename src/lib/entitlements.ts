import { getLatestSubscription } from "@/lib/access";
import {
  type CatalogPlanId,
  type FeatureId,
  normalizePlanId,
  PLAN_CATALOG,
  planHasFeature,
  planIsPro,
} from "@/lib/plans";
import { isTrialActive } from "@/lib/trial";
import { isTesterFlagActive } from "@/lib/tester-access";
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
    const plan = normalizePlanId(subscription.plan);
    if (plan !== "member_access" && plan !== "academy") return plan;
  }
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { trialEndsAt: true, gymMembershipVerified: true, tester: true },
  });
  // Beta tester: full Pro until Nov 16, 2026. No card and no subscription.
  if (isTesterFlagActive(Boolean(profile?.tester), now)) {
    return "performance";
  }
  // 7-day nonmember trial or the 30-day member Pro month: full Pro, no card.
  if (isTrialActive(profile?.trialEndsAt ?? null, now)) {
    return "performance";
  }
  // Verified SVG Academy members keep the core app with their dues.
  if (profile?.gymMembershipVerified) {
    return "academy";
  }
  // Nonmember after the trial: Pro is required. Past data stays viewable and exportable.
  return "member_access";
}

/** pro | academy | locked. Locked = nonmember whose trial ended without a subscription. */
export type AppTier = "pro" | "academy" | "locked";

export function tierForPlan(planId: CatalogPlanId): AppTier {
  if (planIsPro(planId)) return "pro";
  if (planId === "academy") return "academy";
  return "locked";
}

export async function getAppTier(userId: string, now = new Date()): Promise<AppTier> {
  return tierForPlan(await getEffectivePlanId(userId, now));
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
