import { normalizeEmail } from "@/lib/auth";

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
