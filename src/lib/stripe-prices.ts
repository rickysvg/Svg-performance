/**
 * Live subscription price env names. Values stay in the host environment.
 * Older names still resolve so an existing TEST setup keeps working.
 */

export const STRIPE_PRICE_PRO_MONTHLY = "STRIPE_PRICE_PRO_MONTHLY";
export const STRIPE_PRICE_PRO_YEARLY = "STRIPE_PRICE_PRO_YEARLY";
export const STRIPE_PRICE_VIP_MONTHLY = "STRIPE_PRICE_VIP_MONTHLY";

const PRICE_ENV_FALLBACKS: Record<string, readonly string[]> = {
  STRIPE_PRICE_PRO_MONTHLY: ["STRIPE_PRICE_PERFORMANCE_MONTHLY"],
  STRIPE_PRICE_PRO_YEARLY: ["STRIPE_PRICE_PERFORMANCE_YEAR"],
  STRIPE_PRICE_VIP_MONTHLY: ["STRIPE_PRICE_COACHING_MONTHLY"],
  STRIPE_PRICE_PERFORMANCE_MONTHLY: ["STRIPE_PRICE_PRO_MONTHLY"],
  STRIPE_PRICE_PERFORMANCE_YEAR: ["STRIPE_PRICE_PRO_YEARLY"],
  STRIPE_PRICE_COACHING_MONTHLY: ["STRIPE_PRICE_VIP_MONTHLY"],
};

export function readPriceEnv(name: string): string | undefined {
  const seen = new Set<string>();
  const queue = [name, ...(PRICE_ENV_FALLBACKS[name] ?? [])];
  for (const key of queue) {
    if (seen.has(key)) continue;
    seen.add(key);
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

/** Eight random letters for a Checkout integration_identifier suffix. */
export function randomLetterSuffix(length = 8) {
  let suffix = "";
  for (let i = 0; i < length; i += 1) {
    suffix += LETTERS[Math.floor(Math.random() * LETTERS.length)];
  }
  return suffix;
}

/** True when a secret key and at least one billable price id are present. */
export function stripeBillingEnvPresent() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      (process.env.STRIPE_PRICE_STANDALONE ||
        readPriceEnv(STRIPE_PRICE_PRO_MONTHLY) ||
        readPriceEnv(STRIPE_PRICE_PRO_YEARLY) ||
        readPriceEnv(STRIPE_PRICE_VIP_MONTHLY)),
  );
}
