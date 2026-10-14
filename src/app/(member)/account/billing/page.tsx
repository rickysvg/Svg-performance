import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getLatestSubscription, isStripeConfigured } from "@/lib/access";
import { ManageBillingButton } from "@/components/billing/ManageBillingButton";
import { normalizePlanId, PLAN_CATALOG } from "@/lib/plans";

export default async function AccountBillingPage() {
  const user = await requireUser();
  const subscription = await getLatestSubscription(user.id);
  const configured = isStripeConfigured();
  const hasCustomer = Boolean(subscription?.stripeCustomerId);
  const planLabel = subscription
    ? PLAN_CATALOG[normalizePlanId(subscription.plan)].label
    : "Member Access";

  return (
    <main className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-accent">Account</p>
        <h1 className="text-2xl">Billing</h1>
        <p className="mt-2 text-sm text-muted">
          Cancel, update your card, or see invoices in Stripe. This app never stores card
          numbers.
        </p>
      </div>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2>Current plan</h2>
        <p className="mt-2 text-sm">
          {planLabel}
          {subscription ? ` · ${subscription.status}` : " · no paid subscription"}
          {subscription?.source === "admin" ? " · admin override" : ""}
          {subscription?.source === "gym_unverified" ? " · gym price needs review" : ""}
        </p>
        {subscription?.currentPeriodEnd ? (
          <p className="mt-2 text-sm text-muted">
            Access through{" "}
            {subscription.currentPeriodEnd.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            .
          </p>
        ) : subscription?.source === "admin" && subscription.status === "active" ? (
          <p className="mt-2 text-sm text-muted">Admin comp with no end date.</p>
        ) : null}
        {configured && hasCustomer ? (
          <div className="mt-4">
            <ManageBillingButton />
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">
            {configured
              ? "Checkout first, then you can manage billing here."
              : "Paid plans coming soon. Billing management opens when Stripe is configured."}
          </p>
        )}
      </section>

      <p className="text-sm">
        <Link href="/plan" className="text-accent underline-offset-4 hover:underline">
          Plan and credits
        </Link>
        {" · "}
        <Link href="/pricing" className="text-accent underline-offset-4 hover:underline">
          Pricing
        </Link>
      </p>
    </main>
  );
}
