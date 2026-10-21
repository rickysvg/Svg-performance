import { isDashboardAdmin } from "@/lib/admin-access";
import { getEffectivePlanId } from "@/lib/entitlements";
import { planIsPro } from "@/lib/plans";

/** Shown when academy or free accounts hit the coach chat API. */
export const COACH_CHAT_LOCKED =
  "AI coach chat is on Pro. Start the 7-day trial or upgrade.";

/**
 * SVG Coach chat: Pro, VIP Coaching (a Pro-rank plan), an active Pro trial, or an admin.
 * Academy members and free accounts are refused.
 * Kept out of entitlements.ts so client components can import plan helpers
 * without pulling next/headers through the admin session module.
 */
export async function canUseCoachChat(
  user: { id: string; role: string; email: string },
  now = new Date(),
) {
  if (isDashboardAdmin(user)) return true;
  return planIsPro(await getEffectivePlanId(user.id, now));
}
