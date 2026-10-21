/**
 * Public app prices. One Pro price for everyone, academy members included.
 * Stripe price IDs come from env (STRIPE_PRICE_PERFORMANCE_MONTHLY / _YEAR,
 * STRIPE_PRICE_COACHING_MONTHLY). Nothing here creates Stripe products.
 */

export const PRO_LABEL = "SVG Pro";
export const PERFORMANCE_MONTHLY = 9.99;
export const PERFORMANCE_ANNUAL = 72.99;
export const PERFORMANCE_ANNUAL_SAVE = "save 39%";
export const COACHING_MONTHLY = 249;
export const COACHING_CAP = 20;

/** Nonmembers: 7-day no-card Pro trial, then Pro is required to keep training in the app. */
export const NONMEMBER_TRIAL_DAYS = 7;
/** New verified academy claims: Pro free for 14 days, no card, never auto-billed. */
export const MEMBER_PRO_DAYS = 14;
/**
 * Grants that already started before the 14-day change.
 * A null Profile.memberProDays means this length. Do not shorten those periods.
 */
export const LEGACY_MEMBER_PRO_DAYS = 30;
/** Reminder days for a new 14-day grant: 5 days left, last days, and the day after it ends. */
export const MEMBER_PRO_REMINDER_DAYS = [9, 13, 15] as const;

/** Academy tier (included in dues) limits. */
export const ACADEMY_AI_MESSAGES_PER_WEEK = 3;
export const ACADEMY_HISTORY_DAYS = 30;

/** Pro fair-use caps. */
export const PRO_AI_MESSAGES_PER_DAY = 30;
export const PRO_VOICE_MINUTES_PER_DAY = 20;
export const PRO_READ_ALOUD_PER_DAY = 1;

export function usd(amount: number) {
  const cents = Math.round(amount * 100) % 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents === 0 ? 0 : 2,
    maximumFractionDigits: cents === 0 ? 0 : 2,
  }).format(amount);
}

export function performancePriceLine() {
  return `${usd(PERFORMANCE_MONTHLY)}/mo or ${usd(PERFORMANCE_ANNUAL)}/yr, ${PERFORMANCE_ANNUAL_SAVE}`;
}

export function performanceAnnualLine() {
  return `or ${usd(PERFORMANCE_ANNUAL)}/yr, ${PERFORMANCE_ANNUAL_SAVE}`;
}

/**
 * Public copy. The cap stays internal; the page never prints a remaining count.
 * The argument is ignored so older callers cannot leak a number.
 */
export function coachingSpotsLine(_spotsLeft?: number | null) {
  return "Limited spots";
}

export const ACADEMY_EXPECT =
  "The training app that comes with your SVG Academy dues.";

export const ACADEMY_INCLUDES = [
  "Full rounds library",
  "Mobility and form libraries",
  "Standard SVG blocks",
  "Calendar",
  "Sparring log",
  "Weekly check-in form",
  "Fuel logging",
  `${ACADEMY_HISTORY_DAYS} days of history`,
  `${ACADEMY_AI_MESSAGES_PER_WEEK} AI coach messages a week`,
] as const;

export const PRO_EXPECT = "Everything in the academy tier, plus…";

export const PRO_ADDS = [
  "AI coach chat",
  "RIR auto-adjust after sparring or low readiness",
  "AI feedback on check-ins and meals",
  "Sparring trends",
  "Full history",
] as const;

export const PRO_INCLUDES = PRO_ADDS;

export const PRO_FAIR_USE_LINE = `Fair use: ${PRO_AI_MESSAGES_PER_DAY} AI messages a day.`;

export const COACHING_EXPECT = "Everything in Pro, plus…";

export const COACHING_ADDS = [
  "A program Ricky writes",
  "Fight-camp plan",
  "Timestamped form notes",
  "Weekly plan adjustments",
  "Direct messages with Ricky",
  "Monthly assessment",
  "Replies within 48 hours",
] as const;

export const COACHING_INCLUDES = COACHING_ADDS;
