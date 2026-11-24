import { NextResponse } from "next/server";
import { requireUserOrThrow } from "@/lib/session";
import { getLatestStripeSubscription } from "@/lib/access";
import { billingOriginFromRequest, createBillingPortalSession, getStripe } from "@/lib/stripe";
import { publicErrorMessage } from "@/lib/errors";
import { storeAppBlocksWebBilling } from "@/lib/native-app-server";
import { STORE_APP_BILLING_NOTE } from "@/lib/native-app";

export async function POST() {
  try {
    const user = await requireUserOrThrow();
    if (await storeAppBlocksWebBilling()) {
      return NextResponse.json({ error: STORE_APP_BILLING_NOTE }, { status: 403 });
    }
    const subscription = await getLatestStripeSubscription(user.id);
    const customerId = subscription?.stripeCustomerId?.trim() ?? "";
    if (!customerId) {
      return NextResponse.json({ error: "No billing account on this profile yet." }, { status: 400 });
    }
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });
    }
    const session = await createBillingPortalSession(stripe, {
      customerId,
      returnUrl: `${await billingOriginFromRequest()}/api/stripe/portal-return`,
    });
    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a billing portal URL." }, { status: 502 });
    }
    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 400 });
  }
}
