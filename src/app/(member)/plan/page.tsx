import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getMemberEntitlements } from "@/lib/entitlements";
import { creditsForCurrentPlan } from "@/lib/credits";
import { getLatestSubscription, isStripeConfigured } from "@/lib/access";
import { PLAN_CATALOG } from "@/lib/plans";
import { AiDisclaimer } from "@/components/billing/AiDisclaimer";
import { FinancingNote } from "@/components/billing/FinancingNote";
import { currentPlanLine, getTrialState } from "@/lib/trial";

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
        <p className="text-xs font-bold uppercase tracking-wide text-accent">Current plan</p>
        <h1 className="text-2xl" data-current-plan>
          {currentPlanLine({
            trialActive: trial.trialActive,
            trialDaysLeft: trial.trialDaysLeft,
            trialLengthDays: trial.trialLengthDays,
            verified: trial.verified,
            planLabel: plan.label,
          })}
        </h1>
        <p className="mt-2 text-sm text-muted">{plan.summary}</p>
        <AiDisclaimer className="mt-2" />
      </div>

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2>Status</h2>
        <p className="mt-2 text-sm text-muted">
          {trial.verified && trial.trialActive && !subscription
            ? `Verified SVG Academy member. Your ${trial.trialLengthDays} days of free Pro are active. After they end you go back to the core app included with your dues. You are never auto-billed.`
            : trial.verified && entitlements.planId === "academy"
              ? "Verified SVG Academy member. The core app is included with your dues. AI coach chat is free for your first week, then it is on Pro. Pro is $9.99/mo or $72.99/yr."
            : trial.trialActive
              ? `Your ${trial.trialLengthDays}-day Pro trial is active. No card. When it ends, Pro keeps the app open. Your past data stays viewable and exportable.`
            : subscription
              ? `${subscription.plan} / ${subscription.status}${
                  subscription.source === "admin" ? " · admin override" : " · webhook"
                }`
              : "Your trial ended. Subscribe to Pro to keep training in the app. You can still view and export your past data."}
        </p>
        {!configured ? (
          <p className="mt-3 text-sm text-muted">
            Paid plans coming soon.{" "}
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
