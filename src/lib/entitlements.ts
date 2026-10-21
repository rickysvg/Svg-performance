import { getLatestSubscription } from "@/lib/access";
import { isDashboardAdmin } from "@/lib/admin-access";
import {
  type CatalogPlanId,
  type FeatureId,
  normalizePlanId,
  PLAN_CATALOG,
  planHasFeature,
  planIsPro,
} from "@/lib/plans";
import { isTrialActive } from "@/lib/trial";
import { prisma } from "@/lib/prisma";

/** Shown when academy or free accounts hit the coach chat API. */
export const COACH_CHAT_LOCKED =
  "AI coach chat is on Pro. Start the 7-day trial or upgrade.";

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
    select: { trialEndsAt: true, gymMembershipVerified: true },
  });
  // 7-day nonmember trial or the member Pro grant: full Pro, no card.
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

/**
 * SVG Coach chat: Pro, VIP Coaching (a Pro-rank plan), an active Pro trial, or an admin.
 * Academy members and free accounts are refused.
 */
export async function canUseCoachChat(
  user: { id: string; role: string; email: string },
  now = new Date(),
) {
  if (isDashboardAdmin(user)) return true;
  return planIsPro(await getEffectivePlanId(user.id, now));
}
