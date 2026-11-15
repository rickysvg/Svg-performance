import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { LegalLinks } from "@/components/LegalLinks";
import { BillingPlanStatus } from "@/components/billing/BillingPlanStatus";
import { ManageBillingButton } from "@/components/billing/ManageBillingButton";
import { getCurrentUser } from "@/lib/session";
import { getLatestSubscription } from "@/lib/access";
import { billingSuccessPlan } from "@/lib/billing-success";
import { getEffectivePlanId } from "@/lib/entitlements";
import { PLAN_CATALOG } from "@/lib/plans";
import { getTrialState } from "@/lib/trial";

export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; synced?: string }>;
}) {
  const query = await searchParams;
  const sessionId = typeof query.session_id === "string" ? query.session_id : "";
  if (sessionId.startsWith("cs_") && query.synced !== "1") {
    redirect(`/api/stripe/checkout-return?session_id=${encodeURIComponent(sessionId)}`);
  }
  const user = await getCurrentUser();
  const now = new Date();
  const loaded = user
    ? await Promise.all([
        getLatestSubscription(user.id),
        getTrialState(user.id, now),
        getEffectivePlanId(user.id, now),
      ])
    : null;
  const subscription = loaded?.[0] ?? null;
  const trial = loaded?.[1] ?? null;
  const planId = loaded?.[2] ?? null;
  const view = user
    ? billingSuccessPlan({
        sessionId,
        synced: query.synced === "1",
        trialActive: Boolean(trial?.trialActive),
        trialDaysLeft: trial?.trialDaysLeft ?? 0,
        trialLengthDays: trial?.trialLengthDays,
        verified: trial?.verified,
        timeZone: trial?.timeZone,
        planLabel: planId ? PLAN_CATALOG[planId].label : "Trial ended",
        subscription,
      })
    : { planLine: "Sign in to see your plan", confirming: false };

  return (
    <div className="min-h-full">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="text-2xl">Checkout returned</h1>
        <p className="mt-3 text-sm text-muted">
          This page shows the checkout saved for your account. Stripe’s webhook confirms the same
          subscription. No refunds except billing errors.
        </p>
        {view.confirming ? (
          <BillingPlanStatus sessionId={sessionId} />
        ) : (
          <p className="mt-4 text-sm" data-billing-plan data-billing-confirming="0">
            Your plan: {view.planLine}
          </p>
        )}
        {subscription?.stripeCustomerId ? (
          <div className="mt-4">
            <ManageBillingButton />
          </div>
        ) : null}
        <LegalLinks className="mt-6" />
        <Link href="/plan" className="mt-6 inline-flex text-accent underline">
          Your plan
        </Link>
      </main>
    </div>
  );
}
