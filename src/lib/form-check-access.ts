import { normalizeEmail } from "@/lib/auth";
import { getEffectivePlanId } from "@/lib/entitlements";
import { planHasFeature, type CatalogPlanId } from "@/lib/plans";

/** Comma, semicolon, or newline separated reviewer emails. */
export function adminEmailsFromEnv(raw = process.env.ADMIN_EMAILS): string[] {
  if (!raw) return [];
  const emails = raw
    .split(/[,;\n]+/)
    .map((part) => normalizeEmail(part))
    .filter((email) => email.includes("@"));
  return [...new Set(emails)];
}

export function isFormCheckReviewer(user: { role: string; email: string }) {
  if (user.role === "admin") return true;
  return adminEmailsFromEnv().includes(normalizeEmail(user.email));
}

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
