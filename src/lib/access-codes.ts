import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError } from "@/lib/errors";
import { grantCatalogPlan } from "@/lib/billing";
import { ensureCreditsForPlan } from "@/lib/credits";
import { normalizePlanId, planIsPro } from "@/lib/plans";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_BODY = 8;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 8;
const RATE_MESSAGE = "Too many code attempts. Wait a few minutes and try again.";

export const ACCESS_CODE_DAY_CHOICES = [30, 90, 180] as const;
export type AccessCodeDuration = (typeof ACCESS_CODE_DAY_CHOICES)[number] | null;

type Actor = { id: string; role: string; email: string };

export type AccessCodeStatus = "unused" | "redeemed" | "expired" | "revoked";

export type AccessCodeView = {
  id: string;
  code: string;
  label: string;
  emailLock: string;
  durationDays: number | null;
  createdAt: Date;
  status: AccessCodeStatus;
  redeemedAt: Date | null;
  redeemedByEmail: string | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
};

/** Same gate as the coach desk: role admin, or an email in ADMIN_EMAILS. */
function assertActor(actor: Actor) {
  if (actor.role === "admin") return;
  const raw = process.env.ADMIN_EMAILS ?? "";
  const allowed = raw
    .split(/[,;\n]+/)
    .map((part) => part.trim().toLowerCase())
    .filter((email) => email.includes("@"));
  if (allowed.includes(actor.email.trim().toLowerCase())) return;
  throw new ForbiddenError("Only an admin can do that.");
}

function normalizeLock(raw: string) {
  const email = raw.trim().toLowerCase();
  if (!email) return "";
  if (!email.includes("@") || email.length > 200 || email.startsWith("@") || email.endsWith("@")) {
    throw new AppError("ACCESS_CODE", "Enter a valid email lock, or leave it blank.");
  }
  return email;
}

export function parseAccessCodeDuration(raw: string): AccessCodeDuration {
  const value = raw.trim().toLowerCase();
  if (value === "none" || value === "forever") return null;
  const days = Number(value);
  if (days === 30 || days === 90 || days === 180) return days;
  throw new AppError("ACCESS_CODE", "Choose 30, 90, or 180 days, or no end date.");
}

function randomCodeChar() {
  const max = 256 - (256 % ALPHABET.length);
  let byte = 0;
  do {
    byte = randomBytes(1)[0] ?? 0;
  } while (byte >= max);
  return ALPHABET[byte % ALPHABET.length] ?? "A";
}

export function generateAccessCode() {
  let body = "";
  for (let i = 0; i < CODE_BODY; i += 1) body += randomCodeChar();
  return `SVG-${body.slice(0, 4)}-${body.slice(4)}`;
}

/** Canonical SVG-XXXX-XXXX, or null when the text cannot be a code. */
export function normalizeAccessCode(raw: string): string | null {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!compact.startsWith("SVG") || compact.length !== 3 + CODE_BODY) return null;
  const body = compact.slice(3);
  if (![...body].every((char) => ALPHABET.includes(char))) return null;
  return `SVG-${body.slice(0, 4)}-${body.slice(4)}`;
}

function rateKey(value: string) {
  const pepper = process.env.AUTH_SECRET || "access-code-rate";
  return createHash("sha256").update(`${pepper}:access-code:${value.trim().toLowerCase()}`).digest("hex");
}

export async function assertAccessCodeRateLimit(keys: string[]) {
  const unique = [...new Set(keys.map((key) => key.trim()).filter(Boolean))];
  const since = new Date(Date.now() - RATE_WINDOW_MS);
  await prisma.proAccessCodeAttempt.deleteMany({ where: { createdAt: { lt: since } } });
  for (const key of unique) {
    const keyHash = rateKey(key);
    const count = await prisma.proAccessCodeAttempt.count({
      where: { keyHash, createdAt: { gte: since } },
    });
    if (count >= RATE_MAX) {
      throw new AppError("RATE", RATE_MESSAGE, 429);
    }
  }
  if (unique.length > 0) {
    await prisma.proAccessCodeAttempt.createMany({
      data: unique.map((key) => ({ keyHash: rateKey(key) })),
    });
  }
}

