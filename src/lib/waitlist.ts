import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { type CatalogPlanId, isCatalogPlanId, PLAN_CAPS, PLAN_CATALOG } from "@/lib/plans";
import { normalizePlanId } from "@/lib/plans";

export function capForPlan(planId: CatalogPlanId): number | null {
  if (planId === "elite") return PLAN_CAPS.elite;
  if (planId === "vip") return PLAN_CAPS.vip;
  if (planId === "platinum") return PLAN_CAPS.platinum;
  return PLAN_CATALOG[planId].cap;
}

export async function countActiveSeats(planId: CatalogPlanId, now = new Date()) {
  const rows = await prisma.subscription.findMany({
    where: { status: "active" },
  });
  return rows.filter((row) => {
    if (normalizePlanId(row.plan) !== planId) return false;
    if (row.currentPeriodEnd && row.currentPeriodEnd < now) return false;
    return true;
  }).length;
}

export async function isPlanAtCap(planId: CatalogPlanId) {
  const cap = capForPlan(planId);
  if (cap == null) return false;
  const seats = await countActiveSeats(planId);
  return seats >= cap;
}

export async function joinWaitlist(userId: string, plan: string) {
  const planId = isCatalogPlanId(plan) ? plan : normalizePlanId(plan);
  if (capForPlan(planId) == null) {
    throw new AppError("WAITLIST", "That plan does not use a waitlist.");
  }
  return prisma.planWaitlist.upsert({
    where: { userId_plan: { userId, plan: planId } },
    create: { userId, plan: planId, status: "waiting" },
    update: { status: "waiting" },
  });
}

export async function listWaitlist(plan?: CatalogPlanId) {
  return prisma.planWaitlist.findMany({
    where: {
      status: "waiting",
      ...(plan ? { plan } : {}),
    },
    include: { user: { select: { id: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function listSeatStatus() {
  const ids = ["elite", "vip", "platinum"] as const;
  const rows = await Promise.all(
    ids.map(async (id) => ({
      id,
      label: PLAN_CATALOG[id].label,
      seats: await countActiveSeats(id),
      cap: capForPlan(id) ?? 0,
      atCap: await isPlanAtCap(id),
    })),
  );
  return rows;
}
