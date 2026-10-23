import { normalizePlanId, type CatalogPlanId } from "@/lib/plans";

/**
 * Retired checkout ids. Stored rows that still use one of these, or the
 * subscription boolean from that seat, are read as Pro annual.
 * Nothing here deletes a row or clears the boolean.
 * A later coaching or higher-tier plan is left as stored.
 */
const RETIRED_ANNUAL_PLAN_IDS = new Set([
  "performance_founding",
  "performance_founding_gym",
  "conditioning_founding_gym",
  "conditioning_founding_non",
]);

export type StoredPlanRow = {
  plan?: string | null;
  founding?: boolean | null;
};

function planKey(plan: string | null | undefined) {
  return (plan ?? "").trim().toLowerCase();
}

function planTextIsRetiredAnnual(plan: string | null | undefined) {
  const key = planKey(plan);
  if (!key) return false;
  return RETIRED_ANNUAL_PLAN_IDS.has(key) || key.includes("founding");
}

/**
 * True when this row is the retired annual seat.
 * A coaching, development, elite, VIP, or platinum plan wins over the boolean
 * so a later upgrade is not pulled back to Pro.
 */
export function referencesRetiredAnnual(row: StoredPlanRow) {
  if (planTextIsRetiredAnnual(row.plan)) return true;
  if (!row.founding) return false;
  const key = planKey(row.plan);
  if (!key || key === "performance" || key === "gym" || key === "standalone") return true;
  if (key.startsWith("performance_")) return true;
  return false;
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
