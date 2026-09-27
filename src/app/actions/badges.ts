"use server";

import { requireUserOrThrow } from "@/lib/session";
import { getProfileForUser, writeSeenBadgeUnlocksForUser } from "@/lib/profile";
import { evaluateBadgesForUser } from "@/lib/progress-companion";
import { isBadgeId, parseUnlockQuery } from "@/lib/badge-unlocks";
import { publicErrorMessage } from "@/lib/errors";
import type { EarnedBadge } from "@/lib/badges";

export type UnlockBadgePayload = Pick<
  EarnedBadge,
  "id" | "title" | "hint" | "icon" | "mark" | "tier" | "ribbon"
>;

export async function loadUnlockBadgesAction(ids: string[]): Promise<UnlockBadgePayload[]> {
  const user = await requireUserOrThrow();
  const profile = await getProfileForUser(user.id);
  const units = profile?.preferredUnits ?? "lb";
  const wanted = parseUnlockQuery(ids.filter(isBadgeId).join(","));
  const badges = await evaluateBadgesForUser(user.id, units);
  return wanted
    .map((id) => badges.find((row) => row.id === id))
    .filter((row): row is EarnedBadge => Boolean(row))
    .map((row) => ({
      id: row.id,
      title: row.title,
      hint: row.hint,
      icon: row.icon,
      mark: row.mark,
      tier: row.tier,
      ribbon: row.ribbon,
    }));
}

export async function markBadgeUnlocksSeenAction(ids: string[]) {
  try {
    const user = await requireUserOrThrow();
    const clean = ids.filter(isBadgeId);
    if (clean.length === 0) return { ok: true };
    await writeSeenBadgeUnlocksForUser(user.id, clean);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: publicErrorMessage(error) };
  }
}
