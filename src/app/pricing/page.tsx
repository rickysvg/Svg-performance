import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { LegalLinks } from "@/components/LegalLinks";
import { AiDisclaimer } from "@/components/billing/AiDisclaimer";
import { PricingCatalog } from "@/components/pricing/PricingCatalog";
import { getCurrentUser } from "@/lib/session";
import { getProfileForUser } from "@/lib/profile";
import { getLatestSubscription } from "@/lib/access";
import { getEffectivePlanId } from "@/lib/entitlements";
import { PLAN_CATALOG } from "@/lib/plans";
import {
  MEMBER_PRO_DAYS,
  NONMEMBER_TRIAL_DAYS,
  PRO_AI_MESSAGES_PER_DAY,
  performancePriceLine,
  proAccessSummary,
} from "@/lib/pricing";
import { currentPlanLine, getTrialState } from "@/lib/trial";
import { getVipPricingPhase } from "@/lib/vip-store";

export default async function PricingPage() {
  const user = await getCurrentUser();
  const profile = user ? await getProfileForUser(user.id) : null;
  const subscription = user ? await getLatestSubscription(user.id) : null;
  const currentPlan = user ? await getEffectivePlanId(user.id) : null;
  const verified = Boolean(profile?.gymMembershipVerified);
  const trial = user ? await getTrialState(user.id) : null;
  const canStartTrial = Boolean(trial?.canStartTrial);
  const vipPhase = await getVipPricingPhase(user?.id ?? null);

  return (
    <div className="min-h-full bg-background text-foreground">
      <AppHeader email={user?.email} />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="font-display text-xs uppercase tracking-[0.06em] text-accent">App plans</p>
        <h1 className="mt-2 text-3xl text-foreground">SVG Performance pricing</h1>
        <p className="mt-3 text-foreground">
          SVG Performance is for athletes anywhere. Pro is {performancePriceLine()}. {proAccessSummary()}
        </p>
        <AiDisclaimer className="mt-3" />
        {currentPlan ? (
          <p className="mt-4 rounded-xl border border-line bg-card p-4 text-sm text-foreground">
            Current plan:{" "}
            <strong data-current-plan>
              {currentPlanLine({
                trialActive: Boolean(trial?.trialActive),
                trialDaysLeft: trial?.trialDaysLeft ?? 0,
                planLabel: PLAN_CATALOG[currentPlan].label,
                subscription,
              })}
            </strong>
            {". "}
            <Link href="/plan" className="text-accent underline">
              See your plan
            </Link>
          </p>
        ) : null}
        <p className="mt-4 rounded-xl border border-accent bg-card p-4 text-sm text-foreground" data-pricing-banner>
          {canStartTrial
            ? verified
              ? `Your ${MEMBER_PRO_DAYS} days of free Pro are ready, no card. You are never auto-billed.`
              : `The ${NONMEMBER_TRIAL_DAYS}-day Pro trial is open now, no card.`
            : "A no-card trial can be used once per account."}{" "}
          One Pro trial per person. Subscribing during your trial keeps the days that are left when more than 48 hours remain. VIP Coaching is billed today with no trial.
          {verified && !canStartTrial
            ? ` Your verified academy membership includes the core app and ${MEMBER_PRO_DAYS} days of Pro free.`
            : ""}
        </p>

        <div className="mt-8">
          <PricingCatalog
            verified={verified}
            vipPhase={vipPhase}
            userLoggedIn={Boolean(user)}
            canStartTrial={canStartTrial}
          />
        </div>

        <section className="mt-10 rounded-2xl border border-line bg-card p-6">
          <h2 className="text-lg text-foreground">Pricing FAQ</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-foreground">
            <li>Nonmembers get a {NONMEMBER_TRIAL_DAYS}-day Pro trial with no card. After it ends unpaid, history and progress stay viewable (read-only). Training, logging, timers, the AI coach, and downloads stay off until you subscribe. Pro is $9.99/mo or $72.99/yr.</li>
            <li>Verified SVG Academy members get the core app with their dues (checked with the Gymdesk member match), plus Pro free for {MEMBER_PRO_DAYS} days. On day {MEMBER_PRO_DAYS + 1} you go back to the included tier. You are never auto-billed. AI coach chat is not part of the academy tier after the first week.</li>
            <li>AI coach chat is free for your first week from signup, no card. After that week it stays open on Pro, VIP Coaching, and an active {NONMEMBER_TRIAL_DAYS}-day Pro trial. The academy Pro grant does not extend chat.</li>
            <li>Pro is $9.99/month or $72.99/year (save 39%) for everyone, academy members included.</li>
            <li>Pro fair use: {PRO_AI_MESSAGES_PER_DAY} AI messages a day.</li>
            <li>VIP Coaching is $249/month and includes Pro. Limited spots. Verified academy members pay $149 the first month, then $249. Pro subscribers who are not academy members can get a one-time credit of up to $30. Ricky replies within 48 hours.</li>
            <li>Logging, timers, and class programming stay open for academy members and Pro subscribers. Nonmembers have full access during the {NONMEMBER_TRIAL_DAYS}-day trial. After that, history stays viewable (read-only) until they subscribe.</li>
            <li>Academy Gymdesk dues are billed by the gym and are not changed here.</li>
            <li>Weight-cut services are not sold here.</li>
          </ul>
        </section>

        <LegalLinks className="mt-8" />
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
