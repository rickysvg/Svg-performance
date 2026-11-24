import { prisma } from "@/lib/prisma";
import { billingPlanFromStored, referencesRetiredAnnual } from "@/lib/pro-annual-record";
import { PLAN_CATALOG, normalizePlanId, planHasFeature } from "@/lib/plans";
import { stripeBillingEnvPresent } from "@/lib/stripe-prices";
import { isTrialActive } from "@/lib/trial";
import { subscriptionGrantsAccess } from "@/lib/subscription-access";

type SubscriptionRow = NonNullable<Awaited<ReturnType<typeof prisma.subscription.findFirst>>>;

function presentSubscription<T extends { plan: string; stripePriceId: string }>(row: T | null): T | null {
  if (!row || !referencesRetiredAnnual(row)) return row;
  return { ...row, plan: billingPlanFromStored(row) };
}

function subscriptionIdentity(row: SubscriptionRow) {
  if (row.store !== "stripe" && row.storeOriginalTransactionId) {
    return `${row.store}:${row.storeOriginalTransactionId}`;
  }
  if (row.stripeSubscriptionId) return `stripe:${row.stripeSubscriptionId}`;
  if (row.store === "stripe") return "stripe:unkeyed";
  return `row:${row.id}`;
}

/**
 * One current row per subscription, then the row that grants access.
 * A later write wins inside the same Stripe subscription or store transaction,
 * so a canceled Stripe row still replaces an older active row for that subscription.
 * An expired store row does not hide an active subscription from another provider.
 * VIP (higher catalog rank) wins over Pro. Otherwise the later period end wins.
 * When nothing grants access, the latest updated row is returned for billing display.
 */
export function pickEffectiveSubscription<T extends SubscriptionRow>(rows: T[], now = new Date()): T | null {
  if (rows.length === 0) return null;
  const current = new Map<string, T>();
  for (const row of rows) {
    const key = subscriptionIdentity(row);
    const previous = current.get(key);
    if (!previous || row.updatedAt.getTime() >= previous.updatedAt.getTime()) current.set(key, row);
  }
  const representatives = [...current.values()];
  const granting = representatives.filter((row) =>
    subscriptionGrantsAccess(row.status, row.currentPeriodEnd, now),
  );
  const pool = granting.length > 0 ? granting : representatives;
  return [...pool].sort((a, b) => {
    if (granting.length > 0) {
      const rankA = PLAN_CATALOG[normalizePlanId(a.plan)].rank;
      const rankB = PLAN_CATALOG[normalizePlanId(b.plan)].rank;
      if (rankA !== rankB) return rankB - rankA;
      const endA = a.currentPeriodEnd?.getTime() ?? 0;
      const endB = b.currentPeriodEnd?.getTime() ?? 0;
      if (endA !== endB) return endB - endA;
    }
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  })[0] ?? null;
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET && stripeBillingEnvPresent());
}

export async function getLatestSubscription(userId: string) {
  const row = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  // View only. The stored plan string and boolean stay in the database.
  return presentSubscription(row);
}

/** Latest Stripe row. Store purchases stay on their own rows and do not replace this one. */
export async function getLatestStripeSubscription(userId: string) {
  const row = await prisma.subscription.findFirst({
    where: { userId, store: "stripe" },
    orderBy: { updatedAt: "desc" },
  });
  return presentSubscription(row);
}

/** The subscription that decides access. See pickEffectiveSubscription. */
/** App Store or Google Play when that row is the one that decides access. Web billing stays null. */
export function memberStoreBilling(subscription: { store?: string | null } | null | undefined) {
  if (subscription?.store === "app_store" || subscription?.store === "play_store") return subscription.store;
  return null;
}

export async function getEffectiveSubscription(userId: string, now = new Date()) {
  const rows = await prisma.subscription.findMany({ where: { userId } });
  return presentSubscription(pickEffectiveSubscription(rows, now));
}

export async function hasWebhookGrantedAccess(userId: string, now = new Date()) {
  const subscription = await getEffectiveSubscription(userId, now);
  return subscriptionGrantsAccess(subscription?.status, subscription?.currentPeriodEnd, now);
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
  const subscription = await getEffectiveSubscription(userId);
  if (
    subscription &&
    subscriptionGrantsAccess(subscription.status, subscription.currentPeriodEnd) &&
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
