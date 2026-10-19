/** Public app prices. One price for everyone. Payments are not live. Gym dues are separate. */

export const PERFORMANCE_MONTHLY = 9.99;
export const PERFORMANCE_ANNUAL = 79;
export const PERFORMANCE_ANNUAL_SAVE = "save 34%";
export const FOUNDING_ANNUAL = 59;
export const FOUNDING_CAP = 250;
export const COACHING_MONTHLY = 249;
export const COACHING_CAP = 20;

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
  return `${price}. ${left} of ${FOUNDING_CAP} spots left`;
}

export function isFoundingDealOpen(enrolledCount = 0) {
  return enrolledCount < FOUNDING_CAP;
}

export function coachingSpotsLine(spotsLeft: number | null) {
  if (spotsLeft == null) return `Limited to ${COACHING_CAP} athletes`;
  const left = Math.max(0, Math.min(COACHING_CAP, spotsLeft));
  return `${left} of ${COACHING_CAP} spots left`;
}
