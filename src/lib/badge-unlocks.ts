import { BADGE_IDS, type BadgeId, type EarnedBadge } from "@/lib/badges";

export function parseSeenBadgeUnlocks(raw: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function mergeSeenBadgeUnlocks(current: string[], add: Iterable<string>) {
  return [...new Set([...current, ...add])];
}

export function isBadgeId(value: string): value is BadgeId {
  return (BADGE_IDS as readonly string[]).includes(value);
}

export function parseUnlockQuery(value: string | null | undefined): BadgeId[] {
  if (!value) return [];
  const seen = new Set<BadgeId>();
  for (const part of value.split(",")) {
    const id = part.trim();
    if (isBadgeId(id) && !seen.has(id)) seen.add(id);
  }
  return [...seen];
}

export function serializeUnlockQuery(ids: string[]) {
  return ids.filter(isBadgeId).join(",");
}

export function unseenEarnedBadges(badges: EarnedBadge[], seenIds: Iterable<string>) {
  const seen = new Set(seenIds);
  return badges.filter((badge) => badge.earned && !seen.has(badge.id));
}

export function newlyEarnedBadges(before: EarnedBadge[], after: EarnedBadge[]) {
  const prior = new Set(before.filter((badge) => badge.earned).map((badge) => badge.id));
  return after.filter((badge) => badge.earned && !prior.has(badge.id));
}

/** Seed seen with badges already earned so we do not replay history. Keep new IDs unseen. */
export function seedSeenExcludingNew(alreadyEarnedIds: string[], newlyEarnedIds: string[]) {
  const fresh = new Set(newlyEarnedIds);
  return alreadyEarnedIds.filter((id) => !fresh.has(id));
}

export function unlockLine(title: string) {
  return `Unlocked: ${title}`;
}

export function badgeShareStats(badge: Pick<EarnedBadge, "mark" | "ribbon" | "title">) {
  return [
    { key: "unlocked", label: "Unlocked", value: "Yes" },
    { key: "mark", label: badge.ribbon, value: badge.mark },
    { key: "badge", label: "Badge", value: badge.title },
  ];
}
