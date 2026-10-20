import Link from "next/link";
import { WaitlistButton } from "@/components/billing/WaitlistButton";
import {
  ACADEMY_EXPECT,
  ACADEMY_INCLUDES,
  COACHING_ADDS,
  COACHING_EXPECT,
  COACHING_MONTHLY,
  coachingSpotsLine,
  MEMBER_PRO_DAYS,
  NONMEMBER_TRIAL_DAYS,
  PERFORMANCE_MONTHLY,
  performanceAnnualLine,
  PRO_ADDS,
  PRO_EXPECT,
  PRO_FAIR_USE_LINE,
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

function TierList({
  items,
  tone,
}: {
  items: readonly string[];
  tone: "base" | "add";
}) {
  const added = tone === "add";
  return (
    <ul className="mt-4 space-y-2" data-tier-list={tone}>
      {items.map((item) => (
        <li
          key={item}
          className={`flex items-start gap-2 text-sm ${added ? "font-medium text-accent" : "text-foreground"}`}
        >
          <span aria-hidden="true" className="text-accent">
            ✓
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function PricingCatalog({
  verified,
  coachingSpotsLeft,
  coachingAtCap,
  userLoggedIn,
  canStartTrial = false,
  checkoutLive = false,
}: {
  verified: boolean;
  coachingSpotsLeft: number | null;
  coachingAtCap: boolean;
  userLoggedIn: boolean;
  canStartTrial?: boolean;
  checkoutLive?: boolean;
}) {
  const coaching = PLAN_CATALOG.coaching;

  return (
    <div className="space-y-4" data-pricing-plans="3">
      <article data-plan-card="academy" className="rounded-2xl border border-line bg-card p-5 text-foreground">
        <p className="font-display text-xs uppercase tracking-[0.06em] text-accent">SVG Academy</p>
        <h2 className="mt-2 text-xl text-foreground">SVG Academy gym member</h2>
        <p className="mt-3 text-base font-medium leading-snug text-accent" data-academy-membership>
          Free version included with gym membership at our academy
        </p>
        <p className="mt-3 text-sm font-medium text-foreground" data-plan-expect>
          {ACADEMY_EXPECT}
        </p>
        {verified ? (
          <p className="mt-2 text-sm text-foreground">You&apos;re verified. The core app comes with your dues.</p>
        ) : (
          <p className="mt-2 text-sm text-foreground">
            For verified SVG Academy members (Gymdesk member check). Athletes anywhere else start on SVG Pro.
          </p>
        )}
        <p className="mt-2 text-sm text-foreground">
          Pro free for your first {MEMBER_PRO_DAYS} days, no card. On day {MEMBER_PRO_DAYS + 1} you
          go back to the included tier. Never auto-billed. Upgrade to Pro anytime for{" "}
          {usd(PERFORMANCE_MONTHLY)}/mo.
        </p>
        <TierList items={ACADEMY_INCLUDES} tone="base" />
      </article>

      <article data-plan-card="performance" className="rounded-2xl border border-line bg-card p-5 text-foreground">
        <p className="font-display text-xs uppercase tracking-[0.06em] text-accent">App</p>
        <h2 className="mt-2 text-xl text-foreground">{PRO_LABEL}</h2>
        <p className="font-display stat-display mt-3 text-3xl text-accent">{usd(PERFORMANCE_MONTHLY)}/mo</p>
        <p className="mt-1 text-sm text-foreground">{performanceAnnualLine()}</p>
        <p className="mt-3 text-sm font-medium text-foreground" data-plan-expect>
          {PRO_EXPECT}
        </p>
        <p className="mt-2 text-sm text-foreground">
          Same price for athletes anywhere, academy members included. New here? Start with a{" "}
          {NONMEMBER_TRIAL_DAYS}-day Pro trial, no card. After the trial, Pro keeps the app
          open. Your past data stays viewable and exportable.
        </p>
        <TierList items={PRO_ADDS} tone="add" />
        <p className="mt-3 text-xs text-foreground" data-fair-use>
          {PRO_FAIR_USE_LINE}
        </p>
        <div className="mt-5">
          <PlanCheckoutButton canStartTrial={canStartTrial} checkoutLive={checkoutLive} />
        </div>
      </article>

      <article data-plan-card="coaching" className="rounded-2xl border border-line bg-card p-5 text-foreground">
        <p className="font-display text-xs uppercase tracking-[0.06em] text-accent">Coaching</p>
        <h2 className="mt-2 text-xl text-foreground">{coaching.label}</h2>
        <p className="font-display stat-display mt-3 text-3xl text-accent">{usd(COACHING_MONTHLY)}/mo</p>
        <p className="mt-1 text-sm text-foreground" data-coaching-spots>
          {coachingSpotsLine(coachingSpotsLeft)}
        </p>
        <p className="mt-3 text-sm font-medium text-foreground" data-plan-expect>
          {COACHING_EXPECT}
        </p>
        <TierList items={COACHING_ADDS} tone="add" />
        <div className="mt-5">
          {coachingAtCap ? (
            userLoggedIn ? (
              <WaitlistButton plan="coaching" />
            ) : (
              <p className="text-sm text-foreground">Log in to join the waitlist.</p>
            )
          ) : (
            <PlanCheckoutButton canStartTrial={false} checkoutLive={checkoutLive} />
          )}
        </div>
      </article>

      <p className="text-sm text-foreground">
        VIP is by application. In-person intensives and VIP: apply through{" "}
        <Link href="/book" className="text-accent underline">
          Book with Ricky
        </Link>
        .
      </p>
    </div>
  );
}
