import Link from "next/link";
import { continueFreePlanAction, startTrialAction } from "@/app/actions/trial";

export function PlanChoiceForm({
  verified,
  trialDays,
}: {
  verified: boolean;
  trialDays: number;
}) {
  if (verified) {
    return (
      <div className="space-y-6">
        <div>
          <p className="font-display text-xs uppercase tracking-[0.06em] text-black">Free</p>
          <h1 className="font-display mt-2 text-3xl uppercase tracking-wide text-black">
            The full app is included
          </h1>
          <p className="mt-3 text-sm text-muted">
            Verified SVG Academy members get every app feature free. Gym dues stay on Gymdesk
            and are not part of this price.
          </p>
        </div>
        <form action={continueFreePlanAction}>
          <input type="hidden" name="next" value="/onboarding/deeper" />
          <button
            type="submit"
            className="touch-target w-full rounded-full bg-accent text-black"
          >
            Continue
          </button>
        </form>
        <p className="text-sm text-muted">
          Want 1-on-1 with Ricky later?{" "}
          <Link href="/pricing" className="text-accent underline">
            See pricing
          </Link>
          . Checkout is coming soon.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-display text-xs uppercase tracking-[0.06em] text-black">Free</p>
        <h1 className="font-display mt-2 text-3xl uppercase tracking-wide text-black">
          Start with {trialDays} days
        </h1>
        <p className="mt-3 text-sm text-muted">
          A {trialDays}-day trial opens the full app. After that, the free version is the
          workout log, timers, and 1 sample plan. SVG Performance is $9.99/mo or $79/yr.
          Academy members get the full app free once verified.
        </p>
      </div>

      <form action={startTrialAction} className="space-y-3">
        <input type="hidden" name="next" value="/onboarding/deeper" />
        <button
          type="submit"
          className="touch-target w-full rounded-full bg-accent text-black"
        >
          Start {trialDays} days free
        </button>
      </form>

      <form action={continueFreePlanAction}>
        <input type="hidden" name="next" value="/onboarding/deeper" />
        <button
          type="submit"
          className="touch-target w-full rounded-full border border-black bg-white font-semibold text-black"
        >
          Continue with the free plan
        </button>
      </form>

      <p className="text-sm text-muted">
        Paid checkout is coming soon. You can look at pricing anytime from Profile.
      </p>
    </div>
  );
}
