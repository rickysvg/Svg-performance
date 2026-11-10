import { NextResponse } from "next/server";
import { enforceCardFingerprint } from "@/lib/card-fingerprint";
import { applyStripeEvent } from "@/lib/billing";
import { getStripe, constructStripeEvent } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }
  const payload = await request.text();
  try {
    const event = constructStripeEvent(payload, signature);
    const result = await applyStripeEvent({
      id: event.id,
      type: event.type,
      created: event.created,
      livemode: event.livemode,
      data: { object: event.data.object as never },
    });
    const userId = result && typeof result === "object" && "userId" in result ? String(result.userId) : "";
    if (userId) {
      let stripe = null;
      try {
        stripe = getStripe();
      } catch {
        stripe = null;
      }
      const object = event.data.object as {
        subscription?: string | { id?: string } | null;
        default_payment_method?: string | { id?: string } | null;
        payment_method?: string | null;
        status?: string;
        trial_end?: number | null;
      };
      const subscriptionId =
        typeof object.subscription === "string"
          ? object.subscription
          : object.subscription?.id ||
            (event.type.startsWith("customer.subscription.")
              ? (event.data.object as { id?: string }).id || ""
              : "");
      const paymentMethodId =
        typeof object.default_payment_method === "string"
          ? object.default_payment_method
          : typeof object.payment_method === "string"
            ? object.payment_method
            : "";
      const profile = await prisma.profile.findUnique({
        where: { userId },
        select: { gymMembershipVerified: true },
      });
      const stored = await prisma.subscription.findFirst({
        where: { userId },
        orderBy: { updatedAt: "desc" },
      });
      await enforceCardFingerprint({
        stripe,
        userId,
        subscriptionId: subscriptionId.startsWith("sub_") ? subscriptionId : stored?.stripeSubscriptionId || "",
        paymentMethodId,
        trialing: stored?.status === "trialing" || object.status === "trialing",
        trialEnd: stored?.trialEnd ?? (object.trial_end ? new Date(object.trial_end * 1000) : null),
        verified: Boolean(profile?.gymMembershipVerified),
      });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
