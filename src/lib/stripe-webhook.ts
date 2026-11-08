import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, isUniqueConstraintError } from "@/lib/errors";
import { ensureCreditsForPlan } from "@/lib/credits";
import {
  billingPlanFromStored,
  catalogPlanFromStored,
  referencesRetiredAnnual,
} from "@/lib/pro-annual-record";
import { CHECKOUT_SKUS, isCheckoutSkuId, type CatalogPlanId } from "@/lib/plans";
import { subscriptionGrantsAccess } from "@/lib/subscription-access";

type Db = Prisma.TransactionClient;

type StripeLikeObject = {
  id?: string;
  object?: string;
  metadata?: Record<string, string> | null;
  client_reference_id?: string | null;
  customer?: string | { id?: string } | null;
  subscription?: string | { id?: string } | null;
  status?: string;
  payment_status?: string;
  current_period_end?: number;
  trial_start?: number | null;
  trial_end?: number | null;
  amount_paid?: number;
  currency?: string;
  livemode?: boolean;
  default_payment_method?: string | { id?: string } | null;
  payment_method?: string | { id?: string } | null;
  /** Ignored. Card vs pay-over-time does not change access. */
  payment_method_types?: string[];
  items?: { data?: { price?: { id?: string }; current_period_end?: number }[] };
  lines?: {
    data?: { price?: { id?: string }; metadata?: Record<string, string>; period?: { end?: number } }[];
  };
  parent?: {
    subscription_details?: {
      subscription?: string | { id?: string } | null;
      metadata?: Record<string, string> | null;
    } | null;
  } | null;
  subscription_details?: { metadata?: Record<string, string> | null } | null;
};

const HANDLED = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.trial_will_end",
  "invoice.paid",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
]);

function stripeId(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "string") {
    return (value as { id: string }).id;
  }
  return "";
}

function subscriptionIdFrom(object: StripeLikeObject, eventType: string) {
  const candidates = [
    stripeId(object.subscription),
    stripeId(object.parent?.subscription_details?.subscription),
  ];
  if (eventType.startsWith("customer.subscription.")) candidates.push(object.id ?? "");
  return candidates.find((id) => id.startsWith("sub_")) ?? "";
}

function priceIdFrom(object: StripeLikeObject) {
  return (
    object.metadata?.priceId ||
    object.items?.data?.[0]?.price?.id ||
    object.lines?.data?.[0]?.price?.id ||
    ""
  );
}

function periodEndFrom(object: StripeLikeObject) {
  const unix =
    object.current_period_end ||
    object.items?.data?.[0]?.current_period_end ||
    object.lines?.data?.[0]?.period?.end;
  return typeof unix === "number" && unix > 0 ? new Date(unix * 1000) : null;
}

function unixDate(value: number | null | undefined) {
  return typeof value === "number" && value > 0 ? new Date(value * 1000) : null;
}

export function checkoutSessionGrantsAccess(object: StripeLikeObject) {
  const status = object.payment_status;
  if (!status) return true;
  return status === "paid" || status === "no_payment_required";
}

function billingSkuFrom(planRaw: string, existing?: string) {
  if (isCheckoutSkuId(planRaw)) return planRaw;
  return existing ?? "";
}

async function resolveUserId(db: Db, object: StripeLikeObject, eventType: string) {
  const direct =
    object.metadata?.userId ||
    object.parent?.subscription_details?.metadata?.userId ||
    object.subscription_details?.metadata?.userId ||
    object.client_reference_id ||
    object.lines?.data?.find((line) => line.metadata?.userId)?.metadata?.userId ||
    "";
  if (direct) return direct;
  const subId = subscriptionIdFrom(object, eventType);
  if (subId) {
    const row = await db.subscription.findFirst({ where: { stripeSubscriptionId: subId } });
    if (row) return row.userId;
  }
  const customerId = stripeId(object.customer);
  if (customerId) {
    const row = await db.subscription.findFirst({
      where: { stripeCustomerId: customerId },
      orderBy: { updatedAt: "desc" },
    });
    if (row) return row.userId;
  }
  return "";
}

