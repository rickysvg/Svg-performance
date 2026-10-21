import Link from "next/link";
import {
  NONMEMBER_TRIAL_DAYS,
  PERFORMANCE_ANNUAL,
  PERFORMANCE_ANNUAL_SAVE,
  PERFORMANCE_MONTHLY,
  usd,
} from "@/lib/pricing";

/** Shown to a nonmember after the 7-day Pro trial ends without a subscription. */
export function TrialEndedPaywall() {
  return (
    <section
      id="trial-ended"
      data-paywall="trial_ended"
      className="mx-auto max-w-md rounded-2xl border border-black bg-white p-5"
    >
      <p className="font-display text-xs uppercase tracking-[0.06em] text-black">SVG Pro</p>
      <h1 className="font-display mt-2 text-3xl uppercase tracking-wide text-black">
        Your {NONMEMBER_TRIAL_DAYS}-day trial ended
      </h1>
      <p className="mt-3 text-sm text-muted">
        Subscribe to Pro to keep training. Logging, timers, and class programming stay open
        for academy members and Pro subscribers. After the {NONMEMBER_TRIAL_DAYS}-day trial,
        past data stays viewable and exportable.
      </p>
      <p className="font-display stat-display mt-4 text-3xl text-black">
        {usd(PERFORMANCE_MONTHLY)}/mo
      </p>
      <p className="text-sm text-black">
        or {usd(PERFORMANCE_ANNUAL)}/yr, {PERFORMANCE_ANNUAL_SAVE}
      </p>
      <div className="mt-5 space-y-3">
        <Link
          href="/pricing"
          className="touch-target inline-flex w-full items-center justify-center rounded-full bg-accent text-black"
        >
          Subscribe to Pro
        </Link>
        <Link
          href="/progress"
          className="touch-target inline-flex w-full items-center justify-center rounded-full border border-black bg-white font-semibold text-black"
        >
          View my past data
        </Link>
        <a
          href="/api/account/export"
          className="touch-target inline-flex w-full items-center justify-center rounded-full border border-line bg-white text-sm text-black"
        >
          Export my data
        </a>
      </div>
      <p className="mt-4 text-xs text-muted">
        Train at SVG Academy? Verified members get the core app with their dues. Checkout is
        coming soon.
      </p>
    </section>
  );
}
