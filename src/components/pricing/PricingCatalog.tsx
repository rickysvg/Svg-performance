import Link from "next/link";
import { WaitlistButton } from "@/components/billing/WaitlistButton";
import {
  COACHING_MONTHLY,
  coachingSpotsLine,
  foundingPriceLine,
  PERFORMANCE_MONTHLY,
  performanceAnnualLine,
  usd,
} from "@/lib/pricing";
import { PLAN_CATALOG } from "@/lib/plans";

function ComingSoonButton() {
  return (
    <button
      type="button"
      disabled
      className="touch-target w-full rounded-full bg-accent text-black disabled:cursor-not-allowed disabled:opacity-60"
    >
      Coming soon
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
}: {
  verified: boolean;
  foundingOpen: boolean;
  foundingSpotsLeft: number | null;
  coachingSpotsLeft: number | null;
  coachingAtCap: boolean;
  userLoggedIn: boolean;
}) {
  const free = PLAN_CATALOG.member_access;
  const performance = PLAN_CATALOG.performance;
  const coaching = PLAN_CATALOG.coaching;

  return (
    <div className="space-y-4" data-pricing-plans="3">
      <article data-plan-card="member_access" className="rounded-2xl border border-line bg-card p-5">
        <p className="font-display text-xs uppercase tracking-[0.06em] text-black">App</p>
        <h2 className="mt-2 text-xl text-black">Free</h2>
        <p className="font-display stat-display mt-3 text-3xl text-black">
          {verified ? "Full app free" : "Free"}
        </p>
        {verified ? (
          <p className="mt-2 text-sm text-black">
            You&apos;re verified. SVG Academy members get the full app free.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">
            SVG Academy members, verified with the Gymdesk member check, get the full app free.
          </p>
        )}
        <p className="mt-2 text-sm text-muted">
          Everyone else: a 7-day trial, then a basic free version — workout log, timers, and 1
          sample plan.
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted">
          {free.includes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted">No checkout. Gym dues are separate and stay on Gymdesk.</p>
      </article>

      <article data-plan-card="performance" className="rounded-2xl border border-black bg-card p-5">
        <p className="font-display text-xs uppercase tracking-[0.06em] text-black">App</p>
        <h2 className="mt-2 text-xl text-black">{performance.label}</h2>
        <p className="font-display stat-display mt-3 text-3xl text-black">{usd(PERFORMANCE_MONTHLY)}/mo</p>
        <p className="mt-1 text-sm text-black">{performanceAnnualLine()}</p>
        {foundingOpen ? (
          <p className="mt-2 text-sm font-medium text-black" data-founding-price>
            {foundingPriceLine(foundingSpotsLeft)}
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">Founding price is full.</p>
        )}
        <p className="mt-2 text-sm text-muted">{performance.summary}</p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted">
          {performance.includes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="mt-5">
          <ComingSoonButton />
        </div>
      </article>

      <article data-plan-card="coaching" className="rounded-2xl border border-line bg-card p-5">
        <p className="font-display text-xs uppercase tracking-[0.06em] text-black">Coaching</p>
        <h2 className="mt-2 text-xl text-black">{coaching.label}</h2>
        <p className="font-display stat-display mt-3 text-3xl text-black">{usd(COACHING_MONTHLY)}/mo</p>
        <p className="mt-1 text-sm text-black" data-coaching-spots>
          {coachingSpotsLine(coachingSpotsLeft)}
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted">
          {coaching.includes.map((item) => (
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
            <ComingSoonButton />
          )}
        </div>
      </article>

      <p className="text-sm text-muted">
        In-person intensives and VIP: apply through{" "}
        <Link href="/book" className="text-accent underline">
          Book with Ricky
        </Link>
        .
      </p>
    </div>
  );
}
