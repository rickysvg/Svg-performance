import { normalizePlanId, type CatalogPlanId } from "@/lib/plans";

/**
 * Exact retired checkout ids. A stored row maps to Pro annual only while its
 * plan id is one of these, or its Stripe price id is still that seat's price.
 * The boolean is not a mapping by itself, and a later plan or price is read
 * as whatever it is now. Nothing here deletes a row or clears the boolean.
 */
const RETIRED_ANNUAL_PLAN_IDS = new Set([
  "performance_founding",
  "performance_founding_gym",
  "performance_founding_non",
  "conditioning_founding_gym",
  "conditioning_founding_non",
]);

const RETIRED_PRICE_ENVS = [
  "STRIPE_PRICE_PERFORMANCE_FOUNDING",
  "STRIPE_PRICE_CONDITIONING_FOUNDING_GYM",
  "STRIPE_PRICE_CONDITIONING_FOUNDING_NON",
] as const;

/** Current Pro prices. A match means the price has moved off the retired seat. */
const CURRENT_PRO_PRICE_ENVS = [
  "STRIPE_PRICE_PERFORMANCE_MONTHLY",
  "STRIPE_PRICE_PERFORMANCE_YEAR",
  "STRIPE_PRICE_GYM",
  "STRIPE_PRICE_STANDALONE",
  "STRIPE_PRICE_PERFORMANCE_ANNUAL_GYM",
  "STRIPE_PRICE_PERFORMANCE_ANNUAL_NON",
] as const;

export type StoredPlanRow = {
  plan?: string | null;
  /** Retained on the row. Not used to choose annual vs monthly. */
  founding?: boolean | null;
  stripePriceId?: string | null;
};

function planKey(plan: string | null | undefined) {
  return (plan ?? "").trim().toLowerCase();
}

function priceMatches(names: readonly string[], priceId: string) {
  return names.some((name) => {
    const configured = process.env[name]?.trim();
    return Boolean(configured) && configured === priceId;
  });
}

function priceIsRetiredAnnual(priceId: string | null | undefined) {
  const price = (priceId ?? "").trim();
  if (!price) return false;
  if (priceMatches(CURRENT_PRO_PRICE_ENVS, price)) return false;
  return priceMatches(RETIRED_PRICE_ENVS, price);
}

function planIsRetiredAnnual(plan: string | null | undefined) {
  return RETIRED_ANNUAL_PLAN_IDS.has(planKey(plan));
}

/**
 * True only while this row's plan id or Stripe price is still the retired seat.
 * A current Pro price wins over a leftover plan id.
 */
export function referencesRetiredAnnual(row: StoredPlanRow) {
  const price = (row.stripePriceId ?? "").trim();
  if (price && priceMatches(CURRENT_PRO_PRICE_ENVS, price)) return false;
  if (planIsRetiredAnnual(row.plan)) return true;
  return priceIsRetiredAnnual(row.stripePriceId);
}

/** Catalog access. Retired annual rows are Pro. */
export function catalogPlanFromStored(row: StoredPlanRow): CatalogPlanId {
  if (referencesRetiredAnnual(row)) return "performance";
  return normalizePlanId(row.plan ?? "");
}

/**
 * Plan id for annual-vs-monthly checks (`year` in the id).
 * The stored plan string is returned unchanged when the row is not that seat.
 */
export function billingPlanFromStored(row: StoredPlanRow) {
  if (referencesRetiredAnnual(row)) return "performance_year";
  return row.plan ?? "";
}
