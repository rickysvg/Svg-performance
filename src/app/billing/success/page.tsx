import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { LegalLinks } from "@/components/LegalLinks";
import { BillingPendingNote } from "@/components/billing/BillingPendingNote";
import { ManageBillingButton } from "@/components/billing/ManageBillingButton";
import { getCurrentUser } from "@/lib/session";
import { getLatestSubscription } from "@/lib/access";
import { currentPlanLine, getTrialState } from "@/lib/trial";

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
  const subscription = user ? await getLatestSubscription(user.id) : null;
  const trial = user ? await getTrialState(user.id) : null;
  const pending = Boolean(sessionId) && !subscription?.stripeCustomerId;
  // Same plan line as Profile and Plan. An incomplete VIP checkout does not replace a Pro trial.
  const planLine = user
    ? currentPlanLine({
        trialActive: Boolean(trial?.trialActive),
        trialDaysLeft: trial?.trialDaysLeft ?? 0,
        trialLengthDays: trial?.trialLengthDays,
        verified: trial?.verified,
        planLabel: "waiting on Stripe",
        subscription,
      })
    : "waiting on Stripe";

  return (
    <div className="min-h-full">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="text-2xl">Checkout returned</h1>
        <p className="mt-3 text-sm text-muted">
          This page shows the checkout saved for your account. Stripe’s webhook confirms the same
          subscription. No refunds except billing errors.
        </p>
        <p className="mt-4 text-sm" data-billing-plan>
          Your plan:{" "}
          {planLine}
        </p>
        {pending ? <BillingPendingNote /> : null}
        {subscription?.stripeCustomerId ? (
          <div className="mt-4">
            <ManageBillingButton />
          </div>
        ) : null}
        <LegalLinks className="mt-6" />
        <Link
          href={pending ? "/plan?billing=pending" : "/plan"}
          className="mt-6 inline-flex text-accent underline"
        >
          Your plan
        </Link>
      </main>
    </div>
  );
}
