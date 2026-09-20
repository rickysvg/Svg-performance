import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getCurrentUser } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { getLatestSubscription } from "@/lib/access";
import { isStripeConfigured } from "@/lib/access";
import { CheckoutButton } from "@/components/billing/CheckoutButton";

export default async function PricingPage() {
  const user = await getCurrentUser();
  const profile = user ? await getProfileForUser(user.id) : null;
  const subscription = user ? await getLatestSubscription(user.id) : null;
  const configured = isStripeConfigured();

  return (
    <div className="min-h-full">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
          Proposal / Stripe TEST only — not live billing
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Draft subscription prices</h1>
        <p className="mt-3 text-muted">
          Cards never touch this app. If TEST keys are set, Stripe Checkout
          opens and access is granted only after a verified webhook. The
          success page does not unlock anything by itself.
        </p>
        {subscription ? (
          <p className="mt-4 rounded-xl border border-line bg-card p-4 text-sm">
            Latest recorded status: <strong>{subscription.plan}</strong> /{" "}
            {subscription.status}. This updates from webhooks, not from the
            browser return URL.
          </p>
        ) : null}
        {!configured ? (
          <p className="mt-4 rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm">
            Stripe TEST keys are not in this environment. Checkout buttons stay
            off on purpose so we do not fake paid access.
          </p>
        ) : null}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-line bg-card p-6">
            <h2 className="text-lg font-semibold">Verified gym member</h2>
            <p className="mt-2 text-3xl font-semibold text-accent">
              $19<span className="text-base text-muted">/mo</span>
            </p>
            <p className="mt-3 text-sm text-muted">
              Only after an admin verifies SVG membership. Checking a box
              yourself does not unlock this price.
            </p>
            <div className="mt-4">
              <CheckoutButton
                plan="gym"
                label="Start $19 TEST checkout"
                disabledReason={
                  !user
                    ? "Log in first."
                    : !configured
                      ? "Stripe TEST is not configured."
                      : !profile?.gymMembershipVerified
                        ? "Admin has not verified this gym membership yet."
                        : undefined
                }
              />
            </div>
          </article>
          <article className="rounded-2xl border border-line bg-card p-6">
            <h2 className="text-lg font-semibold">Standalone subscriber</h2>
            <p className="mt-2 text-3xl font-semibold">
              $29<span className="text-base text-muted">/mo</span>
            </p>
            <p className="mt-3 text-sm text-muted">
              Proposed price when you are not a verified gym member.
            </p>
            <div className="mt-4">
              <CheckoutButton
                plan="standalone"
                label="Start $29 TEST checkout"
                disabledReason={
                  !user
                    ? "Log in first."
                    : !configured
                      ? "Stripe TEST is not configured."
                      : undefined
                }
              />
            </div>
          </article>
        </div>
        <Link href={user ? "/home" : "/"} className="mt-8 inline-flex text-accent underline-offset-4 hover:underline">
          Back
        </Link>
      </main>
    </div>
  );
}
