/**
 * Public app prices. One Pro price for everyone, academy members included.
 * Stripe price IDs come from env (STRIPE_PRICE_PERFORMANCE_MONTHLY / _YEAR / _FOUNDING,
 * STRIPE_PRICE_COACHING_MONTHLY). Nothing here creates Stripe products.
 */

export const PRO_LABEL = "SVG Pro";
export const PERFORMANCE_MONTHLY = 9.99;
export const PERFORMANCE_ANNUAL = 72.99;
export const PERFORMANCE_ANNUAL_SAVE = "save 39%";
export const FOUNDING_ANNUAL = 59;
export const FOUNDING_CAP = 100;
export const COACHING_MONTHLY = 249;
export const COACHING_CAP = 20;

/** Nonmembers: 7-day no-card Pro trial, then Pro is required to keep training in the app. */
export const NONMEMBER_TRIAL_DAYS = 7;
/** Verified academy members: Pro free for 30 days, no card, never auto-billed. */
export const MEMBER_PRO_DAYS = 30;
/** In-app and push reminders for the member Pro month. */
export const MEMBER_PRO_REMINDER_DAYS = [25, 29, 31] as const;

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

export function foundingPriceLine(spotsLeft: number | null = null) {
  const price = `Founding price ${usd(FOUNDING_ANNUAL)}/year for the first ${FOUNDING_CAP} members`;
  if (spotsLeft == null) return price;
  const left = Math.max(0, Math.min(FOUNDING_CAP, spotsLeft));
  if (left === 0) return `${price}. Sold out`;
  return `${price}. ${left} founding spots left`;
}

export function isFoundingDealOpen(enrolledCount = 0) {
  return enrolledCount < FOUNDING_CAP;
}

export function coachingSpotsLine(spotsLeft: number | null) {
  if (spotsLeft == null) return `Limited to ${COACHING_CAP} athletes`;
  const left = Math.max(0, Math.min(COACHING_CAP, spotsLeft));
  if (left === 0) return "Sold out";
  return `${left} coaching spots open`;
}

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

export const PRO_INCLUDES = [
  "Everything in the academy tier",
  "AI coach chat with voices",
  "Today's Summary read-aloud",
  "RIR auto-adjust after sparring or low readiness",
  "AI feedback on check-ins and meals",
  "Sparring trends",
  "Full history",
] as const;

export const PRO_FAIR_USE_LINE = `Fair use: ${PRO_AI_MESSAGES_PER_DAY} AI messages, ${PRO_VOICE_MINUTES_PER_DAY} minutes of voice, and ${PRO_READ_ALOUD_PER_DAY} read-aloud a day.`;

export const COACHING_INCLUDES = [
  "Custom programming with Ricky",
  "Weekly AI-assisted check-ins reviewed by Ricky",
  "Video form reviews",
  "Includes Pro",
] as const;
