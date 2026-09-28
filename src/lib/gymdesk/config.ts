export const GYMDESK_EVENTS = [
  "signup",
  "membership-start",
  "frozen",
  "canceled",
  "expired",
] as const;

export type GymdeskEvent = (typeof GYMDESK_EVENTS)[number];

export const GYMDESK_STATUSES = [
  "active",
  "frozen",
  "canceled",
  "visitor",
  "pending",
] as const;

export type GymdeskStatus = (typeof GYMDESK_STATUSES)[number];

export function isGymdeskEvent(value: string): value is GymdeskEvent {
  return (GYMDESK_EVENTS as readonly string[]).includes(value);
}

export function gymdeskWebhookSecret() {
  return process.env.GYMDESK_WEBHOOK_SECRET?.trim() ?? "";
}

export function gymdeskMatchPepper() {
  return process.env.GYMDESK_MATCH_PEPPER?.trim() ?? "";
}

export function cronSecret() {
  return process.env.CRON_SECRET?.trim() ?? "";
}

export function gymdeskEnabledFlag() {
  const raw = process.env.GYMDESK_SYNC_ENABLED?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") return false;
  if (raw === "1" || raw === "true" || raw === "on") return true;
  return null;
}

/** On if secrets exist, unless GYMDESK_SYNC_ENABLED is explicitly off. */
export function isGymdeskSyncEnabled() {
  const flag = gymdeskEnabledFlag();
  if (flag === false) return false;
  return Boolean(gymdeskWebhookSecret() && gymdeskMatchPepper());
}

export function isGymdeskFullyConfigured() {
  return isGymdeskSyncEnabled();
}

export function gymdeskMissingSecrets() {
  const missing: string[] = [];
  if (!gymdeskWebhookSecret()) missing.push("GYMDESK_WEBHOOK_SECRET");
  if (!gymdeskMatchPepper()) missing.push("GYMDESK_MATCH_PEPPER");
  if (!cronSecret()) missing.push("CRON_SECRET");
  return missing;
}

export function gymdeskGraceDays() {
  const parsed = Number(process.env.GYMDESK_GRACE_DAYS);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 7;
}

export function gymdeskFrozenGraceDays() {
  const parsed = Number(process.env.GYMDESK_FROZEN_GRACE_DAYS);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 30;
}

export function gymdeskStaleDays() {
  const parsed = Number(process.env.GYMDESK_STALE_DAYS);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 35;
}

export const EMAIL_CODE_TTL_MS = 15 * 60 * 1000;
export const LOGIN_RECHECK_MS = 24 * 60 * 60 * 1000;

const GYMDESK_ORIGIN_FALLBACK = "https://svg-performance.vercel.app";

function parseOrigin(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    return new URL(withProtocol).origin;
  } catch {
    return "";
  }
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
  } catch {
    return true;
  }
}

function isAcceptableOrigin(origin: string): boolean {
  if (!origin) return false;
  if (process.env.NODE_ENV === "production") {
    if (isLocalhostOrigin(origin)) return false;
    if (!origin.startsWith("https://")) return false;
  }
  return true;
}

/**
 * Origin pasted into Gymdesk webhook URLs.
 * APP_URL → https://${VERCEL_PROJECT_PRODUCTION_URL} → https://svg-performance.vercel.app.
 * Localhost / http are never used in production.
 */
export function gymdeskPublicOrigin() {
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ?? "";
  const candidates = [
    parseOrigin(process.env.APP_URL ?? ""),
    parseOrigin(vercelHost),
    GYMDESK_ORIGIN_FALLBACK,
  ];
  for (const origin of candidates) {
    if (isAcceptableOrigin(origin)) return origin;
  }
  return GYMDESK_ORIGIN_FALLBACK;
}

export function gymdeskWebhookUrl(event: GymdeskEvent, origin: string) {
  const base = origin.replace(/\/$/, "");
  const secret = gymdeskWebhookSecret() || "YOUR_GYMDESK_WEBHOOK_SECRET";
  return `${base}/api/gymdesk/webhook/${event}?t=${encodeURIComponent(secret)}`;
}

export function gymdeskWebhookUrls(origin: string) {
  return GYMDESK_EVENTS.map((event) => ({
    event,
    label:
      event === "signup"
        ? "Member Signup"
        : event === "membership-start"
          ? "Membership Start"
          : event === "frozen"
            ? "Member Frozen"
            : event === "canceled"
              ? "Member Cancelled"
              : "Membership Expired",
    url: gymdeskWebhookUrl(event, origin),
  }));
}
