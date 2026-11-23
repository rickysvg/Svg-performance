import { prisma } from "@/lib/prisma";

/** Same folding as account emails: trim and lowercase, nothing else. */
function normalizeAdminEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Comma, semicolon, or newline separated reviewer emails. */
export function adminEmailsFromEnv(raw = process.env.ADMIN_EMAILS): string[] {
  if (!raw) return [];
  const emails = raw
    .split(/[,;\n]+/)
    .map((part) => normalizeAdminEmail(part))
    .filter((email) => email.includes("@"));
  return [...new Set(emails)];
}

/**
 * Desk admin: role `admin`, or an address listed in ADMIN_EMAILS.
 * A plus-alias of that address is not an admin. QA accounts stay on the normal plan.
 */
export function isDashboardAdminAccount(user: { role: string; email: string }) {
  if (user.role === "admin") return true;
  return adminEmailsFromEnv().includes(normalizeAdminEmail(user.email));
}

/** Primary-key read of role and email. Enough to decide the VIP bypass. */
export async function userIsDashboardAdmin(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, email: true },
  });
  return Boolean(user && isDashboardAdminAccount(user));
}

/**
 * Mailbox base for reminder suppression. Case-insensitive, and the +tag before @ is removed
 * so owner+qa@ matches owner@. This does not grant plan access.
 */
export function reminderEmailKey(email: string) {
  const normalized = normalizeAdminEmail(email);
  const at = normalized.lastIndexOf("@");
  if (at <= 0) return normalized;
  const local = normalized.slice(0, at);
  const plus = local.indexOf("+");
  const base = plus === -1 ? local : local.slice(0, plus);
  return `${base}@${normalized.slice(at + 1)}`;
}

/** ADMIN_EMAILS plus every role-admin mailbox, folded to reminder keys. */
export async function adminReminderKeys() {
  const keys = new Set<string>();
  for (const email of adminEmailsFromEnv()) keys.add(reminderEmailKey(email));
  const admins = await prisma.user.findMany({
    where: { role: "admin" },
    select: { email: true },
  });
  for (const admin of admins) keys.add(reminderEmailKey(admin.email));
  return keys;
}

/** Role admins, listed admin emails, and plus-aliases of those mailboxes. */
export function isAdminReminderRecipient(
  user: { role: string; email: string },
  adminEmailKeys: ReadonlySet<string>,
) {
  if (user.role === "admin") return true;
  return adminEmailKeys.has(reminderEmailKey(user.email));
}