function subscriptionIsLive(
  row: { status: string; currentPeriodEnd: Date | null },
  now: Date,
) {
  return row.status === "active" && !(row.currentPeriodEnd && row.currentPeriodEnd < now);
}

function assertCanRedeemOnto(
  subs: { status: string; currentPeriodEnd: Date | null; source: string; plan: string }[],
  now: Date,
) {
  for (const sub of subs) {
    if (!subscriptionIsLive(sub, now)) continue;
    if (sub.source === "access_code") {
      throw new AppError("ACCESS_CODE", "You already have Pro from an access code.");
    }
    if (planIsPro(normalizePlanId(sub.plan))) {
      throw new AppError("ACCESS_CODE", "This account already has Pro. The code was not used.");
    }
  }
}

export function accessCodeStatus(
  row: { revokedAt: Date | null; redeemedAt: Date | null; expiresAt: Date | null },
  now = new Date(),
): AccessCodeStatus {
  if (row.revokedAt) return "revoked";
  if (!row.redeemedAt) return "unused";
  if (row.expiresAt && row.expiresAt.getTime() < now.getTime()) return "expired";
  return "redeemed";
}

export function accessCodeStatusLine(
  input: { source: string; status: string; currentPeriodEnd: Date | null },
  now = new Date(),
) {
  if (input.source !== "access_code" || input.status !== "active") return null;
  if (input.currentPeriodEnd && input.currentPeriodEnd < now) return null;
  if (!input.currentPeriodEnd) return "Pro from an access code. No end date. No card.";
  const days = Math.max(1, Math.ceil((input.currentPeriodEnd.getTime() - now.getTime()) / 86_400_000));
  const unit = days === 1 ? "day" : "days";
  return `Pro from an access code, ${days} ${unit} left. No card.`;
}

export async function liveAccessCodeGrant(userId: string, now = new Date()) {
  const rows = await prisma.proAccessCode.findMany({
    where: { redeemedById: userId, revokedAt: null },
    select: { expiresAt: true },
  });
  const live = rows.find((row) => !row.expiresAt || row.expiresAt.getTime() > now.getTime());
  return live ? { expiresAt: live.expiresAt } : null;
}

async function loadCode(normalized: string) {
  return prisma.proAccessCode.findUnique({ where: { code: normalized } });
}

/** Server-side check that does not consume the code. */
export async function assertAccessCodeRedeemable(input: { code: string; email: string }) {
  const normalized = normalizeAccessCode(input.code);
  if (!normalized) throw new AppError("ACCESS_CODE", "That code is not valid.");
  const code = await loadCode(normalized);
  if (!code || code.revokedAt || code.redeemedAt) {
    throw new AppError("ACCESS_CODE", "That code is not valid.");
  }
  const email = input.email.trim().toLowerCase();
  if (code.emailLock && code.emailLock !== email) {
    throw new AppError("ACCESS_CODE", "That code can only be used by the email it was created for.");
  }
}

export async function createProAccessCode(input: {
  actor: Actor;
  label?: string;
  emailLock?: string;
  durationDays: AccessCodeDuration;
}) {
  assertActor(input.actor);
  const label = (input.label ?? "").trim().slice(0, 80);
  const emailLock = normalizeLock(input.emailLock ?? "");
  if (
    input.durationDays !== null &&
    input.durationDays !== 30 &&
    input.durationDays !== 90 &&
    input.durationDays !== 180
  ) {
    throw new AppError("ACCESS_CODE", "Choose 30, 90, or 180 days, or no end date.");
  }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.proAccessCode.create({
        data: {
          code: generateAccessCode(),
          label,
          emailLock,
          durationDays: input.durationDays,
          createdById: input.actor.id,
        },
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "P2002") throw error;
    }
  }
  throw new AppError("ACCESS_CODE", "Could not create a code. Try again.");
}

