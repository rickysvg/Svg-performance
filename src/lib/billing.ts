import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError } from "@/lib/errors";
import { getProfileForUser } from "@/lib/profile";
import { isStripeConfigured } from "@/lib/access";
import { ensureCreditsForPlan } from "@/lib/credits";
import { isPlanAtCap } from "@/lib/waitlist";
import { isFoundingDealOpen } from "@/lib/pricing";
import {
  CHECKOUT_SKUS,
  type CheckoutSkuId,
  foundingPriceIds,
  isCheckoutSkuId,
  isFoundingPriceId,
  isFoundingSku,
  normalizePlanId,
  PLAN_CATALOG,
  PLANS,
} from "@/lib/plans";

export { PLANS, isPlanId, isCheckoutSkuId } from "@/lib/plans";
export type { CheckoutSkuId as PlanId } from "@/lib/plans";

export async function assertCanCheckoutPlan(userId: string, plan: CheckoutSkuId) {
  if (!isStripeConfigured()) {
    throw new AppError("BILLING", "Paid plans coming soon.");
  }
  const sku = CHECKOUT_SKUS[plan];
  if (!sku.checkoutEnabled) {
    throw new AppError("BILLING", "Paid plans coming soon.");
  }
  if (isFoundingSku(plan)) {
    const seats = await countFoundingSeats();
    if (!isFoundingDealOpen(seats)) {
      throw new AppError("BILLING", "The founding price is full.");
    }
  }
  if (sku.requiresGymVerify) {
    const profile = await getProfileForUser(userId);
    if (!profile?.gymMembershipVerified) {
      throw new ForbiddenError(
        "That checkout needs a verified SVG MMA Academy membership. Checking the box yourself is not enough. Academy members get the core app with their dues.",
      );
    }
  }
  if (!process.env[sku.envPrice]) {
    throw new AppError("BILLING", `${sku.envPrice} is not set.`);
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
  const value = process.env[envName];
  if (!value) {
    throw new AppError("BILLING", `${envName} is not set.`);
  }
  return value;
}

export async function upsertSubscriptionFromWebhook(input: {
  userId: string;
  plan: string;
  status: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  founding?: boolean;
  currentPeriodEnd?: Date | null;
  source?: string;
}) {
  const existing = input.stripeSubscriptionId
    ? await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: input.stripeSubscriptionId },
      })
    : await prisma.subscription.findFirst({
        where: { userId: input.userId },
        orderBy: { updatedAt: "desc" },
      });

  // Keep Stripe ids and the founding flag when a later event (payment failed, cancel) omits them.
  const stripePriceId = input.stripePriceId || existing?.stripePriceId || "";
  // A fresh Stripe price id wins when STRIPE_PRICE_PERFORMANCE_FOUNDING is set.
  // Otherwise use the checkout SKU flag, then whatever was stored before.
  const founding =
    input.stripePriceId && foundingPriceIds().length > 0
      ? isFoundingPriceId(input.stripePriceId)
      : (input.founding ?? existing?.founding ?? false);

  const data = {
    userId: input.userId,
    plan: input.plan,
    status: input.status,
    stripeCustomerId: input.stripeCustomerId || existing?.stripeCustomerId || "",
    stripeSubscriptionId: input.stripeSubscriptionId || existing?.stripeSubscriptionId || "",
    stripePriceId,
    founding,
    currentPeriodEnd: input.currentPeriodEnd ?? null,
    source: input.source ?? "webhook",
  };

  if (existing) {
    return prisma.subscription.update({ where: { id: existing.id }, data });
  }
  return prisma.subscription.create({ data });
}

/** Active founding seats: stored founding flag, or the configured founding Stripe price id. */
export async function countFoundingSeats() {
  const priceIds = foundingPriceIds();
  return prisma.subscription.count({
    where: {
      status: "active",
      OR: [
        { founding: true },
        ...(priceIds.length > 0 ? [{ stripePriceId: { in: priceIds } }] : []),
      ],
    },
  });
}

type StripeLikeObject = {
  id?: string;
  metadata?: Record<string, string>;
  client_reference_id?: string;
  customer?: string;
  subscription?: string;
  status?: string;
  current_period_end?: number;
  items?: { data?: { price?: { id?: string } }[] };
  /** Ignored: card vs Affirm/Klarna does not change access. Loan details are never stored. */
  payment_method_types?: string[];
};

function mapSubscriptionStatus(status: string | undefined) {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due") return "past_due";
  if (status === "canceled" || status === "unpaid" || status === "incomplete_expired") {
    return "canceled";
  }
  return "incomplete";
}

function requiresGymVerify(planRaw: string) {
  if (planRaw === "gym") return true;
  if (isCheckoutSkuId(planRaw)) return CHECKOUT_SKUS[planRaw].requiresGymVerify;
  return false;
}

