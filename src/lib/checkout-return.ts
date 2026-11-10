import { applyStripeEvent } from "@/lib/stripe-webhook";
import { getStripe } from "@/lib/stripe";

type IdRef = string | { id?: string | null } | null | undefined;

type SubLike = {
  id: string;
  status?: string;
  customer?: IdRef;
  metadata?: Record<string, string> | null;
  trial_start?: number | null;
  trial_end?: number | null;
  cancel_at?: number | null;
  cancel_at_period_end?: boolean;
  current_period_end?: number;
  items?: { data?: { price?: { id?: string }; current_period_end?: number }[] };
};

type SessionLike = {
  id: string;
  metadata?: Record<string, string> | null;
  client_reference_id?: string | null;
  customer?: IdRef;
  payment_status?: string | null;
  subscription?: string | SubLike | null;
};

export type CheckoutStripe = {
  checkout: {
    sessions: {
      retrieve: (id: string, params?: { expand?: string[] }) => Promise<SessionLike>;
    };
  };
  subscriptions: {
    retrieve: (id: string) => Promise<SubLike>;
  };
};

function stripeId(value: IdRef) {
  if (typeof value === "string") return value;
  return value?.id ?? "";
}

export function checkoutSessionBelongsToUser(
  session: {
    metadata?: Record<string, string> | null;
    client_reference_id?: string | null;
    customer?: IdRef;
  },
  userId: string,
  knownCustomerId?: string,
) {
  const owner = session.metadata?.userId || session.client_reference_id || "";
  if (!owner || owner !== userId) return false;
  const customer = stripeId(session.customer);
  if (knownCustomerId && customer && customer !== knownCustomerId) return false;
  return true;
}

export async function fulfillCheckoutSession(input: {
  userId: string;
  sessionId: string;
  knownCustomerId?: string;
  stripe: CheckoutStripe;
}) {
  if (!input.sessionId.startsWith("cs_")) return { ok: false as const, reason: "missing" as const };
  let session: SessionLike;
  try {
    session = await input.stripe.checkout.sessions.retrieve(input.sessionId, {
      expand: ["subscription"],
    });
  } catch {
    return { ok: false as const, reason: "pending" as const };
  }
  if (!checkoutSessionBelongsToUser(session, input.userId, input.knownCustomerId)) {
    return { ok: false as const, reason: "forbidden" as const };
  }
  if (session.payment_status === "unpaid") {
    return { ok: false as const, reason: "pending" as const };
  }
  let subscription = session.subscription;
  if (typeof subscription === "string") {
    try {
      subscription = await input.stripe.subscriptions.retrieve(subscription);
    } catch {
      return { ok: false as const, reason: "pending" as const };
    }
  }
  if (!subscription || typeof subscription === "string" || !subscription.id?.startsWith("sub_")) {
    return { ok: false as const, reason: "pending" as const };
  }
  const plan = session.metadata?.plan || subscription.metadata?.plan || "performance_monthly";
  const priceId =
    session.metadata?.priceId || subscription.items?.data?.[0]?.price?.id || subscription.metadata?.priceId || "";
  await applyStripeEvent({
    id: `checkout_return_${session.id}`,
    type: "customer.subscription.updated",
    data: {
      object: {
        id: subscription.id,
        status: subscription.status,
        customer: stripeId(subscription.customer) || stripeId(session.customer),
        metadata: {
          ...(subscription.metadata ?? {}),
          userId: input.userId,
          plan,
          ...(priceId ? { priceId } : {}),
        },
        trial_start: subscription.trial_start,
        trial_end: subscription.trial_end,
        cancel_at: subscription.cancel_at,
        cancel_at_period_end: subscription.cancel_at_period_end,
        current_period_end: subscription.current_period_end,
        items: subscription.items,
      },
    },
  });
  return { ok: true as const, reason: "stored" as const };
}

export async function fulfillCheckoutReturnForUser(input: {
  userId: string;
  sessionId: string;
  knownCustomerId?: string;
}) {
  const stripe = getStripe();
  if (!stripe) return { ok: false as const, reason: "pending" as const };
  return fulfillCheckoutSession({
    ...input,
    stripe: stripe as unknown as CheckoutStripe,
  });
}