export async function listProAccessCodes(now = new Date()): Promise<AccessCodeView[]> {
  const rows = await prisma.proAccessCode.findMany({
    orderBy: { createdAt: "desc" },
    include: { redeemedBy: { select: { email: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    label: row.label,
    emailLock: row.emailLock,
    durationDays: row.durationDays,
    createdAt: row.createdAt,
    status: accessCodeStatus(row, now),
    redeemedAt: row.redeemedAt,
    redeemedByEmail: row.redeemedBy?.email ?? null,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
  }));
}

export async function revokeProAccessCode(input: { actor: Actor; codeId: string; now?: Date }) {
  assertActor(input.actor);
  const now = input.now ?? new Date();
  const code = await prisma.proAccessCode.findUnique({ where: { id: input.codeId } });
  if (!code) throw new AppError("ACCESS_CODE", "That code was not found.");
  if (!code.revokedAt) {
    await prisma.proAccessCode.update({
      where: { id: code.id },
      data: { revokedAt: now },
    });
  }
  if (!code.redeemedById || !code.subscriptionId) return;
  const grant = await prisma.subscription.findUnique({ where: { id: code.subscriptionId } });
  if (!grant || grant.userId !== code.redeemedById || grant.source !== "access_code") return;
  const newer = await prisma.proAccessCode.findFirst({
    where: {
      redeemedById: code.redeemedById,
      subscriptionId: grant.id,
      redeemedAt: { gt: code.redeemedAt ?? new Date(0) },
    },
    select: { id: true },
  });
  if (newer) return;
  await prisma.subscription.update({
    where: { id: grant.id },
    data: { status: "canceled", currentPeriodEnd: now },
  });
}

async function redeemChecked(input: {
  userId: string;
  email: string;
  normalized: string;
  now: Date;
}) {
  const code = await loadCode(input.normalized);
  if (!code || code.revokedAt || code.redeemedAt) {
    throw new AppError("ACCESS_CODE", "That code is not valid.");
  }
  const email = input.email.trim().toLowerCase();
  if (code.emailLock && code.emailLock !== email) {
    throw new AppError("ACCESS_CODE", "That code can only be used by the email it was created for.");
  }
  const subs = await prisma.subscription.findMany({ where: { userId: input.userId } });
  assertCanRedeemOnto(subs, input.now);

  await prisma.$transaction(async (tx) => {
    const current = await tx.subscription.findMany({ where: { userId: input.userId } });
    assertCanRedeemOnto(current, input.now);
    const claimed = await tx.proAccessCode.updateMany({
      where: { id: code.id, redeemedAt: null, revokedAt: null },
      data: { redeemedAt: input.now, redeemedById: input.userId },
    });
    if (claimed.count !== 1) {
      throw new AppError("ACCESS_CODE", "That code is not valid.");
    }
    const granted = await grantCatalogPlan(
      {
        targetUserId: input.userId,
        plan: "performance",
        days: code.durationDays,
        source: "access_code",
      },
      tx,
    );
    await tx.proAccessCode.update({
      where: { id: code.id },
      data: { expiresAt: granted.currentPeriodEnd, subscriptionId: granted.id },
    });
  });
  await ensureCreditsForPlan(input.userId, "performance");
}

export async function redeemProAccessCode(input: {
  userId: string;
  email: string;
  code: string;
  rateKeys?: string[];
  skipRateLimit?: boolean;
  now?: Date;
}) {
  const raw = input.code.trim();
  if (!raw) throw new AppError("ACCESS_CODE", "Enter a code.");
  if (!input.skipRateLimit) {
    await assertAccessCodeRateLimit(input.rateKeys ?? [`user:${input.userId}`, `email:${input.email}`]);
  }
  const normalized = normalizeAccessCode(raw);
  if (!normalized) throw new AppError("ACCESS_CODE", "That code is not valid.");
  await redeemChecked({
    userId: input.userId,
    email: input.email,
    normalized,
    now: input.now ?? new Date(),
  });
}
