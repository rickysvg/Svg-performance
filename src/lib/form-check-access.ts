import { getEffectivePlanId } from "@/lib/entitlements";
import { planHasFeature, type CatalogPlanId } from "@/lib/plans";

export { adminEmailsFromEnv, isDashboardAdminAccount as isFormCheckReviewer } from "@/lib/admin-emails";

/** Admins and coaches keep Form Check even when their plan is not VIP Coaching. */
export function formCheckStaffBypass(role: string) {
  return role === "admin" || role === "coach";
}

/**
 * Member upload is the VIP Coaching plan only. Trial, Pro, Academy, and free stay locked.
 * `planHasFeature` is the tier helper: `form_check` sits on the coaching plan alone.
 */
export function formCheckLockedFor(input: { role: string; planId: CatalogPlanId }) {
  if (formCheckStaffBypass(input.role)) return false;
  return !planHasFeature(input.planId, "form_check");
}

export async function canUseFormCheck(
  user: { id: string; role: string },
  now = new Date(),
) {
  if (formCheckStaffBypass(user.role)) return true;
  const planId = await getEffectivePlanId(user.id, now);
  return !formCheckLockedFor({ role: user.role, planId });
}
