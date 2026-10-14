import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError } from "@/lib/errors";
import { getProfileForUser } from "@/lib/profile";
import { isStripeConfigured } from "@/lib/access";
import { ensureCreditsForPlan } from "@/lib/credits";
import { isPlanAtCap } from "@/lib/waitlist";
import { getStripe } from "@/lib/stripe";
import {
  CHECKOUT_SKUS,
  type CheckoutSkuId,
  isCheckoutSkuId,
  nonGymCounterpart,
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
  if (sku.requiresGymVerify) {
    const profile = await getProfileForUser(userId);
    if (!profile?.gymMembershipVerified) {
      throw new ForbiddenError(
        "Gym-member prices are only available after we verify your SVG MMA Academy membership. Checking the box yourself is not enough.",
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

export function addOneMonth(from = new Date()) {
  const end = new Date(from.getTime());
  const day = end.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(day, lastDay));
  return end;
}

export async function upsertSubscriptionFromWebhook(input: {
  userId: string;
  plan: string;
  status: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  currentPeriodEnd?: Date | null;
  source?: string;
}) {
  const existing = await locateSubscription(input);

  const data = {
    userId: input.userId,
    plan: input.plan || existing?.plan || "member_access",
    status: input.status,
    stripeCustomerId: input.stripeCustomerId || existing?.stripeCustomerId || "",
    stripeSubscriptionId: input.stripeSubscriptionId || existing?.stripeSubscriptionId || "",
    stripePriceId: input.stripePriceId || existing?.stripePriceId || "",
    currentPeriodEnd:
      input.currentPeriodEnd === undefined
        ? (existing?.currentPeriodEnd ?? null)
        : input.currentPeriodEnd,
    source: nextSource(existing?.source, input.source),
  };

  if (existing) {
    return prisma.subscription.update({ where: { id: existing.id }, data });
  }
  return prisma.subscription.create({ data });
}

function nextSource(existingSource: string | undefined, incoming: string | undefined) {
  if (incoming === "admin" || incoming === "gym_unverified") return incoming;
  if (existingSource === "admin" || existingSource === "gym_unverified") return existingSource;
  return incoming || existingSource || "webhook";
}

async function locateSubscription(input: {
  userId: string;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
}) {
  if (input.stripeSubscriptionId) {
    const bySub = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: input.stripeSubscriptionId },
    });
    if (bySub) return bySub;
  }
  if (input.stripeCustomerId) {
    const byCustomer = await prisma.subscription.findFirst({
      where: { userId: input.userId, stripeCustomerId: input.stripeCustomerId },
      orderBy: { updatedAt: "desc" },
    });
    if (byCustomer) return byCustomer;
  }
  if (!input.stripeSubscriptionId) {
    return prisma.subscription.findFirst({
      where: { userId: input.userId },
      orderBy: { updatedAt: "desc" },
    });
  }
  return null;
}

type StripeId = string | { id?: string; metadata?: Record<string, string> | null; current_period_end?: number } | null;

type StripeLikeObject = {
  id?: string;
  object?: string;
  metadata?: Record<string, string> | null;
  client_reference_id?: string | null;
  customer?: StripeId;
  subscription?: StripeId;
  status?: string;
  mode?: string;
  payment_status?: string;
  /** Ignored: card vs Affirm/Klarna does not change access. */
  payment_method_types?: string[];
  current_period_end?: number;
  items?: {
    data?: Array<{
      price?: { id?: string } | string;
      current_period_end?: number;
    }>;
  };
  lines?: {
    data?: Array<{
      price?: { id?: string } | string;
      period?: { end?: number };
      subscription?: string | null;
      pricing?: { price_details?: { price?: string } };
    }>;
  };
  parent?: {
    subscription_details?: {
      subscription?: StripeId;
      metadata?: Record<string, string> | null;
    } | null;
  } | null;
  [key: string]: unknown;
};

export type RemoteSubscription = {
  id: string;
  customerId: string;
  metadata: Record<string, string>;
  status?: string;
  priceId: string;
  currentPeriodEnd: Date | null;
};

function idOf(value: StripeId | undefined) {
  if (typeof value === "string") return value;
  if (value && typeof value.id === "string") return value.id;
  return "";
}

function metadataOf(value: StripeId | undefined) {
  if (value && typeof value === "object" && value.metadata) return value.metadata;
  return undefined;
}

function subscriptionIdFrom(type: string, object: StripeLikeObject) {
  if (type.startsWith("customer.subscription.")) return object.id ?? "";
  const direct = idOf(object.subscription);
  if (direct) return direct;
  const parent = idOf(object.parent?.subscription_details?.subscription);
  if (parent) return parent;
  const lineSub = object.lines?.data?.[0]?.subscription;
  return typeof lineSub === "string" ? lineSub : "";
}

function customerIdFrom(object: StripeLikeObject) {
  return idOf(object.customer);
}

function userIdFrom(object: StripeLikeObject) {
  return (
    object.metadata?.userId ||
    object.client_reference_id ||
    object.parent?.subscription_details?.metadata?.userId ||
    metadataOf(object.subscription)?.userId ||
    ""
  );
}

