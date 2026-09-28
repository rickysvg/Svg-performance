import { prisma } from "@/lib/prisma";
import { gymdeskGraceDays, gymdeskFrozenGraceDays } from "@/lib/gymdesk/config";
import type { GymdeskStatus } from "@/lib/gymdesk/config";

export type MembershipOverride = "none" | "force_on" | "force_off";

function addDays(from: Date, days: number) {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function writeMembershipEvent(input: {
  userId: string;
  from: string;
  to: string;
  reason: string;
  source: string;
  at?: Date;
}) {
  if (input.from === input.to && input.reason !== "checked") return;
  await prisma.gymMembershipEvent.create({
    data: {
      userId: input.userId,
      from: input.from,
      to: input.to,
      reason: input.reason,
      source: input.source,
      at: input.at ?? new Date(),
    },
  });
}

export async function recomputeMembership(userId: string, now = new Date()) {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) return null;

  const override = (profile.gymMembershipOverride || "none") as MembershipOverride;
  const previous = profile.gymMembershipVerified;
  let next = previous;
  let reason = "unchanged";
  let source = profile.gymMembershipSource || "";
  let gymdeskStatus = profile.gymdeskStatus;
  let graceUntil = profile.gymMembershipGraceUntil;
  let gymMembershipSource = profile.gymMembershipSource;

  if (override === "force_on") {
    next = true;
    reason = "admin_force_on";
    source = "admin";
    gymMembershipSource = "admin";
  } else if (override === "force_off") {
    next = false;
    reason = "admin_force_off";
    source = "admin";
    gymMembershipSource = "admin";
  } else {
    gymMembershipSource = profile.gymdeskMemberId ? "gymdesk" : gymMembershipSource;
    source = "gymdesk";
    const linked = profile.gymdeskMemberId
      ? await prisma.gymdeskMember.findUnique({ where: { gymdeskId: profile.gymdeskMemberId } })
      : null;
    if (!linked) {
      next = false;
      reason = "no_link";
      gymdeskStatus = "";
    } else {
      gymdeskStatus = linked.status;
      if (linked.status === "active") {
        next = true;
        reason = "gymdesk_active";
        graceUntil = null;
      } else if (linked.status === "frozen") {
        const since = linked.frozenSince ?? linked.statusChangedAt ?? now;
        const limit = addDays(since, gymdeskFrozenGraceDays());
        if (now.getTime() <= limit.getTime()) {
          next = true;
          reason = "frozen_grace";
        } else {
          next = false;
          reason = "frozen_lapsed";
        }
      } else if (linked.status === "canceled") {
        if (previous && !graceUntil) {
          graceUntil = addDays(now, gymdeskGraceDays());
          next = true;
          reason = "canceled_grace_start";
        } else if (graceUntil && now.getTime() <= graceUntil.getTime()) {
          next = true;
          reason = "canceled_grace";
        } else {
          next = false;
          reason = "canceled_lapsed";
        }
      } else {
        next = false;
        reason = linked.status === "visitor" || linked.status === "pending" ? "not_active" : "unknown_status";
      }
    }
  }

  const changed = previous !== next || gymdeskStatus !== profile.gymdeskStatus;
  const row = await prisma.profile.update({
    where: { userId },
    data: {
      gymMembershipVerified: next,
      gymMembershipSource,
      gymdeskStatus,
      gymdeskCheckedAt: now,
      gymMembershipGraceUntil: graceUntil,
    },
  });
  if (changed || reason.endsWith("_start")) {
    await writeMembershipEvent({
      userId,
      from: previous ? "verified" : "unverified",
      to: next ? "verified" : "unverified",
      reason,
      source,
      at: now,
    });
  }
  return { ...row, reason };
}

export async function startCanceledGrace(userId: string, now = new Date()) {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile?.gymMembershipVerified) {
    return recomputeMembership(userId, now);
  }
  if (profile.gymMembershipOverride === "force_on" || profile.gymMembershipOverride === "force_off") {
    return recomputeMembership(userId, now);
  }
  if (!profile.gymMembershipGraceUntil) {
    await prisma.profile.update({
      where: { userId },
      data: { gymMembershipGraceUntil: addDays(now, gymdeskGraceDays()) },
    });
  }
  return recomputeMembership(userId, now);
}

export async function clearGraceAndRecompute(userId: string, now = new Date()) {
  await prisma.profile.update({
    where: { userId },
    data: { gymMembershipGraceUntil: null },
  });
  return recomputeMembership(userId, now);
}

export function formatGraceDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export type GymdeskStatusName = GymdeskStatus;
