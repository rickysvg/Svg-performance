import { prisma } from "@/lib/prisma";
import { hashEmail, hashPhone, hashNameKey } from "@/lib/gymdesk/crypto";
import { isGymdeskSyncEnabled } from "@/lib/gymdesk/config";
import { recomputeMembership } from "@/lib/gymdesk/recompute";

type MatchKind = "verified" | "suggested" | "conflict" | "none";

async function enqueue(input: {
  userId: string;
  gymdeskMemberId: string;
  kind: "suggested" | "conflict";
  reason: string;
}) {
  const open = await prisma.gymdeskMatchQueue.findFirst({
    where: {
      userId: input.userId,
      gymdeskMemberId: input.gymdeskMemberId,
      kind: input.kind,
      status: "open",
    },
  });
  if (open) return open;
  return prisma.gymdeskMatchQueue.create({
    data: {
      userId: input.userId,
      gymdeskMemberId: input.gymdeskMemberId,
      kind: input.kind,
      reason: input.reason,
      status: "open",
    },
  });
}

async function linkUserToRoster(userId: string, gymdeskId: string, now = new Date()) {
  await prisma.gymdeskMember.update({
    where: { gymdeskId },
    data: { linkedUserId: userId },
  });
  await prisma.profile.update({
    where: { userId },
    data: { gymdeskMemberId: gymdeskId, gymMembershipSource: "gymdesk" },
  });
  return recomputeMembership(userId, now);
}

export async function matchUserToGymdesk(userId: string, now = new Date()) {
  if (!isGymdeskSyncEnabled()) return { kind: "none" as MatchKind };
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!user?.profile) return { kind: "none" as MatchKind };

  if (user.profile.gymdeskMemberId) {
    await recomputeMembership(userId, now);
    return { kind: "verified" as MatchKind, gymdeskId: user.profile.gymdeskMemberId };
  }

  const emailHash = user.profile.emailVerifiedAt ? hashEmail(user.email) : "";
  if (emailHash) {
    const emailHits = await prisma.gymdeskMember.findMany({
      where: {
        OR: [{ emailHash }, { email2Hash: emailHash }],
      },
    });
    const unique = new Map(emailHits.map((row) => [row.gymdeskId, row]));
    const rows = [...unique.values()];
    if (rows.length === 1) {
      const row = rows[0]!;
      if (row.linkedUserId && row.linkedUserId !== userId) {
        await enqueue({
          userId,
          gymdeskMemberId: row.gymdeskId,
          kind: "conflict",
          reason: "already_linked",
        });
        return { kind: "conflict" as MatchKind };
      }
      if (row.status === "visitor" || row.status === "pending") {
        await enqueue({
          userId,
          gymdeskMemberId: row.gymdeskId,
          kind: "conflict",
          reason: row.status,
        });
        return { kind: "conflict" as MatchKind };
      }
      if (row.status === "active") {
        await linkUserToRoster(userId, row.gymdeskId, now);
        return { kind: "verified" as MatchKind, gymdeskId: row.gymdeskId };
      }
      await enqueue({
        userId,
        gymdeskMemberId: row.gymdeskId,
        kind: "conflict",
        reason: "email_not_active",
      });
      return { kind: "conflict" as MatchKind };
    }
    if (rows.length > 1) {
      const last = user.profile.displayName.trim().split(/\s+/).slice(-1)[0] ?? "";
      const first = user.profile.displayName.trim().split(/\s+/)[0] ?? "";
      const nameKey = hashNameKey(last, first);
      const named = nameKey ? rows.filter((row) => row.nameKey === nameKey) : [];
      if (named.length !== 1) {
        await enqueue({
          userId,
          gymdeskMemberId: rows[0]!.gymdeskId,
          kind: "conflict",
          reason: "email_ambiguous",
        });
        return { kind: "conflict" as MatchKind };
      }
      const row = named[0]!;
      if (row.status === "active" && (!row.linkedUserId || row.linkedUserId === userId)) {
        await linkUserToRoster(userId, row.gymdeskId, now);
        return { kind: "verified" as MatchKind, gymdeskId: row.gymdeskId };
      }
      await enqueue({
        userId,
        gymdeskMemberId: row.gymdeskId,
        kind: "conflict",
        reason: "email_ambiguous",
      });
      return { kind: "conflict" as MatchKind };
    }
  }

  const phoneHash = user.profile.phoneE164 ? hashPhone(user.profile.phoneE164) : "";
  const last = user.profile.displayName.trim().split(/\s+/).slice(-1)[0] ?? "";
  const first = user.profile.displayName.trim().split(/\s+/)[0] ?? "";
  const nameKey = hashNameKey(last, first);
  if (phoneHash && nameKey) {
    const phoneHits = await prisma.gymdeskMember.findMany({
      where: {
        AND: [
          { nameKey },
          { OR: [{ phoneHash }, { phone2Hash: phoneHash }] },
        ],
      },
    });
    const unique = [...new Map(phoneHits.map((row) => [row.gymdeskId, row])).values()];
    if (unique.length === 1) {
      const row = unique[0]!;
      await enqueue({
        userId,
        gymdeskMemberId: row.gymdeskId,
        kind: "suggested",
        reason: "phone_name",
      });
      return { kind: "suggested" as MatchKind, gymdeskId: row.gymdeskId };
    }
    if (unique.length > 1) {
      await enqueue({
        userId,
        gymdeskMemberId: unique[0]!.gymdeskId,
        kind: "conflict",
        reason: "phone_ambiguous",
      });
      return { kind: "conflict" as MatchKind };
    }
  }

  await prisma.profile.update({
    where: { userId },
    data: { gymdeskCheckedAt: now },
  });
  return { kind: "none" as MatchKind };
}

export async function approveQueueItem(adminUserId: string, queueId: string, now = new Date()) {
  const item = await prisma.gymdeskMatchQueue.findUnique({ where: { id: queueId } });
  if (!item || item.status !== "open") {
    return item;
  }
  if (item.gymdeskMemberId) {
    const row = await prisma.gymdeskMember.findUnique({
      where: { gymdeskId: item.gymdeskMemberId },
    });
    if (row?.linkedUserId && row.linkedUserId !== item.userId) {
      return prisma.gymdeskMatchQueue.update({
        where: { id: queueId },
        data: { reason: "already_linked" },
      });
    }
    await linkUserToRoster(item.userId, item.gymdeskMemberId, now);
  }
  return prisma.gymdeskMatchQueue.update({
    where: { id: queueId },
    data: { status: "approved", resolvedAt: now, resolvedBy: adminUserId },
  });
}

export async function dismissQueueItem(adminUserId: string, queueId: string, now = new Date()) {
  return prisma.gymdeskMatchQueue.update({
    where: { id: queueId },
    data: { status: "dismissed", resolvedAt: now, resolvedBy: adminUserId },
  });
}
