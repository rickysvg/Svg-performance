import { prisma } from "@/lib/prisma";
import type { GymdeskStatus } from "@/lib/gymdesk/config";
import { hashesFromWebhook, type GymdeskCsvRow } from "@/lib/gymdesk/csv";
import { clearGraceAndRecompute, recomputeMembership, startCanceledGrace } from "@/lib/gymdesk/recompute";

export async function setSyncMeta(key: string, value: string, at = new Date()) {
  await prisma.gymdeskSyncMeta.upsert({
    where: { key },
    create: { key, value, at },
    update: { value, at },
  });
}

export async function getSyncMeta(key: string) {
  return prisma.gymdeskSyncMeta.findUnique({ where: { key } });
}

export async function upsertRosterFromWebhook(input: {
  event: string;
  gymdeskId: string;
  name?: string;
  email?: string;
  phone?: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const hashes = hashesFromWebhook(input);
  const status: GymdeskStatus =
    input.event === "frozen" ? "frozen" : input.event === "canceled" || input.event === "expired" ? "canceled" : "active";

  const existing = await prisma.gymdeskMember.findUnique({
    where: { gymdeskId: input.gymdeskId },
  });
  const frozenSince =
    status === "frozen" ? existing?.frozenSince ?? now : status === "active" ? null : existing?.frozenSince ?? null;
  const row = await prisma.gymdeskMember.upsert({
    where: { gymdeskId: input.gymdeskId },
    create: {
      gymdeskId: input.gymdeskId,
      emailHash: hashes.emailHash,
      phoneHash: hashes.phoneHash,
      nameKey: hashes.nameKey,
      displayLabel: hashes.displayLabel,
      status,
      statusChangedAt: now,
      frozenSince,
      lastSeenAt: now,
      source: "webhook",
    },
    update: {
      emailHash: hashes.emailHash || undefined,
      phoneHash: hashes.phoneHash || undefined,
      nameKey: hashes.nameKey || undefined,
      displayLabel: hashes.displayLabel || undefined,
      status,
      statusChangedAt: existing?.status === status ? existing.statusChangedAt : now,
      frozenSince,
      lastSeenAt: now,
      source: "webhook",
    },
  });

  const linkedUserId =
    row.linkedUserId ??
    (
      await prisma.profile.findFirst({
        where: { gymdeskMemberId: input.gymdeskId },
        select: { userId: true },
      })
    )?.userId ??
    null;

  if (linkedUserId) {
    if (status === "active") {
      await prisma.profile.update({
        where: { userId: linkedUserId },
        data: { gymdeskMemberId: input.gymdeskId },
      });
      await clearGraceAndRecompute(linkedUserId, now);
    } else if (status === "frozen") {
      await recomputeMembership(linkedUserId, now);
    } else {
      await startCanceledGrace(linkedUserId, now);
    }
  }
  return row;
}

export async function upsertRosterFromCsvRow(row: GymdeskCsvRow, now = new Date()) {
  const status = row.mapped.status === "unknown" ? "pending" : row.mapped.status;
  const existing = await prisma.gymdeskMember.findUnique({ where: { gymdeskId: row.gymdeskId } });
  const frozenSince =
    status === "frozen" ? existing?.frozenSince ?? now : status === "active" ? null : existing?.frozenSince ?? null;
  return prisma.gymdeskMember.upsert({
    where: { gymdeskId: row.gymdeskId },
    create: {
      gymdeskId: row.gymdeskId,
      emailHash: row.emailHash,
      email2Hash: row.email2Hash,
      phoneHash: row.phoneHash,
      phone2Hash: row.phone2Hash,
      nameKey: row.nameKey,
      displayLabel: row.displayLabel,
      membershipLabel: row.membership,
      status,
      statusChangedAt: now,
      frozenSince,
      lastSeenAt: now,
      source: "csv",
    },
    update: {
      emailHash: row.emailHash,
      email2Hash: row.email2Hash,
      phoneHash: row.phoneHash,
      phone2Hash: row.phone2Hash,
      nameKey: row.nameKey,
      displayLabel: row.displayLabel,
      membershipLabel: row.membership,
      status,
      statusChangedAt: existing?.status === status ? existing.statusChangedAt : now,
      frozenSince,
      lastSeenAt: now,
      source: "csv",
    },
  });
}
