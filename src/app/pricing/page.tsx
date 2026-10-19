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
import { currentPlanLine, getTrialState } from "@/lib/trial";
import { isTesterFlagActive } from "@/lib/tester-access";
import { countFoundingSeats } from "@/lib/billing";

export default async function PricingPage() {
  const user = await getCurrentUser();
  const profile = user ? await getProfileForUser(user.id) : null;
  const subscription = user ? await getLatestSubscription(user.id) : null;
  const currentPlan = user ? await getEffectivePlanId(user.id) : null;
  const configured = isStripeConfigured();
  const verified = Boolean(profile?.gymMembershipVerified);
  const trial = user ? await getTrialState(user.id) : null;
  const canStartTrial = Boolean(trial?.canStartTrial);
  let foundingUsed = 0;
  try {
    foundingUsed = Math.min(FOUNDING_CAP, await countFoundingSeats());
  } catch {
    foundingUsed = 0;
  }
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
          One Pro price for everyone. Verified SVG Academy members get the core app with their
          dues and Pro free for 30 days.
        </p>
        <AiDisclaimer className="mt-3" />
        {currentPlan ? (
          <p className="mt-4 rounded-xl border border-line bg-card p-4 text-sm">
            Current plan:{" "}
            <strong data-current-plan>
              {currentPlanLine({
                trialActive: Boolean(trial?.trialActive),
                trialDaysLeft: trial?.trialDaysLeft ?? 0,
                planLabel: PLAN_CATALOG[currentPlan].label,
                tester: isTesterFlagActive(Boolean(profile?.tester)),
              })}
            </strong>
            {subscription ? ` · recorded ${subscription.plan} / ${subscription.status}` : ""}.{" "}
            <Link href="/plan" className="text-accent underline">
              See your plan
            </Link>
          </p>
        ) : null}
        <p className="mt-4 rounded-xl border border-black bg-accent/20 p-4 text-sm text-black" data-pricing-banner>
          {canStartTrial
            ? "The 7-day Pro trial is open now, no card. Paid checkout opens Nov 16."
            : "Paid checkout opens Nov 16. A trial can be used once per account."}
          {verified ? " Your verified academy membership includes the core app and a free Pro month." : ""}
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
            canStartTrial={canStartTrial}
            checkoutLive={false}
          />
        </div>

        <section className="mt-10 rounded-2xl border border-line bg-card p-6">
          <h2 className="text-lg text-black">Pricing FAQ</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted">
            <li>Nonmembers get a 7-day Pro trial with no card. After it ends, Pro ($9.99/mo or $72.99/yr) keeps the app open. You can always view and export your past data.</li>
            <li>Verified SVG Academy members get the core app with their dues (checked with the Gymdesk member match), plus Pro free for 30 days. On day 31 you go back to the included tier. You are never auto-billed.</li>
            <li>Pro is $9.99/month or $72.99/year for everyone, academy members included. Founding annual is $59 for the first 100 members.</li>
            <li>Pro fair use: 30 AI messages, 20 minutes of voice, and 1 read-aloud a day.</li>
            <li>1-on-1 Coaching with Ricky is $249/month, includes Pro, and is limited to 20 athletes. VIP is by application.</li>
            <li>Logging, timers, and class programming stay open for academy members and Pro subscribers. Nonmembers have full access during the 7-day trial, then subscribe to Pro to keep training. Past data stays viewable and exportable.</li>
            <li>Academy Gymdesk dues are billed by the gym and are not changed here.</li>
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
