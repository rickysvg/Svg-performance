import { APP_TIMEZONE, zonedCivilToUtc } from "@/lib/timezone";

/** Tester Pro ends when paid checkout opens: Nov 16, 2026, America/Denver. */
export const TESTER_LAUNCH_AT = zonedCivilToUtc(2026, 11, 16, APP_TIMEZONE);
export const TESTER_PLAN_LINE = "Tester · full Pro until Nov 16";
export const TESTER_MAX_USES = 100;

export function testerAccessOpen(now = new Date()) {
  return now.getTime() < TESTER_LAUNCH_AT.getTime();
}

export function isTesterFlagActive(tester: boolean, now = new Date()) {
  return tester && testerAccessOpen(now);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Same split as ADMIN_EMAILS elsewhere, without importing the auth module. */
export function testerAdminEmails(raw = process.env.ADMIN_EMAILS): string[] {
  if (!raw) return [];
  const emails = raw
    .split(/[,;\n]+/)
    .map((part) => normalizeEmail(part))
    .filter((email) => email.includes("@"));
  return [...new Set(emails)];
}

/** Creating codes is limited to ADMIN_EMAILS. A role of admin is not enough. */
export function isTesterCodeAdmin(user: { email: string }) {
  return testerAdminEmails().includes(normalizeEmail(user.email));
}

export function normalizeTesterCode(raw: string) {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = compact.startsWith("SVG") ? compact.slice(3) : compact;
  if (body.length < 4 || body.length > 12) return "";
  return `SVG-${body}`;
}
