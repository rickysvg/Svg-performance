"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/session";
import { assertCanCheckoutPlan, isPlanId } from "@/lib/billing";
import { CHECKOUT_SKUS } from "@/lib/plans";
import { getLatestSubscription } from "@/lib/access";
import { accountTrialAlreadyUsed, checkoutTrialSpec } from "@/lib/checkout-trial";
import { prisma } from "@/lib/prisma";
import {
  billingOriginFromRequest,
  createBnplCheckoutSession,
  createSubscriptionCheckoutSession,
  getStripe,
} from "@/lib/stripe";
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
      throw new AppError("BILLING", "Billing is not configured. No charge was created.");
    }
    const appUrl = await billingOriginFromRequest();
    const [profile, subscription, prior] = await Promise.all([
      prisma.profile.findUnique({
        where: { userId: user.id },
        select: {
          gymMembershipVerified: true,
          trialStartedAt: true,
          trialEndsAt: true,
          memberProStartedAt: true,
          proTrialUsedAt: true,
        },
      }),
      getLatestSubscription(user.id),
      prisma.subscription.findMany({
        where: { userId: user.id },
        select: { trialStart: true, trialWillEnd: true, status: true },
      }),
    ]);
    const trial = checkoutTrialSpec({
      plan: planRaw,
      verified: Boolean(profile?.gymMembershipVerified),
      trialEndsAt: profile?.trialEndsAt,
      trialAlreadyUsed: accountTrialAlreadyUsed({
        trialStartedAt: profile?.trialStartedAt,
        trialEndsAt: profile?.trialEndsAt,
        memberProStartedAt: profile?.memberProStartedAt,
        proTrialUsedAt: profile?.proTrialUsedAt,
        stripeTrialSeen: prior.some(
          (row) => row.trialStart || row.trialWillEnd || row.status === "trialing",
        ),
      }),
    });
    const urls = {
      userId: user.id,
      plan: planRaw,
      successUrl: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${appUrl}/billing/cancel`,
    };
    const session =
      CHECKOUT_SKUS[planRaw].checkoutMode === "subscription"
        ? await createSubscriptionCheckoutSession(stripe, {
            ...urls,
            email: user.email,
            customerId: subscription?.stripeCustomerId,
            trialPeriodDays: trial.kind === "days" ? trial.days : 0,
            trialEnd: trial.kind === "end" ? trial.trialEnd : null,
          })
        : await createBnplCheckoutSession(stripe, urls);
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
