import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { AiDisclaimer } from "@/components/billing/AiDisclaimer";
import { PricingCatalog } from "@/components/pricing/PricingCatalog";
import { getCurrentUser } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { getLatestSubscription, isStripeConfigured } from "@/lib/access";
import { getEffectivePlanId } from "@/lib/entitlements";
import { countActiveSeats } from "@/lib/waitlist";
import { PLAN_CATALOG } from "@/lib/plans";
import { COACHING_CAP, FOUNDING_CAP, isFoundingDealOpen } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";

export default async function PricingPage() {
  const user = await getCurrentUser();
  const profile = user ? await getProfileForUser(user.id) : null;
  const subscription = user ? await getLatestSubscription(user.id) : null;
  const currentPlan = user ? await getEffectivePlanId(user.id) : null;
  const configured = isStripeConfigured();
  const verified = Boolean(profile?.gymMembershipVerified);
  const foundingUsed = await prisma.subscription.count({
    where: { status: "active", plan: { contains: "founding" } },
  });
  const foundingOpen = isFoundingDealOpen(foundingUsed);
  let coachingSeats = 0;
  let coachingSpotsLeft: number | null = COACHING_CAP;
  try {
    coachingSeats = await countActiveSeats("coaching");
    coachingSpotsLeft = Math.max(0, COACHING_CAP - coachingSeats);
  } catch {
    coachingSpotsLeft = null;
  }

  return (
    <div className="min-h-full bg-white">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="font-display text-xs uppercase tracking-[0.06em] text-black">App plans</p>
        <h1 className="mt-2 text-3xl text-black">SVG Performance pricing</h1>
        <p className="mt-3 text-muted">
          Three options. These prices are for the app only. Gymdesk dues are separate and are
          not changed here.
        </p>
        <AiDisclaimer className="mt-3" />
        {currentPlan ? (
          <p className="mt-4 rounded-xl border border-line bg-card p-4 text-sm">
            Current plan: <strong>{PLAN_CATALOG[currentPlan].label}</strong>
            {subscription ? ` · recorded ${subscription.plan} / ${subscription.status}` : ""}.{" "}
            <Link href="/plan" className="text-accent underline">
              See your plan
            </Link>
          </p>
        ) : null}
        <p className="mt-4 rounded-xl border border-black bg-accent/20 p-4 text-sm text-black">
          Paid plans coming soon. The free plan and the 7-day trial still work.
          {verified ? " Your verified academy membership already includes the full app." : ""}{" "}
          Checkout stays off until paid billing is ready.
          {configured ? " TEST billing stubs do not turn the buttons on." : ""}
        </p>

        <div className="mt-8">
          <PricingCatalog
            verified={verified}
            foundingOpen={foundingOpen}
            foundingSpotsLeft={Math.max(0, FOUNDING_CAP - foundingUsed)}
            coachingSpotsLeft={coachingSpotsLeft}
            coachingAtCap={coachingSpotsLeft === 0}
            userLoggedIn={Boolean(user)}
          />
        </div>

        <section className="mt-10 rounded-2xl border border-line bg-card p-6">
          <h2 className="text-lg text-black">Pricing FAQ</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted">
            <li>Gym dues and SVG &amp; CO merch are separate from these app plans.</li>
            <li>Verified SVG Academy members get the full app free. That check uses the existing Gymdesk member match.</li>
            <li>Nonmembers get a 7-day trial, then the basic free version.</li>
            <li>SVG Performance is one price: $9.99/month or $79/year. Founding annual is $59 for the first 250 members.</li>
            <li>1-on-1 Coaching with Ricky is $249/month and limited to 20 athletes.</li>
            <li>Weight-cut services are not sold here.</li>
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