function planFrom(object: StripeLikeObject) {
  return (
    object.metadata?.plan ||
    object.parent?.subscription_details?.metadata?.plan ||
    metadataOf(object.subscription)?.plan ||
    ""
  );
}

function priceIdFrom(object: StripeLikeObject) {
  if (object.metadata?.priceId) return object.metadata.priceId;
  const itemPrice = object.items?.data?.[0]?.price;
  if (typeof itemPrice === "string" && itemPrice) return itemPrice;
  if (itemPrice && typeof itemPrice === "object" && itemPrice.id) return itemPrice.id;
  const line = object.lines?.data?.[0];
  if (!line) return "";
  if (typeof line.price === "string" && line.price) return line.price;
  if (line.price && typeof line.price === "object" && line.price.id) return line.price.id;
  return line.pricing?.price_details?.price ?? "";
}

function periodEndFrom(object: StripeLikeObject) {
  const unix =
    object.current_period_end ||
    object.items?.data?.[0]?.current_period_end ||
    object.lines?.data?.[0]?.period?.end ||
    (object.subscription && typeof object.subscription === "object"
      ? object.subscription.current_period_end
      : undefined);
  if (!unix) return null;
  return new Date(unix * 1000);
}

function mapSubscriptionStatus(status: string | undefined) {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due") return "past_due";
  if (status === "canceled" || status === "unpaid" || status === "incomplete_expired") {
    return "canceled";
  }
  if (status === "paused") return "paused";
  return "incomplete";
}

function requiresGymVerify(planRaw: string) {
  if (planRaw === "gym") return true;
  if (isCheckoutSkuId(planRaw)) return CHECKOUT_SKUS[planRaw].requiresGymVerify;
  return false;
}

function isOneMonthPurchase(planRaw: string, catalogPlan: string) {
  return (
    catalogPlan === "vip" ||
    catalogPlan === "platinum" ||
    planRaw === "vip" ||
    planRaw === "platinum"
  );
}

function secretCanCallStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  return /^(sk|rk)_(test|live)_[A-Za-z0-9]{16,}/.test(key);
}

async function defaultLoadSubscription(id: string): Promise<RemoteSubscription | null> {
  if (!secretCanCallStripe()) return null;
  let stripe: ReturnType<typeof getStripe>;
  try {
    stripe = getStripe();
  } catch {
    return null;
  }
  if (!stripe) return null;
  try {
    const sub = await stripe.subscriptions.retrieve(id);
    const item = sub.items?.data?.[0];
    const price = item?.price;
    const priceId = typeof price === "string" ? price : (price?.id ?? "");
    const customer = sub.customer;
    const customerId = typeof customer === "string" ? customer : (customer && "id" in customer ? customer.id : "");
    const periodUnix = item?.current_period_end;
    return {
      id: sub.id,
      customerId,
      metadata: sub.metadata ?? {},
      status: sub.status,
      priceId,
      currentPeriodEnd: periodUnix ? new Date(periodUnix * 1000) : null,
    };
  } catch {
    console.warn("[stripe] could not load subscription", id);
    return null;
  }
}

async function rememberEvent(event: { id?: string; type: string }) {
  if (!event.id) return;
  await prisma.stripeEventLog.create({
    data: { stripeEventId: event.id, eventType: event.type },
  });
}

const INVOICE_EVENTS = new Set(["invoice.paid", "invoice.payment_failed"]);

