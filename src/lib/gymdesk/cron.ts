import { prisma } from "@/lib/prisma";
import { gymdeskStaleDays, isGymdeskSyncEnabled } from "@/lib/gymdesk/config";
import { matchUserToGymdesk } from "@/lib/gymdesk/match";
import { recomputeMembership } from "@/lib/gymdesk/recompute";

export async function runGymdeskDailyCron(now = new Date()) {
  if (!isGymdeskSyncEnabled()) {
    return { disabled: true, rematched: 0, recomputed: 0, stale: false };
  }

  const cutoff = new Date(now.getTime() - gymdeskStaleDays() * 24 * 60 * 60 * 1000);
  const latest = await prisma.gymdeskSyncMeta.findMany({
    orderBy: { at: "desc" },
    take: 8,
  });
  const stale = latest.length === 0 || latest.every((row) => row.at < cutoff);

  const graceDue = await prisma.profile.findMany({
    where: {
      gymMembershipGraceUntil: { lte: now },
      gymMembershipOverride: "none",
    },
    select: { userId: true },
  });
  let recomputed = 0;
  for (const row of graceDue) {
    await recomputeMembership(row.userId, now);
    recomputed += 1;
  }

  const frozenLinked = await prisma.gymdeskMember.findMany({
    where: { status: "frozen", linkedUserId: { not: null } },
    select: { linkedUserId: true },
  });
  for (const row of frozenLinked) {
    if (!row.linkedUserId) continue;
    await recomputeMembership(row.linkedUserId, now);
    recomputed += 1;
  }

  const unlinked = await prisma.profile.findMany({
    where: {
      emailVerifiedAt: { not: null },
      gymdeskMemberId: "",
      gymMembershipOverride: "none",
    },
    select: { userId: true },
  });
  let rematched = 0;
  for (const row of unlinked) {
    await matchUserToGymdesk(row.userId, now);
    rematched += 1;
  }

  return { disabled: false, rematched, recomputed, stale };
}
