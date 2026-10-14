import { normalizeEmail } from "@/lib/auth";
import { adminEmailsFromEnv } from "@/lib/form-check-access";

/**
 * Inbox access matches form-check review: role admin, or an email listed in
 * ADMIN_EMAILS. New-feedback mail goes only to ADMIN_EMAILS.
 */
export function isFeedbackAdmin(user: { role: string; email: string }) {
  if (user.role === "admin") return true;
  return adminEmailsFromEnv().includes(normalizeEmail(user.email));
}
