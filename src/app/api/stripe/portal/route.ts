import { NextResponse } from "next/server";
import { requireUserOrThrow } from "@/lib/session";
import { getLatestSubscription } from "@/lib/access";
import { billingOriginFromRequest, createBillingPortalSession, getStripe } from "@/lib/stripe";
import { publicErrorMessage } from "@/lib/errors";

export async function POST() {
  try {
    const user = await requireUserOrThrow();
    const subscription = await getLatestSubscription(user.id);
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
      returnUrl: `${await billingOriginFromRequest()}/plan`,
    });
    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a billing portal URL." }, { status: 502 });
    }
    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    return NextResponse.json({ error: publicErrorMessage(error) }, { status: 400 });
  }
}