export async function applyStripeEvent(event: {
  id?: string;
  type: string;
  data: { object: StripeLikeObject };
}) {
  if (event.id) {
    const existing = await prisma.stripeEventLog.findUnique({
      where: { stripeEventId: event.id },
    });
    if (existing) {
      return { skipped: true, reason: "duplicate" as const };
    }
  }

  const object = event.data.object;
  const userId =
    object.metadata?.userId || object.client_reference_id || "";
  const planRaw = object.metadata?.plan || "standalone";
  const catalogPlan = isCheckoutSkuId(planRaw)
    ? CHECKOUT_SKUS[planRaw].catalogId
    : normalizePlanId(planRaw);
  const stripePriceId = object.items?.data?.[0]?.price?.id;
  const founding = isFoundingSku(planRaw);

  if (!userId) {
    throw new AppError("BILLING", "Webhook event is missing the member id.");
  }

  const existingSub = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  const isFirstInvoicePaid = event.type === "invoice.paid" && !existingSub;
  const isGymActivation =
    event.type === "checkout.session.completed" ||
    event.type === "customer.subscription.created" ||
    isFirstInvoicePaid;

  if (requiresGymVerify(planRaw) && isGymActivation) {
    const profile = await getProfileForUser(userId);
    if (!profile?.gymMembershipVerified) {
      throw new ForbiddenError(
        "Webhook refused gym-plan access because this member is not admin-verified.",
      );
    }
  }

  const periodEnd = object.current_period_end
    ? new Date(object.current_period_end * 1000)
    : null;

  let result = null;

  if (event.type === "checkout.session.expired") {
    result = await upsertSubscriptionFromWebhook({
      userId,
      plan: catalogPlan,
      status: "incomplete",
      stripeSubscriptionId:
        typeof object.subscription === "string" ? object.subscription : object.id,
      currentPeriodEnd: periodEnd,
    });
  } else if (
    event.type === "checkout.session.completed" ||
    event.type === "invoice.paid" ||
    event.type === "customer.subscription.created"
  ) {
    result = await upsertSubscriptionFromWebhook({
      userId,
      plan: catalogPlan,
      status: "active",
      stripeCustomerId: typeof object.customer === "string" ? object.customer : "",
      stripeSubscriptionId:
        typeof object.subscription === "string"
          ? object.subscription
          : object.id,
      stripePriceId,
      founding,
      currentPeriodEnd: periodEnd,
    });
    if (result.status === "active") {
      await ensureCreditsForPlan(userId, catalogPlan);
    }
  } else if (event.type === "invoice.payment_failed") {
    result = await upsertSubscriptionFromWebhook({
      userId,
      plan: catalogPlan,
      status: "past_due",
      stripeSubscriptionId:
        typeof object.subscription === "string" ? object.subscription : object.id,
      currentPeriodEnd: periodEnd,
    });
  } else if (
    event.type === "customer.subscription.deleted" ||
    (event.type === "customer.subscription.updated" &&
      mapSubscriptionStatus(object.status) === "canceled")
  ) {
    result = await upsertSubscriptionFromWebhook({
      userId,
      plan: catalogPlan,
      status: "canceled",
      stripeSubscriptionId: object.id,
      currentPeriodEnd: periodEnd,
    });
  } else if (event.type === "customer.subscription.updated") {
    result = await upsertSubscriptionFromWebhook({
      userId,
      plan: catalogPlan,
      status: mapSubscriptionStatus(object.status),
      stripeCustomerId: typeof object.customer === "string" ? object.customer : "",
      stripeSubscriptionId: object.id,
      stripePriceId,
      founding,
      currentPeriodEnd: periodEnd,
    });
    if (result.status === "active") {
      await ensureCreditsForPlan(userId, catalogPlan);
    }
  }

  if (event.id) {
    await prisma.stripeEventLog.create({
      data: { stripeEventId: event.id, eventType: event.type },
    });
  }

  return result;
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
  const catalogPlan = normalizePlanId(input.plan);
  // Admin override is the pilot escape hatch — caps apply to self-serve checkout only.
  const periodEnd = new Date();
  periodEnd.setUTCDate(periodEnd.getUTCDate() + 30);
  const row = await upsertSubscriptionFromWebhook({
    userId: input.targetUserId,
    plan: catalogPlan,
    status: catalogPlan === "member_access" ? "canceled" : "active",
    currentPeriodEnd: catalogPlan === "member_access" ? null : periodEnd,
    source: "admin",
  });
  await ensureCreditsForPlan(input.targetUserId, catalogPlan);
  return { ...row, label: PLAN_CATALOG[catalogPlan].label };
}
