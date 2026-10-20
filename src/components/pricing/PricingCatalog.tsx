import Link from "next/link";
import { WaitlistButton } from "@/components/billing/WaitlistButton";
import {
  ACADEMY_INCLUDES,
  COACHING_INCLUDES,
  COACHING_MONTHLY,
  coachingSpotsLine,
  foundingPriceLine,
  MEMBER_PRO_DAYS,
  NONMEMBER_TRIAL_DAYS,
  PERFORMANCE_MONTHLY,
  performanceAnnualLine,
  PRO_FAIR_USE_LINE,
  PRO_INCLUDES,
  PRO_LABEL,
  usd,
} from "@/lib/pricing";
import { PLAN_CATALOG } from "@/lib/plans";
import { startTrialAction } from "@/app/actions/trial";

function PlanCheckoutButton({
  canStartTrial,
  checkoutLive,
}: {
  canStartTrial: boolean;
  checkoutLive: boolean;
}) {
  if (checkoutLive) {
    return (
      <button
        type="button"
        disabled
        className="touch-target w-full rounded-full bg-accent text-black disabled:cursor-not-allowed"
      >
        Coming soon
      </button>
    );
  }
  if (canStartTrial) {
    return (
      <form action={startTrialAction}>
        <input type="hidden" name="next" value="/home" />
        <button
          type="submit"
          data-plan-action="trial"
          className="touch-target w-full rounded-full bg-accent text-black"
        >
          Start 7-day free trial
        </button>
      </form>
    );
  }
  return (
    <button
      type="button"
      disabled
      data-plan-action="subscribe"
      className="touch-target w-full rounded-full bg-accent text-black disabled:cursor-not-allowed"
    >
      Subscribe — opening Nov 16
    </button>
  );
}

export function PricingCatalog({
  verified,
  foundingOpen,
  foundingSpotsLeft,
  coachingSpotsLeft,
  coachingAtCap,
  userLoggedIn,
  canStartTrial = false,
  checkoutLive = false,
}: {
  verified: boolean;
  foundingOpen: boolean;
  foundingSpotsLeft: number | null;
  coachingSpotsLeft: number | null;
  coachingAtCap: boolean;
  userLoggedIn: boolean;
  canStartTrial?: boolean;
  checkoutLive?: boolean;
}) {
  const coaching = PLAN_CATALOG.coaching;

  return (
    <div className="space-y-4" data-pricing-plans="3">
      <article data-plan-card="performance" className="rounded-2xl border border-line bg-card p-5 text-foreground">
        <p className="font-display text-xs uppercase tracking-[0.06em] text-accent">App</p>
        <h2 className="mt-2 text-xl text-foreground">{PRO_LABEL}</h2>
        <p className="font-display stat-display mt-3 text-3xl text-accent">{usd(PERFORMANCE_MONTHLY)}/mo</p>
        <p className="mt-1 text-sm text-foreground">{performanceAnnualLine()}</p>
        {foundingOpen ? (
          <p className="mt-2 text-sm font-medium text-accent" data-founding-price>
            {foundingPriceLine(foundingSpotsLeft)}
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">Founding price is full.</p>
        )}
        <p className="mt-2 text-sm text-muted">
          Same price for everyone, academy members included. New here? Start with a{" "}
          {NONMEMBER_TRIAL_DAYS}-day Pro trial, no card. After the trial, Pro keeps the app
          open. Your past data stays viewable and exportable.
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted">
          {PRO_INCLUDES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted" data-fair-use>
          {PRO_FAIR_USE_LINE}
        </p>
        <div className="mt-5">
          <PlanCheckoutButton canStartTrial={canStartTrial} checkoutLive={checkoutLive} />
        </div>
      </article>

      <article data-plan-card="academy" className="rounded-2xl border border-line bg-card p-5 text-foreground">
        <p className="font-display text-xs uppercase tracking-[0.06em] text-accent">SVG Academy</p>
        <h2 className="mt-2 text-xl text-foreground">Academy member</h2>
        <p className="font-display stat-display mt-3 text-3xl text-accent">Included in dues</p>
        {verified ? (
          <p className="mt-2 text-sm text-foreground">You&apos;re verified. The core app comes with your dues.</p>
        ) : (
          <p className="mt-2 text-sm text-muted">For verified SVG Academy members (Gymdesk member check).</p>
        )}
        <p className="mt-2 text-sm text-muted">
          Pro free for your first {MEMBER_PRO_DAYS} days, no card. On day {MEMBER_PRO_DAYS + 1} you
          go back to the included tier. Never auto-billed. Upgrade to Pro anytime for{" "}
          {usd(PERFORMANCE_MONTHLY)}/mo.
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted">
          {ACADEMY_INCLUDES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </article>

      <article data-plan-card="coaching" className="rounded-2xl border border-line bg-card p-5 text-foreground">
        <p className="font-display text-xs uppercase tracking-[0.06em] text-accent">Coaching</p>
        <h2 className="mt-2 text-xl text-foreground">{coaching.label}</h2>
        <p className="font-display stat-display mt-3 text-3xl text-accent">{usd(COACHING_MONTHLY)}/mo</p>
        <p className="mt-1 text-sm text-foreground" data-coaching-spots>
          {coachingSpotsLine(coachingSpotsLeft)}
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted">
          {COACHING_INCLUDES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="mt-5">
          {coachingAtCap ? (
            userLoggedIn ? (
              <WaitlistButton plan="coaching" />
            ) : (
              <p className="text-sm text-muted">Log in to join the waitlist.</p>
            )
          ) : (
            <PlanCheckoutButton canStartTrial={false} checkoutLive={checkoutLive} />
          )}
        </div>
      </article>

      <p className="text-sm text-muted">
        VIP is by application. In-person intensives and VIP: apply through{" "}
        <Link href="/book" className="text-accent underline">
          Book with Ricky
        </Link>
        .
      </p>
    </div>
  );
}
