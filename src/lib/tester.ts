import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError } from "@/lib/errors";
import { normalizeEmail } from "@/lib/auth";
import { adminEmailsFromEnv } from "@/lib/form-check-access";
import { APP_TIMEZONE, zonedCivilToUtc } from "@/lib/timezone";

/** Tester Pro ends when paid checkout opens: Nov 16, 2026, America/Denver. */
export const TESTER_LAUNCH_AT = zonedCivilToUtc(2026, 11, 16, APP_TIMEZONE);
export const TESTER_PLAN_LINE = "Tester · full Pro until Nov 16";
export const TESTER_MAX_USES = 100;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function testerAccessOpen(now = new Date()) {
  return now.getTime() < TESTER_LAUNCH_AT.getTime();
}

export function isTesterFlagActive(tester: boolean, now = new Date()) {
  return tester && testerAccessOpen(now);
}

/** Creating codes is limited to ADMIN_EMAILS. A role of admin is not enough. */
export function isTesterCodeAdmin(user: { email: string }) {
  return adminEmailsFromEnv().includes(normalizeEmail(user.email));
}

export function normalizeTesterCode(raw: string) {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = compact.startsWith("SVG") ? compact.slice(3) : compact;
  if (body.length < 4 || body.length > 12) return "";
  return `SVG-${body}`;
}

export function generateTesterCode() {
  const bytes = randomBytes(6);
  let body = "";
  for (let i = 0; i < 6; i += 1) {
    body += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return `SVG-${body}`;
}

function parseMaxUses(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > TESTER_MAX_USES) {
    throw new AppError("TESTER", `Enter how many people can use this code (1–${TESTER_MAX_USES}).`);
  }
  return value;
}

export async function createTesterInvite(input: {
  actor: { id: string; email: string };
  maxUses: number;
  note?: string;
}) {
  if (!isTesterCodeAdmin(input.actor)) {
    throw new ForbiddenError("Only emails in ADMIN_EMAILS can create tester codes.");
  }
  const maxUses = parseMaxUses(input.maxUses);
  const note = (input.note ?? "").trim().slice(0, 200);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateTesterCode();
    try {
      return await prisma.testerInvite.create({
        data: {
          code,
          maxUses,
          note,
          createdById: input.actor.id,
        },
      });
    } catch (error) {
      const codeTaken =
        error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002";
      if (!codeTaken || attempt === 4) throw error;
    }
  }
  throw new AppError("TESTER", "Could not generate a tester code. Try again.");
}

export async function listTesterInvites() {
  return prisma.testerInvite.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { email: true } },
      redemptions: {
        orderBy: { redeemedAt: "desc" },
        include: {
          user: {
            select: { email: true, profile: { select: { displayName: true } } },
          },
        },
      },
    },
  });
}

/**
 * Mark the account as a tester. Does not create a subscription or start checkout.
 * One redemption per account. Uses are claimed with a single conditional update.
 */
export async function redeemTesterCode(userId: string, raw: string, now = new Date()) {
  if (!testerAccessOpen(now)) {
    throw new AppError("TESTER", "Tester access closed on Nov 16, 2026.");
  }
  const code = normalizeTesterCode(raw);
  if (!code) {
    throw new AppError("TESTER", "Enter a tester code.");
  }

  return prisma.$transaction(async (tx) => {
    const already = await tx.testerRedemption.findUnique({ where: { userId } });
    if (already) {
      throw new AppError("TESTER", "This account already used a tester code.");
    }
    const invite = await tx.testerInvite.findUnique({ where: { code } });
    if (!invite) {
      throw new AppError("TESTER", "That tester code is not valid.");
    }
    const claimed = await tx.testerInvite.updateMany({
      where: { id: invite.id, uses: { lt: invite.maxUses } },
      data: { uses: { increment: 1 } },
    });
    if (claimed.count !== 1) {
      throw new AppError("TESTER", "That tester code has no uses left.");
    }
    await tx.testerRedemption.create({
      data: { inviteId: invite.id, userId, redeemedAt: now },
    });
    await tx.profile.update({
      where: { userId },
      data: { tester: true, testerRedeemedAt: now },
    });
    return { code: invite.code };
  });
}