export async function applyStripeEvent(
  event: {
    id?: string;
    type: string;
    data: { object: StripeLikeObject };
  },
  options?: { loadSubscription?: (id: string) => Promise<RemoteSubscription | null> },
) {
  if (event.id) {
    const existing = await prisma.stripeEventLog.findUnique({
      where: { stripeEventId: event.id },
    });
    if (existing) {
      return { skipped: true, reason: "duplicate" as const };
    }
  }

  const object = event.data.object;
  const loadSubscription = options?.loadSubscription ?? defaultLoadSubscription;
  let userId = userIdFrom(object);
  let planRaw = planFrom(object);
  let subscriptionId = subscriptionIdFrom(event.type, object);
  let customerId = customerIdFrom(object);
  let priceId = priceIdFrom(object);
  let periodEnd = periodEndFrom(object);
  let remoteStatus = object.status;

  let existingRow = subscriptionId
    ? await prisma.subscription.findFirst({ where: { stripeSubscriptionId: subscriptionId } })
    : null;
  if (!existingRow && customerId) {
    existingRow = await prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
      orderBy: { updatedAt: "desc" },
    });
  }

  if (!userId && existingRow) userId = existingRow.userId;
  if (!planRaw && existingRow) planRaw = existingRow.plan;
  if (!priceId && existingRow?.stripePriceId) priceId = existingRow.stripePriceId;

  const needsRemote =
    Boolean(subscriptionId) &&
    (!userId ||
      !planRaw ||
      !priceId ||
      !periodEnd ||
      (event.type.startsWith("customer.subscription.") && !object.status));
  if (needsRemote && subscriptionId) {
    try {
      const remote = await loadSubscription(subscriptionId);
      if (remote) {
        userId = userId || remote.metadata.userId || "";
        planRaw = planRaw || remote.metadata.plan || "";
        customerId = customerId || remote.customerId;
        priceId = priceId || remote.priceId;
        periodEnd = periodEnd ?? remote.currentPeriodEnd;
        remoteStatus = remoteStatus || remote.status;
        if (!existingRow && customerId) {
          existingRow = await prisma.subscription.findFirst({
            where: { stripeCustomerId: customerId },
            orderBy: { updatedAt: "desc" },
          });
          if (!userId && existingRow) userId = existingRow.userId;
          if (!planRaw && existingRow) planRaw = existingRow.plan;
        }
      }
    } catch {
      console.warn("[stripe] subscription lookup failed", subscriptionId);
    }
  }

  if (!userId && customerId) {
    existingRow =
      existingRow ??
      (await prisma.subscription.findFirst({
        where: { stripeCustomerId: customerId },
        orderBy: { updatedAt: "desc" },
      }));
    if (existingRow) {
      userId = existingRow.userId;
      planRaw = planRaw || existingRow.plan;
    }
  }

  if (!userId) {
    console.warn(
      `[stripe] ${event.type} ignored; no member for subscription ${subscriptionId || "none"} or customer ${customerId || "none"}`,
    );
    await rememberEvent(event);
    return { skipped: true, reason: "unresolved_member" as const };
  }

  if (!planRaw) {
    if (event.type.startsWith("checkout.")) {
      planRaw = "standalone";
    } else if (INVOICE_EVENTS.has(event.type) || event.type.startsWith("customer.subscription.")) {
      console.warn(`[stripe] ${event.type} ignored; member ${userId} has no plan on the event`);
      await rememberEvent(event);
      return { skipped: true, reason: "unresolved_plan" as const };
    } else {
      planRaw = "standalone";
    }
  }

  const isFirstInvoicePaid = event.type === "invoice.paid" && !existingRow;
  const isGymActivation =
    event.type === "checkout.session.completed" ||
    event.type === "customer.subscription.created" ||
    isFirstInvoicePaid;

  let flagged = false;
  let downgraded = false;
  if (requiresGymVerify(planRaw) && isGymActivation) {
    const profile = await getProfileForUser(userId);
    if (!profile?.gymMembershipVerified) {
      const counterpart = nonGymCounterpart(planRaw);
      console.warn(
        `[stripe] gym-plan webhook for unverified member ${userId}; ${planRaw} -> ${counterpart ?? "flagged"}; event ${event.id ?? "none"}`,
      );
      flagged = true;
      if (counterpart) {
        planRaw = counterpart;
        downgraded = true;
      }
    }
  }

  const catalogPlan = isCheckoutSkuId(planRaw)
    ? CHECKOUT_SKUS[planRaw].catalogId
    : normalizePlanId(planRaw);
  const oneTime = isOneMonthPurchase(planRaw, catalogPlan);
  const source = flagged ? "gym_unverified" : "webhook";

  if (event.type === "checkout.session.expired") {
    const paidRow = await prisma.subscription.findFirst({
      where: { userId, status: { in: ["active", "past_due"] } },
      orderBy: { updatedAt: "desc" },
    });
    if (paidRow) {
      await rememberEvent(event);
      return { skipped: true, reason: "expired_ignored" as const };
    }
    const result = await upsertSubscriptionFromWebhook({
      userId,
      plan: catalogPlan,
      status: "incomplete",
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: priceId,
      currentPeriodEnd: periodEnd ?? undefined,
      source,
    });
    await rememberEvent(event);
    return result;
  }

  let status = "incomplete";
  let periodToStore: Date | null | undefined = periodEnd ?? undefined;

  if (event.type === "checkout.session.completed") {
    const paid =
      !object.payment_status ||
      object.payment_status === "paid" ||
      object.payment_status === "no_payment_required";
    status = paid ? "active" : "incomplete";
    if (paid && oneTime) periodToStore = addOneMonth();
  } else if (event.type === "invoice.paid") {
    status = "active";
    if (oneTime && !subscriptionId) {
      const stillOpen = existingRow?.currentPeriodEnd && existingRow.currentPeriodEnd > new Date();
      periodToStore = stillOpen ? undefined : addOneMonth();
    }
  } else if (event.type === "invoice.payment_failed") {
    status = "past_due";
  } else if (event.type === "customer.subscription.deleted") {
    status = "canceled";
  } else if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.created"
  ) {
    status = remoteStatus ? mapSubscriptionStatus(remoteStatus) : (existingRow?.status ?? "incomplete");
  } else {
    await rememberEvent(event);
    return { skipped: true, reason: "ignored_event" as const };
  }

  if (flagged && !downgraded) {
    status = "incomplete";
  }

  const result = await upsertSubscriptionFromWebhook({
    userId,
    plan: catalogPlan,
    status,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    stripePriceId: priceId,
    currentPeriodEnd: periodToStore,
    source,
  });

  if (result.status === "active") {
    await ensureCreditsForPlan(userId, catalogPlan);
  }

  await rememberEvent(event);
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
