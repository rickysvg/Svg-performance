import Link from "next/link";
import { continueFreePlanAction, startTrialAction } from "@/app/actions/trial";

export function PlanChoiceForm({
  verified,
  trialDays,
  canStartTrial = true,
}: {
  verified: boolean;
  trialDays: number;
  canStartTrial?: boolean;
}) {
  if (verified) {
    return (
      <div className="space-y-6">
        <div>
          <p className="font-display text-xs uppercase tracking-[0.06em] text-black">SVG Academy</p>
          <h1 className="font-display mt-2 text-3xl uppercase tracking-wide text-black">
            {canStartTrial ? `Pro free for ${trialDays} days` : "The core app is included"}
          </h1>
          <p className="mt-3 text-sm text-muted">
            Verified SVG Academy members get the core app with their dues: rounds, mobility and
            form libraries, standard SVG blocks, calendar, sparring log, weekly check-in, and Fuel
            logging. AI coach chat is free for your first week, then it is on Pro. Your first {trialDays} days
            are full Pro, no card. On day {trialDays + 1} you go back to the included tier. You
            are never auto-billed.
          </p>
        </div>
        <form action={canStartTrial ? startTrialAction : continueFreePlanAction}>
          <input type="hidden" name="next" value="/onboarding/deeper" />
          <button
            type="submit"
            className="touch-target w-full rounded-full bg-accent text-black"
          >
            {canStartTrial ? `Start my ${trialDays} days of free Pro` : "Continue"}
          </button>
        </form>
        <p className="text-sm text-muted">
          Pro is $9.99/mo or $72.99/yr. Want VIP Coaching?{" "}
          <Link href="/pricing" className="text-accent underline">
            See pricing
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-display text-xs uppercase tracking-[0.06em] text-black">SVG Pro</p>
        <h1 className="font-display mt-2 text-3xl uppercase tracking-wide text-black">
          Try Pro for {trialDays} days
        </h1>
        <p className="mt-3 text-sm text-muted">
          A {trialDays}-day Pro trial opens the full app. No card. After it ends, Pro is
          $9.99/mo or $72.99/yr to keep using the app. Your past data stays viewable and
          exportable. Train at SVG Academy? Verified members get the core app with their dues.
        </p>
      </div>

      {canStartTrial ? (
        <form action={startTrialAction} className="space-y-3">
          <input type="hidden" name="next" value="/onboarding/deeper" />
          <button
            type="submit"
            className="touch-target w-full rounded-full bg-accent text-black"
          >
            Start {trialDays} days of Pro, no card
          </button>
        </form>
      ) : (
        <Link
          href="/pricing"
          className="touch-target inline-flex w-full items-center justify-center rounded-full bg-accent text-black"
        >
          Subscribe to Pro
        </Link>
      )}

      <p className="text-sm text-muted">
        Checkout is coming soon. You can look at pricing anytime from Profile.
      </p>
    </div>
  );
}
