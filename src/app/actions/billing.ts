"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/session";
import { assertCanCheckoutPlan, isPlanId } from "@/lib/billing";
import { createBnplCheckoutSession, getStripe } from "@/lib/stripe";
import { AppError } from "@/lib/errors";
import { publicErrorMessage } from "@/lib/errors";
import { joinWaitlist } from "@/lib/waitlist";

export type BillingActionState = { error?: string; success?: string };

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
        "Stripe TEST is not configured. No card or Affirm/Klarna charge will be created.",
      );
    }
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const session = await createBnplCheckoutSession(stripe, {
      userId: user.id,
      plan: planRaw,
      successUrl: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${appUrl}/billing/cancel`,
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

export async function joinWaitlistAction(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  try {
    const user = await requireUserOrThrow();
    await joinWaitlist(user.id, String(formData.get("plan") ?? ""));
    revalidatePath("/pricing");
    revalidatePath("/plan");
    return { success: "You are on the waitlist. This is not a charge." };
  } catch (error) {
    return { error: publicErrorMessage(error) };
  }
}
