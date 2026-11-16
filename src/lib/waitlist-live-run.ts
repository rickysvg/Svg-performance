import { prisma } from "@/lib/prisma";
import { WAITLIST_EMAIL_ERROR } from "@/lib/waitlist-shared";
import { buildWaitlistLiveEmail, sendWaitlistLiveEmail } from "@/lib/waitlist-live";

/**
 * One-shot "We're live" send for waitlist_signups.
 * Signup, cron, and deploy do not call this. An admin confirms it.
 */

export const WAITLIST_LIVE_BATCH_SIZE = 10;
export const WAITLIST_LIVE_GAP_MS = 250;

type Timing = { batchSize: number; gapMs: number };
type Sleeper = (ms: number) => Promise<void>;

let timing: Timing = { batchSize: WAITLIST_LIVE_BATCH_SIZE, gapMs: WAITLIST_LIVE_GAP_MS };
let sleeper: Sleeper = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function setWaitlistLiveTimingForTests(
  next: { batchSize?: number; gapMs?: number; sleep?: Sleeper } | null,
) {
  if (!next) {
    timing = { batchSize: WAITLIST_LIVE_BATCH_SIZE, gapMs: WAITLIST_LIVE_GAP_MS };
    sleeper = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    return;
  }
  const batchSize = next.batchSize ?? timing.batchSize;
  const gapMs = next.gapMs ?? timing.gapMs;
  timing = {
    batchSize: Number.isFinite(batchSize) ? Math.max(1, Math.floor(batchSize)) : WAITLIST_LIVE_BATCH_SIZE,
    gapMs: Number.isFinite(gapMs) ? Math.max(0, Math.floor(gapMs)) : WAITLIST_LIVE_GAP_MS,
  };
  if (next.sleep) sleeper = next.sleep;
}

export type WaitlistLiveOutcome =
  | {
      ok: true;
      mode: "dry_run";
      recipientCount: number;
      alreadySentCount: number;
      batchSize: number;
      gapMs: number;
      preview: { subject: string; preheader: string; text: string; html: string };
    }
  | {
      ok: true;
      mode: "send";
      sent: number;
      failed: number;
      skipped: number;
      remaining: number;
      reason?: "not_configured";
    }
  | {
      ok: true;
      mode: "test";
      to: string;
      sent: boolean;
      reason: "not_configured" | "sent" | "send_failed";
    }
  | { ok: false; error: string };

function cleanTestAddress(raw: string | null | undefined) {
  if (!raw) return null;
  const email = raw.trim().toLowerCase();
  if (email.length < 3 || email.length > 254) return null;
  if (email.includes("..") || email.includes(",")) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function modeOf(confirm: string | null | undefined) {
  const value = confirm?.trim() ?? "";
  if (value === "send") return "send" as const;
  if (value === "test") return "test" as const;
  return "dry_run" as const;
}

async function sendBatch(): Promise<Extract<WaitlistLiveOutcome, { mode: "send" }>> {
  const { batchSize, gapMs } = timing;
  const rows = await prisma.waitlistSignup.findMany({
    where: { liveEmailSentAt: null },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: batchSize,
    select: { id: true, email: true, firstName: true },
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let reason: "not_configured" | undefined;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const current = await prisma.waitlistSignup.findUnique({
      where: { id: row.id },
      select: { liveEmailSentAt: true },
    });
    if (!current || current.liveEmailSentAt) {
      skipped += 1;
      continue;
    }

    const result = await sendWaitlistLiveEmail({ to: row.email, firstName: row.firstName });
    if (result.sent) {
      await prisma.waitlistSignup.updateMany({
        where: { id: row.id, liveEmailSentAt: null },
        data: { liveEmailSentAt: new Date() },
      });
      sent += 1;
    } else {
      failed += 1;
      if (result.reason === "not_configured") {
        reason = "not_configured";
        break;
      }
    }

    const anotherAttempt = index < rows.length - 1 && result.reason !== "not_configured";
    if (anotherAttempt && gapMs > 0) {
      await sleeper(gapMs);
    }
  }

  const remaining = await prisma.waitlistSignup.count({ where: { liveEmailSentAt: null } });
  return {
    ok: true,
    mode: "send",
    sent,
    failed,
    skipped,
    remaining,
    ...(reason ? { reason } : {}),
  };
}

/**
 * Default is a dry run: counts plus a preview, no mail.
 * `confirm: "send"` mails one batch of rows that have no live_email_sent_at, then stamps each success.
 * `confirm: "test"` mails one address and does not stamp the list.
 */
export async function runWaitlistLiveEmail(input?: {
  confirm?: string | null;
  to?: string | null;
  firstName?: string | null;
}): Promise<WaitlistLiveOutcome> {
  const confirm = input?.confirm;
  const mode = modeOf(confirm);
  const firstName = (input?.firstName ?? "").slice(0, 80);

  if (mode === "test") {
    const to = cleanTestAddress(input?.to);
    if (!to) return { ok: false, error: WAITLIST_EMAIL_ERROR };
    const result = await sendWaitlistLiveEmail({ to, firstName });
    return { ok: true, mode: "test", to, sent: result.sent, reason: result.reason };
  }

  if (mode === "dry_run") {
    const [recipientCount, alreadySentCount] = await Promise.all([
      prisma.waitlistSignup.count({ where: { liveEmailSentAt: null } }),
      prisma.waitlistSignup.count({ where: { liveEmailSentAt: { not: null } } }),
    ]);
    const preview = buildWaitlistLiveEmail(firstName);
    return {
      ok: true,
      mode: "dry_run",
      recipientCount,
      alreadySentCount,
      batchSize: timing.batchSize,
      gapMs: timing.gapMs,
      preview: {
        subject: preview.subject,
        preheader: preview.preheader,
        text: preview.text,
        html: preview.html,
      },
    };
  }

  return sendBatch();
}
