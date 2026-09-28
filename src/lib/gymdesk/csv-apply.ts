import { prisma } from "@/lib/prisma";
import type { GymdeskCsvRow } from "@/lib/gymdesk/csv";
import { setSyncMeta, upsertRosterFromCsvRow } from "@/lib/gymdesk/roster";
import { recomputeMembership, startCanceledGrace } from "@/lib/gymdesk/recompute";
import { CHECKOUT_SKUS, isCheckoutSkuId } from "@/lib/plans";

function isGymPricedSubscription(row: { plan: string; stripePriceId: string }) {
  if (row.plan === "gym" || /_gym$/.test(row.plan)) return true;
  if (isCheckoutSkuId(row.plan) && CHECKOUT_SKUS[row.plan].requiresGymVerify) return true;
  for (const sku of Object.values(CHECKOUT_SKUS)) {
    if (!sku.requiresGymVerify) continue;
    const price = process.env[sku.envPrice];
    if (price && price === row.stripePriceId) return true;
  }
  return false;
}

export type CsvDiff = {
  incoming: number;
  newIds: string[];
  statusChanges: { gymdeskId: string; from: string; to: string; label: string }[];
  unknownStatus: { gymdeskId: string; statusRaw: string; label: string }[];
  missingActive: { gymdeskId: string; label: string; linkedUserId: string | null }[];
};

export async function previewGymdeskCsv(rows: GymdeskCsvRow[]): Promise<CsvDiff> {
  const existing = await prisma.gymdeskMember.findMany();
  const byId = new Map(existing.map((row) => [row.gymdeskId, row]));
  const incomingIds = new Set(rows.map((row) => row.gymdeskId));
  const newIds: string[] = [];
  const statusChanges: CsvDiff["statusChanges"] = [];
  const unknownStatus: CsvDiff["unknownStatus"] = [];
  for (const row of rows) {
    const current = byId.get(row.gymdeskId);
    const nextStatus = row.mapped.status === "unknown" ? "pending" : row.mapped.status;
    if (!current) newIds.push(row.gymdeskId);
    else if (current.status !== nextStatus) {
      statusChanges.push({
        gymdeskId: row.gymdeskId,
        from: current.status,
        to: nextStatus,
        label: row.displayLabel,
      });
    }
    if (row.mapped.status === "unknown") {
      unknownStatus.push({
        gymdeskId: row.gymdeskId,
        statusRaw: row.statusRaw,
        label: row.displayLabel,
      });
    }
  }
  const missingActive = existing
    .filter((row) => row.status === "active" && !incomingIds.has(row.gymdeskId))
    .map((row) => ({
      gymdeskId: row.gymdeskId,
      label: row.displayLabel,
      linkedUserId: row.linkedUserId,
    }));
  return {
    incoming: rows.length,
    newIds,
    statusChanges,
    unknownStatus,
    missingActive,
  };
}

export async function applyGymdeskCsv(rows: GymdeskCsvRow[], now = new Date()) {
  const diff = await previewGymdeskCsv(rows);
  const incomingIds = new Set(rows.map((row) => row.gymdeskId));
  for (const row of rows) {
    const saved = await upsertRosterFromCsvRow(row, now);
    if (saved.linkedUserId) {
      if (saved.status === "active") {
        await prisma.profile.update({
          where: { userId: saved.linkedUserId },
          data: { gymMembershipGraceUntil: null, gymdeskMemberId: saved.gymdeskId },
        });
        await recomputeMembership(saved.linkedUserId, now);
      } else if (saved.status === "canceled") {
        await startCanceledGrace(saved.linkedUserId, now);
      } else {
        await recomputeMembership(saved.linkedUserId, now);
      }
    }
  }
  const missing = await prisma.gymdeskMember.findMany({
    where: { status: "active", gymdeskId: { notIn: [...incomingIds] } },
  });
  for (const row of missing) {
    const updated = await prisma.gymdeskMember.update({
      where: { id: row.id },
      data: { status: "canceled", statusChangedAt: now, lastSeenAt: now, source: "csv" },
    });
    if (updated.linkedUserId) {
      await startCanceledGrace(updated.linkedUserId, now);
    }
  }
  await setSyncMeta("csv:last", String(rows.length), now);
  return diff;
}

export async function listGymdeskAdminSnapshot() {
  const [counts, meta, queue, activeSubs] = await Promise.all([
    prisma.gymdeskMember.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.gymdeskSyncMeta.findMany({ orderBy: { at: "desc" } }),
    prisma.gymdeskMatchQueue.findMany({
      where: { status: "open" },
      include: { user: { select: { email: true, id: true } } },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
    prisma.subscription.findMany({
      where: { status: "active" },
      include: { user: { include: { profile: true } } },
      take: 80,
    }),
  ]);
  const memberIds = [...new Set(queue.map((row) => row.gymdeskMemberId).filter(Boolean))];
  const members = memberIds.length
    ? await prisma.gymdeskMember.findMany({
        where: { gymdeskId: { in: memberIds } },
        select: { gymdeskId: true, displayLabel: true, status: true },
      })
    : [];
  const memberById = Object.fromEntries(members.map((row) => [row.gymdeskId, row]));
  const rosterCounts = Object.fromEntries(counts.map((row) => [row.status, row._count._all]));
  const flaggedGymSubs = activeSubs.filter(
    (row) =>
      isGymPricedSubscription(row) &&
      row.user.profile &&
      !row.user.profile.gymMembershipVerified,
  );
  const queueView = queue.map((item) => ({
    ...item,
    member: memberById[item.gymdeskMemberId] ?? null,
  }));
  return { rosterCounts, meta, queue: queueView, flaggedGymSubs };
}
