import Link from "next/link";
import { WaitlistButton } from "@/components/billing/WaitlistButton";
import {
  ACADEMY_EXPECT,
  ACADEMY_INCLUDES,
  COACHING_ADDS,
  COACHING_EXPECT,
  COACHING_MONTHLY,
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
import type { VipPricingPhase } from "@/lib/vip-store";
import { PricingLadder } from "@/components/pricing/PricingLadder";

function PlanCheckoutButton({
  canStartTrial,
  checkoutLive,
  verified,
}: {
  canStartTrial: boolean;
  checkoutLive: boolean;
  verified: boolean;
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
      <form data-testid="pricing-form-2" action={startTrialAction}>
        <input type="hidden" name="next" value="/home" />
        <button
          data-testid="pricing-plan-action"
          type="submit"
          data-plan-action="trial"
          className="touch-target w-full rounded-full bg-accent text-black"
        >
          {verified ? `Start ${MEMBER_PRO_DAYS} days of free Pro` : "Start 7-day free trial"}
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

function VipPlanButton({
  phase,
  userLoggedIn,
}: {
  phase: VipPricingPhase;
  userLoggedIn: boolean;
}) {
  if (phase === "member") {
    return <p className="text-sm text-white">You&apos;re on VIP Coaching.</p>;
  }
  if (phase === "pending") {
    return (
      <p className="text-sm text-white">
        Application in. Ricky replies within 48 hours. Checkout stays locked until he approves you.
      </p>
    );
  }
  if (phase === "checkout") {
    return (
      <Link
        href="/vip/checkout"
        className="touch-target flex w-full items-center justify-center rounded-full bg-[#CBF805] font-semibold text-black"
      >
        Checkout
      </Link>
    );
  }
  if (phase === "waitlist") {
    if (!userLoggedIn) {
      return <p className="text-sm text-white">Log in to join the waitlist.</p>;
    }
    return <WaitlistButton plan="coaching" />;
  }
  if (!userLoggedIn) {
    return (
      <Link
        href="/login"
        data-vip-apply
        className="touch-target flex w-full items-center justify-center rounded-full bg-[#CBF805] font-semibold text-black"
      >
        Log in to apply
      </Link>
    );
  }
  return (
    <Link
      href="/vip/apply"
      data-vip-apply
      className="touch-target flex w-full items-center justify-center rounded-full bg-[#CBF805] font-semibold text-black"
    >
      Apply
    </Link>
  );
}

export function PricingCatalog({
  verified,
  vipPhase = "apply",
  userLoggedIn,
  canStartTrial = false,
  checkoutLive = false,
}: {
  verified: boolean;
  vipPhase?: VipPricingPhase;
  userLoggedIn: boolean;
  canStartTrial?: boolean;
  checkoutLive?: boolean;
}) {
  const coaching = PLAN_CATALOG.coaching;

  return (
    <div className="space-y-4" data-pricing-plans="3">
      <PricingLadder vipPhase={vipPhase} userLoggedIn={userLoggedIn} />
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
          Same price for athletes anywhere, academy members included.{" "}
          {verified
            ? `Your dues include the core app, and Pro is free for your first ${MEMBER_PRO_DAYS} days, no card, never auto-billed.`
            : `New here? Start with a ${NONMEMBER_TRIAL_DAYS}-day Pro trial, no card. After the trial, Pro keeps the app open. Your past data stays viewable and exportable.`}
        </p>
        <TierList items={PRO_ADDS} tone="add" />
        <p className="mt-3 text-xs text-foreground" data-fair-use>
          {PRO_FAIR_USE_LINE}
        </p>
        <div className="mt-5">
          <PlanCheckoutButton
            canStartTrial={canStartTrial}
            checkoutLive={checkoutLive}
            verified={verified}
          />
        </div>
      </article>

      <article
        data-plan-card="coaching"
        data-vip-card="1"
        className="rounded-2xl border border-[#CBF805] bg-black p-5 text-white"
      >
        <p className="font-display text-xs uppercase tracking-[0.06em] text-[#CBF805]">1-on-1</p>
        <h2 className="mt-2 text-xl text-white">{coaching.label}</h2>
        <p className="font-display stat-display mt-3 text-3xl text-[#CBF805]">
          {verified ? "$149 first month" : `${usd(COACHING_MONTHLY)}/mo`}
        </p>
        <p className="mt-1 text-sm text-white/80">
          {verified
            ? `Then ${usd(COACHING_MONTHLY)}/mo. Verified academy price for the first month.`
            : `Verified SVG Academy members: $149 the first month, then ${usd(COACHING_MONTHLY)}/mo.`}
        </p>
        <p className="mt-1 text-sm text-white/80">
          Pro subscribers who upgrade can get a one-time credit of up to $30 for unused Pro time. The
          academy first month stands on its own.
        </p>
        <p className="mt-1 text-sm text-white" data-coaching-spots>
          Limited spots
        </p>
        <p className="mt-3 text-sm font-medium text-white" data-plan-expect>
          {COACHING_EXPECT}
        </p>
        <TierList items={COACHING_ADDS} tone="add" />
        <p className="mt-3 text-sm text-white/80" data-vip-promise>
          Replies to messages, form checks, and check-ins within 48 hours.
        </p>
        <div className="mt-5">
          <VipPlanButton phase={vipPhase} userLoggedIn={userLoggedIn} />
        </div>
      </article>

      <p className="text-sm text-foreground">
        In-person VIP is by application. In-person intensives and VIP: apply through{" "}
        <Link href="/book" className="text-accent underline">
          Book with Ricky
        </Link>
        .
      </p>
    </div>
  );
}
