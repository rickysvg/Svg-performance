import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getMemberEntitlements } from "@/lib/entitlements";
import { creditsForCurrentPlan } from "@/lib/credits";
import { getLatestSubscription, isStripeConfigured } from "@/lib/access";
import { PLAN_CATALOG } from "@/lib/plans";
import { AiDisclaimer } from "@/components/billing/AiDisclaimer";
import { FinancingNote } from "@/components/billing/FinancingNote";
import { TrialDaysLeft } from "@/components/upgrade/TrialDaysLeft";
import { getTrialState } from "@/lib/trial";

export default async function PlanPage() {
  const user = await requireUser();
  const [entitlements, creditBundle, subscription, trial] = await Promise.all([
    getMemberEntitlements(user.id),
    creditsForCurrentPlan(user.id),
    getLatestSubscription(user.id),
    getTrialState(user.id),
  ]);
  const configured = isStripeConfigured();
  const plan = entitlements.plan;

  return (
    <main className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-accent">
          {entitlements.preview ? "Preview entitlements (Stripe off)" : "Current plan"}
        </p>
        <h1 className="text-2xl">{plan.label}</h1>
        <p className="mt-2 text-sm text-muted">{plan.summary}</p>
        {trial.trialActive ? (
          <div className="mt-3">
            <TrialDaysLeft daysLeft={trial.trialDaysLeft} />
          </div>
        ) : null}
        <AiDisclaimer className="mt-2" />
      </div>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2>Status</h2>
        <p className="mt-2 text-sm text-muted">
          {entitlements.preview
            ? "Stripe TEST keys are not configured, so tools stay open and credits follow the highest preview catalog. Nobody is marked paid."
            : trial.trialActive
              ? "Performance trial is active. When it ends you return to the free plan automatically."
              : subscription
              ? `${subscription.plan} / ${subscription.status}${
                  subscription.source === "admin" ? " · admin override" : " · webhook"
                }`
              : "Member Access — no paid subscription row."}
        </p>
        {!configured ? (
          <p className="mt-3 text-sm text-muted">
            Checkout stays off until TEST keys exist.{" "}
            <Link href="/pricing" className="text-accent underline">
              Open pricing
            </Link>
          </p>
        ) : (
          <Link
            href="/pricing"
            className="touch-target mt-4 inline-flex items-center rounded-full bg-accent px-5 text-black"
          >
            Upgrade on Pricing
          </Link>
        )}
      </section>

      <FinancingNote configured={configured} />

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2>This billing month&apos;s credits</h2>
        <p className="mt-1 text-sm text-muted">
          Counts are per UTC month, not “weekly.” An admin marks a credit used after the session.
        </p>
        {creditBundle.credits.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            {PLAN_CATALOG[creditBundle.planId].label} does not include coaching credits.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {creditBundle.credits.map((row) => (
              <li key={row.id} className="flex justify-between gap-3 border-b border-line/60 py-2 last:border-0">
                <span>{row.label}</span>
                <span>
                  {row.remaining} left / {row.allotted}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2>What this plan opens</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
          {plan.includes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <p className="text-sm">
        <Link href="/book" className="text-accent underline-offset-4 hover:underline">
          Book with Ricky
        </Link>
        {" · "}
        <Link href="/pricing" className="text-accent underline-offset-4 hover:underline">
          All draft prices
        </Link>
      </p>
    </main>
  );
}
