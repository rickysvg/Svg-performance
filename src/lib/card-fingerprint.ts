import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { markProTrialClock } from "@/lib/trial";

type FingerprintClient = {
  paymentMethods: {
    retrieve: (id: string) => Promise<{ card?: { fingerprint?: string | null } | null }>;
  };
  subscriptions: {
    retrieve: (id: string) => Promise<{ default_payment_method?: string | { id?: string } | null }>;
    update: (id: string, params: { trial_end: "now" | number }) => Promise<unknown>;
  };
};

export function otherAccountOwnsFingerprint(
  rows: { fingerprint: string; userId: string }[],
  fingerprint: string,
  userId: string,
) {
  return rows.some((row) => row.fingerprint === fingerprint && row.userId !== userId);
}

function stripeId(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "string") {
    return (value as { id: string }).id;
  }
  return "";
}

/**
 * Card fingerprint is only known after the customer submits the card.
 * Checkout may include a trial for a new account. This runs on the webhook
 * and ends that trial immediately when the card was already used on another account.
 */
export async function enforceCardFingerprint(input: {
  stripe: FingerprintClient | null;
  userId: string;
  subscriptionId: string;
  paymentMethodId?: string;
  trialing: boolean;
  trialEnd?: Date | null;
  verified?: boolean;
}) {
  if (!input.stripe || !input.userId) return { revoked: false as const, fingerprint: "" };
  let paymentMethodId = input.paymentMethodId?.trim() ?? "";
  if (!paymentMethodId && input.subscriptionId.startsWith("sub_")) {
    try {
      const subscription = await input.stripe.subscriptions.retrieve(input.subscriptionId);
      paymentMethodId = stripeId(subscription.default_payment_method);
    } catch {
      paymentMethodId = "";
    }
  }
  if (!paymentMethodId) return { revoked: false as const, fingerprint: "" };
  let fingerprint = "";
  try {
    const method = await input.stripe.paymentMethods.retrieve(paymentMethodId);
    fingerprint = method.card?.fingerprint?.trim() ?? "";
  } catch {
    return { revoked: false as const, fingerprint: "" };
  }
  if (!fingerprint) return { revoked: false as const, fingerprint: "" };

  const existing = await prisma.cardFingerprint.findUnique({ where: { fingerprint } });
  if (existing && existing.userId !== input.userId) {
    if (input.trialing && input.subscriptionId.startsWith("sub_")) {
      try {
        await input.stripe.subscriptions.update(input.subscriptionId, { trial_end: "now" });
      } catch {
        // The webhook still records the block. Stripe will retry the subscription update
        // only if we leave the local row trialing and a later event arrives.
      }
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: input.subscriptionId, status: "trialing" },
        data: { status: "incomplete", trialEnd: new Date() },
      });
    }
    await prisma.profile.updateMany({
      where: { userId: input.userId, proTrialUsedAt: null },
      data: { proTrialUsedAt: new Date() },
    });
    return { revoked: true as const, fingerprint };
  }
  if (!existing) {
    await prisma.cardFingerprint.create({
      data: { fingerprint, userId: input.userId },
    });
  }
  if (input.trialing) {
    await markProTrialClock(input.userId, {
      verified: Boolean(input.verified),
      trialEnd: input.trialEnd ?? null,
    });
  }
  return { revoked: false as const, fingerprint };
}

export type StripeFingerprintClient = Stripe;
