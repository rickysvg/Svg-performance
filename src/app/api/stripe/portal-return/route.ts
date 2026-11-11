import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { getLatestSubscription } from "@/lib/access";
import { getStripe } from "@/lib/stripe";
import { applyStripeEvent } from "@/lib/stripe-webhook";

/** Pulls cancel_at after the Customer Portal and sends the member back to Plan. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const user = await getCurrentUser();
  if (!user) {
    const login = new URL("/login", url.origin);
    login.searchParams.set("next", "/api/stripe/portal-return");
    return NextResponse.redirect(login);
  }
  const existing = await getLatestSubscription(user.id);
  const stripe = getStripe();
  const subscriptionId = existing?.stripeSubscriptionId ?? "";
  if (stripe && subscriptionId.startsWith("sub_")) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await applyStripeEvent({
        id: `portal_return_${subscription.id}_${subscription.status}_${subscription.cancel_at ?? 0}_${subscription.cancel_at_period_end ? 1 : 0}`,
        type: "customer.subscription.updated",
        data: {
          object: {
            id: subscription.id,
            status: subscription.status,
            customer:
              typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
            metadata: {
              ...(subscription.metadata ?? {}),
              userId: subscription.metadata?.userId || user.id,
              plan: subscription.metadata?.plan || existing?.billingSku || existing?.plan || "",
            },
            trial_start: subscription.trial_start,
            trial_end: subscription.trial_end,
            cancel_at: subscription.cancel_at,
            cancel_at_period_end: subscription.cancel_at_period_end,
            current_period_end: subscription.items?.data?.[0]?.current_period_end,
            items: {
              data: subscription.items?.data?.map((item) => ({
                price: { id: item.price?.id },
                current_period_end: item.current_period_end,
              })),
            },
          },
        },
      });
      revalidatePath("/plan");
      revalidatePath("/profile");
      revalidatePath("/home");
    } catch {
      // The webhook still updates the row. Plan renders with what is stored.
    }
  }
  return NextResponse.redirect(new URL("/plan", url.origin));
}
