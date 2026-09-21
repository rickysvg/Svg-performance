import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError } from "@/lib/errors";
import { getProfileForUser } from "@/lib/profile";
import { isStripeConfigured } from "@/lib/access";

export const PLANS = {
  gym: {
    id: "gym",
    label: "Verified gym member",
    amountLabel: "$19/mo",
    envPrice: "STRIPE_PRICE_GYM",
  },
  standalone: {
    id: "standalone",
    label: "Standalone subscriber",
    amountLabel: "$29/mo",
    envPrice: "STRIPE_PRICE_STANDALONE",
  },
} as const;

export type PlanId = keyof typeof PLANS;

export function isPlanId(value: string): value is PlanId {
  return value === "gym" || value === "standalone";
}

export async function assertCanCheckoutPlan(userId: string, plan: PlanId) {
  if (!isStripeConfigured()) {
    throw new AppError(
      "BILLING",
      "Stripe TEST keys are not configured. Checkout is shown as a proposal only.",
    );
  }
  if (plan === "gym") {
    const profile = await getProfileForUser(userId);
    if (!profile?.gymMembershipVerified) {
      throw new ForbiddenError(
        "The $19 gym price is only available after an admin verifies your SVG membership. Checking the box yourself is not enough.",
      );
    }
    if (!process.env.STRIPE_PRICE_GYM) {
      throw new AppError("BILLING", "STRIPE_PRICE_GYM is not set.");
    }
  }
}

export function priceIdForPlan(plan: PlanId) {
  const envName = PLANS[plan].envPrice;
  const value = process.env[envName];
  if (!value) {
    throw new AppError("BILLING", `${envName} is not set.`);
  }
  return value;
}

export async function upsertSubscriptionFromWebhook(input: {
  userId: string;
  plan: PlanId;
  status: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  currentPeriodEnd?: Date | null;
}) {
  const existing = input.stripeSubscriptionId
    ? await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: input.stripeSubscriptionId },
      })
    : await prisma.subscription.findFirst({
        where: { userId: input.userId },
        orderBy: { updatedAt: "desc" },
      });

  const data = {
    userId: input.userId,
    plan: input.plan,
    status: input.status,
    stripeCustomerId: input.stripeCustomerId ?? "",
    stripeSubscriptionId: input.stripeSubscriptionId ?? "",
    stripePriceId: input.stripePriceId ?? "",
    currentPeriodEnd: input.currentPeriodEnd ?? null,
  };

  if (existing) {
    return prisma.subscription.update({ where: { id: existing.id }, data });
  }
  return prisma.subscription.create({ data });
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
};

function mapSubscriptionStatus(status: string | undefined) {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due") return "past_due";
  if (status === "canceled" || status === "unpaid" || status === "incomplete_expired") {
    return "canceled";
  }
  return "incomplete";
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
  const plan: PlanId = planRaw === "gym" ? "gym" : "standalone";

  if (!userId) {
    throw new AppError("BILLING", "Webhook event is missing the member id.");
  }

  if (plan === "gym") {
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
      plan,
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
      plan,
      status: "active",
      stripeCustomerId: typeof object.customer === "string" ? object.customer : "",
      stripeSubscriptionId:
        typeof object.subscription === "string"
          ? object.subscription
          : object.id,
      stripePriceId: object.items?.data?.[0]?.price?.id,
      currentPeriodEnd: periodEnd,
    });
  } else if (event.type === "invoice.payment_failed") {
    result = await upsertSubscriptionFromWebhook({
      userId,
      plan,
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
      plan,
      status: "canceled",
      stripeSubscriptionId: object.id,
      currentPeriodEnd: periodEnd,
    });
  } else if (event.type === "customer.subscription.updated") {
    result = await upsertSubscriptionFromWebhook({
      userId,
      plan,
      status: mapSubscriptionStatus(object.status),
      stripeSubscriptionId: object.id,
      currentPeriodEnd: periodEnd,
    });
  }

  if (event.id) {
    await prisma.stripeEventLog.create({
      data: { stripeEventId: event.id, eventType: event.type },
    });
  }

  return result;
}