export async function upsertSubscriptionFromWebhook(
  input: {
    userId: string;
    plan: string;
    status: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    stripePriceId?: string;
    billingSku?: string;
    currentPeriodEnd?: Date | null;
    trialStart?: Date | null;
    trialEnd?: Date | null;
    trialWillEnd?: boolean;
    source?: string;
  },
  db: Db = prisma as unknown as Db,
) {
  let existing = input.stripeSubscriptionId
    ? await db.subscription.findFirst({ where: { stripeSubscriptionId: input.stripeSubscriptionId } })
    : null;
  if (!existing) {
    const rows = await db.subscription.findMany({
      where: { userId: input.userId },
      orderBy: { updatedAt: "desc" },
    });
    existing =
      rows.find((row) => !row.stripeSubscriptionId || row.stripeSubscriptionId.startsWith("cs_")) ??
      rows[0] ??
      null;
  }

  const stripePriceId =
    input.stripePriceId !== undefined ? input.stripePriceId : (existing?.stripePriceId ?? "");
  const data = {
    userId: input.userId,
    plan: input.plan,
    status: input.status,
    stripeCustomerId: input.stripeCustomerId || existing?.stripeCustomerId || "",
    stripeSubscriptionId: input.stripeSubscriptionId || existing?.stripeSubscriptionId || "",
    stripePriceId,
    billingSku: input.billingSku || existing?.billingSku || "",
    currentPeriodEnd:
      input.currentPeriodEnd !== undefined ? input.currentPeriodEnd : (existing?.currentPeriodEnd ?? null),
    trialStart: input.trialStart ?? existing?.trialStart ?? null,
    trialEnd: input.trialEnd ?? existing?.trialEnd ?? null,
    trialWillEnd: input.trialWillEnd === true ? true : (existing?.trialWillEnd ?? false),
    source: input.source ?? existing?.source ?? "webhook",
  };
  if (existing) return db.subscription.update({ where: { id: existing.id }, data });
  return db.subscription.create({ data });
}

function recordedPlan(planRaw: string, stripePriceId: string) {
  const incoming = { plan: planRaw, stripePriceId };
  const catalogPlan: CatalogPlanId = isCheckoutSkuId(planRaw)
    ? CHECKOUT_SKUS[planRaw].catalogId
    : catalogPlanFromStored(incoming);
  return {
    catalogPlan,
    recordedPlan: referencesRetiredAnnual(incoming) ? billingPlanFromStored(incoming) : catalogPlan,
  };
}

async function writeBillingEvent(
  db: Db,
  input: {
    stripeEventId: string;
    eventType: string;
    userId?: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    stripePriceId?: string;
    billingSku?: string;
    status?: string;
    amountCents?: number | null;
    currency?: string;
    livemode?: boolean;
    occurredAt: Date;
    note?: string;
  },
) {
  await db.billingEvent.create({
    data: {
      stripeEventId: input.stripeEventId,
      eventType: input.eventType,
      userId: input.userId ?? "",
      stripeCustomerId: input.stripeCustomerId ?? "",
      stripeSubscriptionId: input.stripeSubscriptionId ?? "",
      stripePriceId: input.stripePriceId ?? "",
      billingSku: input.billingSku ?? "",
      status: input.status ?? "",
      amountCents: input.amountCents ?? null,
      currency: input.currency ?? "",
      livemode: Boolean(input.livemode),
      occurredAt: input.occurredAt,
      note: input.note ?? "",
    },
  });
}

