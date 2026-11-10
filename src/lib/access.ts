import { prisma } from "@/lib/prisma";
import { billingPlanFromStored, referencesRetiredAnnual } from "@/lib/pro-annual-record";
import { normalizePlanId, planHasFeature } from "@/lib/plans";
import { stripeBillingEnvPresent } from "@/lib/stripe-prices";
import { isTrialActive } from "@/lib/trial";

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET && stripeBillingEnvPresent());
}

type SubscriptionPick = {
  status: string;
  source: string;
  currentPeriodEnd: Date | null;
  updatedAt: Date;
};

function subscriptionIsLive(row: SubscriptionPick, now: Date) {
  return row.status === "active" && !(row.currentPeriodEnd && row.currentPeriodEnd < now);
}

/**
 * Most recently updated row, except a live paid or admin row wins over an
 * access-code grant. Buying Pro replaces the code without a second entitlement.
 */
export function pickEffectiveSubscription<T extends SubscriptionPick>(rows: T[], now = new Date()): T | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const latest = sorted[0];
  if (latest.source !== "access_code") return latest;
  const liveOther = sorted.find((row) => row.source !== "access_code" && subscriptionIsLive(row, now));
  return liveOther ?? latest;
}

export async function getLatestSubscription(userId: string, now = new Date()) {
  const rows = await prisma.subscription.findMany({ where: { userId } });
  const row = pickEffectiveSubscription(rows, now);
  // View only. The stored plan string and boolean stay in the database.
  if (!row || !referencesRetiredAnnual(row)) return row;
  return { ...row, plan: billingPlanFromStored(row) };
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
 * Fuel needs the academy tier (verified member) or Pro
 * (subscription, 7-day trial, or the member Pro grant).
 * SVG Coach chat is separate: Pro, VIP Coaching, an active Pro trial, or an admin.
 * A nonmember whose trial ended gets the paywall. Missing Stripe keys do not unlock those tools.
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
    select: { trialEndsAt: true, gymMembershipVerified: true },
  });
  if (profile?.gymMembershipVerified) {
    return { allowed: true, reason: "subscribed" };
  }
  if (isTrialActive(profile?.trialEndsAt ?? null)) {
    return { allowed: true, reason: "subscribed" };
  }
  return { allowed: false, reason: "paywall" };
}
