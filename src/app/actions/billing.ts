"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/session";
import { assertCanCheckoutPlan, isPlanId } from "@/lib/billing";
import {
  billingReturnUrls,
  createBillingPortalSession,
  createBnplCheckoutSession,
  getStripe,
} from "@/lib/stripe";
import { AppError } from "@/lib/errors";
import { publicErrorMessage } from "@/lib/errors";
import { joinWaitlist } from "@/lib/waitlist";
import { prisma } from "@/lib/prisma";

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
        "Stripe is not configured. No card or Affirm/Klarna charge will be created.",
      );
    }
    const existingCustomer = await prisma.subscription.findFirst({
      where: { userId: user.id, stripeCustomerId: { not: "" } },
      orderBy: { updatedAt: "desc" },
      select: { stripeCustomerId: true },
    });
    const urls = billingReturnUrls();
    const session = await createBnplCheckoutSession(stripe, {
      userId: user.id,
      plan: planRaw,
      successUrl: urls.successUrl,
      cancelUrl: urls.cancelUrl,
      customerId: existingCustomer?.stripeCustomerId || undefined,
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

export async function openBillingPortalAction(
  _prev: BillingActionState,
  _formData: FormData,
): Promise<BillingActionState> {
  try {
    const user = await requireUserOrThrow();
    const stripe = getStripe();
    if (!stripe) {
      throw new AppError("BILLING", "Stripe is not configured.");
    }
    const row = await prisma.subscription.findFirst({
      where: { userId: user.id, stripeCustomerId: { not: "" } },
      orderBy: { updatedAt: "desc" },
    });
    if (!row?.stripeCustomerId) {
      throw new AppError(
        "BILLING",
        "No Stripe customer is on file yet. Checkout first, then you can manage billing.",
      );
    }
    const session = await createBillingPortalSession(stripe, {
      customerId: row.stripeCustomerId,
      returnUrl: billingReturnUrls().portalReturnUrl,
    });
    if (!session.url) {
      throw new AppError("BILLING", "Stripe did not return a billing portal URL.");
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