async function applyInner(
  event: {
    id?: string;
    type: string;
    created?: number;
    livemode?: boolean;
    data: { object: StripeLikeObject };
  },
  db: Db,
) {
  const object = event.data.object;
  const occurredAt = event.created ? new Date(event.created * 1000) : new Date();
  const eventKey = event.id || `local_${occurredAt.getTime()}_${event.type}`;
  const subId = subscriptionIdFrom(object, event.type);
  const customerId = stripeId(object.customer);
  const priceId = priceIdFrom(object);

  if (!HANDLED.has(event.type)) {
    await writeBillingEvent(db, {
      stripeEventId: eventKey,
      eventType: event.type,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subId,
      livemode: event.livemode ?? object.livemode,
      occurredAt,
      note: "ignored",
    });
    return { ignored: true as const, reason: "unhandled" as const };
  }

  const userId = await resolveUserId(db, object, event.type);
  if (!userId) {
    await writeBillingEvent(db, {
      stripeEventId: eventKey,
      eventType: event.type,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subId,
      livemode: event.livemode ?? object.livemode,
      occurredAt,
      note: "no member",
    });
    return { ignored: true as const, reason: "no member" as const };
  }

  const existingSub = await db.subscription.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  const planRaw = object.metadata?.plan || existingSub?.billingSku || existingSub?.plan || "standalone";
  const plans = recordedPlan(planRaw, priceId);
  const isCheckoutGrant =
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded";
  const isPaidInvoice = event.type === "invoice.paid" || event.type === "invoice.payment_succeeded";
  const activation =
    (isCheckoutGrant && checkoutSessionGrantsAccess(object)) ||
    event.type === "customer.subscription.created" ||
    (isPaidInvoice && !existingSub);

  if (
    (planRaw === "gym" || (isCheckoutSkuId(planRaw) && CHECKOUT_SKUS[planRaw].requiresGymVerify)) &&
    activation
  ) {
    const profile = await db.profile.findUnique({
      where: { userId },
      select: { gymMembershipVerified: true },
    });
    if (!profile?.gymMembershipVerified) {
      await writeBillingEvent(db, {
        stripeEventId: eventKey,
        eventType: event.type,
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subId,
        stripePriceId: priceId,
        livemode: event.livemode ?? object.livemode,
        occurredAt,
        note: "refused unverified gym plan",
      });
      return { refused: true as const, reason: "unverified" as const };
    }
  }

  const periodEnd = periodEndFrom(object);
  const trialStart = unixDate(object.trial_start);
  const trialEnd = unixDate(object.trial_end);
  const base = {
    userId,
    plan: plans.recordedPlan,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subId,
    ...(priceId ? { stripePriceId: priceId } : {}),
    billingSku: billingSkuFrom(planRaw, existingSub?.billingSku),
    ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}),
    ...(trialStart ? { trialStart } : {}),
    ...(trialEnd ? { trialEnd } : {}),
  };

  if (event.type === "checkout.session.expired") {
    if (existingSub && subscriptionGrantsAccess(existingSub.status, existingSub.currentPeriodEnd)) {
      await writeBillingEvent(db, {
        stripeEventId: eventKey,
        eventType: event.type,
        userId,
        status: existingSub.status,
        occurredAt,
        note: "expired session left the live subscription alone",
      });
      return existingSub;
    }
    const row = await upsertSubscriptionFromWebhook({ ...base, status: "incomplete" }, db);
    await writeBillingEvent(db, {
      stripeEventId: eventKey,
      eventType: event.type,
      userId,
      status: "incomplete",
      occurredAt,
      note: "expired",
    });
    return row;
  }

  if (event.type === "customer.subscription.trial_will_end") {
    const row = await upsertSubscriptionFromWebhook(
      { ...base, status: existingSub?.status || object.status || "trialing", trialWillEnd: true },
      db,
    );
    await writeBillingEvent(db, {
      stripeEventId: eventKey,
      eventType: event.type,
      userId,
      stripeSubscriptionId: subId,
      status: row.status,
      occurredAt,
      note: "trial_will_end",
    });
    return row;
  }

  if (event.type === "checkout.session.async_payment_failed") {
    await writeBillingEvent(db, {
      stripeEventId: eventKey,
      eventType: event.type,
      userId,
      occurredAt,
      note: "async payment failed",
    });
    return { ignored: true as const, reason: "async payment failed" as const };
  }

  if (isCheckoutGrant && !checkoutSessionGrantsAccess(object)) {
    await writeBillingEvent(db, {
      stripeEventId: eventKey,
      eventType: event.type,
      userId,
      occurredAt,
      note: "waiting for payment",
    });
    return null;
  }

  let status = "active";
  if (isCheckoutGrant && object.payment_status === "no_payment_required") status = "trialing";
  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
    status = object.status || "incomplete";
  }
  if (event.type === "customer.subscription.deleted") status = "canceled";
  if (isPaidInvoice) {
    const amount = object.amount_paid;
    status =
      amount === 0 && (existingSub?.status === "trialing" || !existingSub) ? (existingSub?.status ?? "trialing") : "active";
  }
  if (event.type === "invoice.payment_failed") status = "past_due";

  if (
    (event.type === "customer.subscription.updated" &&
      (object.status === "canceled" || object.status === "unpaid" || object.status === "incomplete_expired")) ||
    event.type === "customer.subscription.deleted"
  ) {
    status = object.status === "unpaid" ? "unpaid" : object.status === "incomplete_expired" ? "incomplete_expired" : "canceled";
    if (event.type === "customer.subscription.deleted") status = "canceled";
  }

  const row = await upsertSubscriptionFromWebhook({ ...base, status }, db);
  await writeBillingEvent(db, {
    stripeEventId: eventKey,
    eventType: event.type,
    userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: row.stripeSubscriptionId,
    stripePriceId: row.stripePriceId,
    billingSku: row.billingSku,
    status: row.status,
    amountCents: typeof object.amount_paid === "number" ? object.amount_paid : null,
    currency: object.currency ?? "",
    livemode: event.livemode ?? object.livemode,
    occurredAt,
  });
  return row;
}

async function grantCreditsAfter(result: unknown) {
  if (!result || typeof result !== "object" || !("userId" in result) || !("status" in result) || !("plan" in result)) {
    return result;
  }
  const row = result as { userId: string; status: string; plan: string };
  if (row.status === "active" || row.status === "trialing") {
    await ensureCreditsForPlan(row.userId, catalogPlanFromStored({ plan: row.plan }));
  }
  return result;
}

export async function applyStripeEvent(event: {
  id?: string;
  type: string;
  created?: number;
  livemode?: boolean;
  data: { object: StripeLikeObject };
}) {
  const run = (db: Db) => applyInner(event, db);
  try {
    const result = event.id
      ? await prisma.$transaction(async (tx) => {
          await tx.stripeEventLog.create({
            data: { stripeEventId: event.id!, eventType: event.type },
          });
          return run(tx);
        })
      : await run(prisma as unknown as Db);
    return grantCreditsAfter(result);
  } catch (error) {
    if (isUniqueConstraintError(error)) return { skipped: true as const, reason: "duplicate" as const };
    if (error instanceof ForbiddenError) {
      return { refused: true as const, reason: error.message };
    }
    throw error;
  }
}
