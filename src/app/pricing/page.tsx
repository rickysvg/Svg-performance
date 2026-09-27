import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { AiDisclaimer } from "@/components/billing/AiDisclaimer";
import { FinancingNote } from "@/components/billing/FinancingNote";
import { PricingCatalog } from "@/components/pricing/PricingCatalog";
import { getCurrentUser } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { getLatestSubscription, isStripeConfigured } from "@/lib/access";
import { getEffectivePlanId } from "@/lib/entitlements";
import { listSeatStatus } from "@/lib/waitlist";
import { BOOKING_OFFERS, PLAN_CATALOG } from "@/lib/plans";
import { isFoundingDealOpen } from "@/lib/pricing";

export default async function PricingPage() {
  const user = await getCurrentUser();
  const profile = user ? await getProfileForUser(user.id) : null;
  const subscription = user ? await getLatestSubscription(user.id) : null;
  const currentPlan = user ? await getEffectivePlanId(user.id) : null;
  const configured = isStripeConfigured();
  const seats = await listSeatStatus();
  const verified = Boolean(profile?.gymMembershipVerified);
  const foundingOpen = isFoundingDealOpen();

  return (
    <div className="min-h-full bg-white">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="font-display text-xs uppercase tracking-[0.06em] text-black">
          Proposal — not live billing
        </p>
        <h1 className="mt-2 text-3xl text-black">SVG Performance pricing</h1>
        <p className="mt-3 text-muted">
          Anyone can use this preview. SVG academy members may see member rates after an
          admin verifies them — checking a box does not unlock a price. Paid app plans are{" "}
          <strong className="text-foreground">additional to gym dues</strong> if you train
          at a gym. One subscription at a time — a higher plan replaces the lower one. Cards
          never touch this app. Access is granted only after a verified webhook.
        </p>
        <AiDisclaimer className="mt-3" />
        <FinancingNote configured={configured} className="mt-4" />
        {currentPlan ? (
          <p className="mt-4 rounded-xl border border-line bg-card p-4 text-sm">
            Current catalog plan: <strong>{PLAN_CATALOG[currentPlan].label}</strong>
            {subscription
              ? ` · recorded ${subscription.plan} / ${subscription.status}`
              : " · no webhook row yet"}
            .{" "}
            <Link href="/plan" className="text-accent underline">
              See credits
            </Link>
          </p>
        ) : null}
        {!configured ? (
          <p className="mt-4 rounded-xl border border-black bg-accent/20 p-4 text-sm text-black">
            Paid plans coming soon. The free plan and the no-card trial still work. Checkout
            will open when paid billing is ready.
          </p>
        ) : (
          <p className="mt-4 rounded-xl border border-black bg-accent/20 p-4 text-sm text-black">
            Paid plans coming soon. TEST price stubs exist, but buy buttons stay off until
            live billing is approved.
          </p>
        )}

        <div className="mt-10">
          <PricingCatalog
            verified={verified}
            foundingOpen={foundingOpen}
            userLoggedIn={Boolean(user)}
            seats={seats}
          />
        </div>

        <section className="mt-10 space-y-4">
          <article className="rounded-2xl border border-black bg-card p-6">
            <p className="font-display text-xs uppercase tracking-[0.06em] text-black">
              Request stub
            </p>
            <h3 className="mt-2 text-xl text-black">Platinum intensives</h3>
            <p className="mt-2 text-sm text-muted">
              {BOOKING_OFFERS.intensive_elpaso.summary} Not a live deposit. Intensives are
              a main pay-over-time use case, but this preview does not run Affirm or Klarna
              on Book stubs — we do not fake a purchase.
            </p>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted">
              <li>You travel to El Paso: {BOOKING_OFFERS.intensive_elpaso.priceLabel}</li>
              <li>Ricky travels: {BOOKING_OFFERS.intensive_travel.priceLabel}</li>
              <li>
                Package: six 60-min privates across 3 days, three 30-min daily reviews,
                written plan, one 30-min follow-up
              </li>
            </ul>
            <Link
              href="/book"
              className="touch-target mt-4 inline-flex items-center rounded-full bg-accent px-5 text-black"
            >
              Request on Book with Ricky
            </Link>
          </article>
        </section>

        <section className="mt-10 rounded-2xl border border-line bg-card p-6">
          <h2 className="text-lg text-black">Pricing FAQ / terms</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted">
            <li>Gym dues and SVG &amp; CO merch are separate from these app plans.</li>
            <li>
              Cancel a prepaid coaching program anytime: months used are charged at the
              monthly rate and the rest is refunded.
            </li>
            <li>
              Elite / VIP: human reply within 2 business days. Platinum: next business day.
              SVG Coach is not that inbox.
            </li>
            <li>Weight-cut services are not sold here.</li>
            <li>
              Founding member price applies to annual app plans only while{" "}
              {foundingOpen ? "the founding window is open" : "it was offered"}. No founding
              discount on coaching. Locked while you stay subscribed.
            </li>
            <li>
              Affirm / Klarna approval is theirs, not SVG’s. We do not store loan details.
              Not everyone qualifies. US shoppers and Stripe amount minimums apply.
            </li>
          </ul>
        </section>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link href={user ? "/home" : "/"} className="text-accent underline-offset-4 hover:underline">
            Back
          </Link>
          {user ? (
            <Link href="/book" className="text-accent underline-offset-4 hover:underline">
              Book with Ricky
            </Link>
          ) : null}
        </div>
      </main>
    </div>
  );
}
