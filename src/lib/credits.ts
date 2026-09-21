import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import {
  CREDIT_KINDS,
  CREDIT_LABELS,
  type CatalogPlanId,
  type CreditKind,
  PLAN_CATALOG,
} from "@/lib/plans";
import { getEffectivePlanId } from "@/lib/entitlements";

export function startOfUtcMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function isCreditKind(value: string): value is CreditKind {
  return (CREDIT_KINDS as readonly string[]).includes(value);
}

export async function ensureCreditsForPlan(userId: string, planId: CatalogPlanId, now = new Date()) {
  const periodStart = startOfUtcMonth(now);
  const allotments = PLAN_CATALOG[planId].credits;
  const kinds = Object.keys(allotments) as CreditKind[];
  for (const kind of kinds) {
    const allotted = allotments[kind] ?? 0;
    await prisma.coachingCredit.upsert({
      where: { userId_kind_periodStart: { userId, kind, periodStart } },
      create: { userId, kind, periodStart, allotted, used: 0 },
      update: { allotted },
    });
  }
  return listCreditsForUser(userId, now);
}

export async function listCreditsForUser(userId: string, now = new Date()) {
  const periodStart = startOfUtcMonth(now);
  const rows = await prisma.coachingCredit.findMany({
    where: { userId, periodStart },
    orderBy: { kind: "asc" },
  });
  return rows.map((row) => ({
    ...row,
    label: isCreditKind(row.kind) ? CREDIT_LABELS[row.kind] : row.kind,
    remaining: Math.max(0, row.allotted - row.used),
  }));
}

export async function remainingCredit(userId: string, kind: CreditKind, now = new Date()) {
  const periodStart = startOfUtcMonth(now);
  const row = await prisma.coachingCredit.findUnique({
    where: { userId_kind_periodStart: { userId, kind, periodStart } },
  });
  if (!row) return 0;
  return Math.max(0, row.allotted - row.used);
}

export async function markCreditUsed(input: {
  actorUserId: string;
  actorRole: string;
  targetUserId: string;
  kind: string;
}) {
  if (input.actorRole !== "admin" && input.actorUserId !== input.targetUserId) {
    throw new ForbiddenError("You cannot spend another member's coaching credits.");
  }
  if (input.actorRole !== "admin" && input.actorUserId === input.targetUserId) {
    throw new ForbiddenError("Only an admin or coach desk marks a credit used after the session.");
  }
  if (input.actorRole !== "admin") {
    throw new ForbiddenError("Only an admin can mark a credit used in this preview.");
  }
  if (!isCreditKind(input.kind)) {
    throw new AppError("CREDIT", "Pick a valid credit type.");
  }
  const periodStart = startOfUtcMonth();
  const row = await prisma.coachingCredit.findUnique({
    where: {
      userId_kind_periodStart: {
        userId: input.targetUserId,
        kind: input.kind,
        periodStart,
      },
    },
  });
  if (!row) {
    throw new NotFoundError("No credit of that type is allotted this month.");
  }
  if (row.used >= row.allotted) {
    throw new AppError("CREDIT", "That credit is already used up this billing month.");
  }
  return prisma.coachingCredit.update({
    where: { id: row.id },
    data: { used: row.used + 1 },
  });
}

export async function creditsForCurrentPlan(userId: string) {
  const planId = await getEffectivePlanId(userId);
  await ensureCreditsForPlan(userId, planId);
  return {
    planId,
    credits: await listCreditsForUser(userId),
  };
}
