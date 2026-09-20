"use server";

import { redirect } from "next/navigation";
import { requireUserOrThrow } from "@/lib/session";
import { assertCanCheckoutPlan, isPlanId, priceIdForPlan } from "@/lib/billing";
import { getStripe } from "@/lib/stripe";
import { AppError } from "@/lib/errors";
import { publicErrorMessage } from "@/lib/errors";

export type BillingActionState = { error?: string };

export async function startCheckoutAction(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  try {
    const user = await requireUserOrThrow();
    const planRaw = String(formData.get("plan") ?? "");
    if (!isPlanId(planRaw)) {
      throw new AppError("BILLING", "Pick a valid plan.");
    }
    await assertCanCheckoutPlan(user.id, planRaw);
    const stripe = getStripe();
    if (!stripe) {
      throw new AppError(
        "BILLING",
        "Stripe TEST is not configured. No card will be charged.",
      );
    }
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: user.id,
      success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/billing/cancel`,
      line_items: [{ price: priceIdForPlan(planRaw), quantity: 1 }],
      metadata: { userId: user.id, plan: planRaw },
      subscription_data: { metadata: { userId: user.id, plan: planRaw } },
    });
    if (!session.url) {
      throw new AppError("BILLING", "Stripe did not return a checkout URL.");
    }
    redirect(session.url);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) {
      throw error;
    }
    return { error: publicErrorMessage(error) };
  }
}
