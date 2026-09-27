import {
  BADGE_IDS,
  mapLegacyBadgeId,
  type BadgeId,
  type EarnedBadge,
} from "@/lib/badges";

export const UNLOCK_ANIMATE_CAP = 3;

export function parseSeenBadgeUnlocks(raw: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed)
      ? migrateSeenBadgeIds(parsed.filter((item): item is string => typeof item === "string"))
      : [];
  } catch {
    return [];
  }
}

export function migrateSeenBadgeIds(ids: Iterable<string>): BadgeId[] {
  const seen = new Set<BadgeId>();
  for (const id of ids) {
    const mapped = mapLegacyBadgeId(id);
    if (mapped) seen.add(mapped);
  }
  return [...seen];
}

export function mergeSeenBadgeUnlocks(current: string[], add: Iterable<string>) {
  return migrateSeenBadgeIds([...current, ...add]);
}

export function isBadgeId(value: string): value is BadgeId {
  return (BADGE_IDS as readonly string[]).includes(value) || Boolean(mapLegacyBadgeId(value));
}

export function parseUnlockQuery(value: string | null | undefined): BadgeId[] {
  if (!value) return [];
  const seen = new Set<BadgeId>();
  for (const part of value.split(",")) {
    const mapped = mapLegacyBadgeId(part.trim());
    if (mapped && !seen.has(mapped)) seen.add(mapped);
  }
  return [...seen];
}

export function serializeUnlockQuery(ids: string[]) {
  return migrateSeenBadgeIds(ids).join(",");
}

export function unseenEarnedBadges(badges: EarnedBadge[], seenIds: Iterable<string>) {
  const seen = new Set(migrateSeenBadgeIds(seenIds));
  return badges.filter((badge) => badge.earned && !seen.has(badge.id));
}

export function newlyEarnedBadges(before: EarnedBadge[], after: EarnedBadge[]) {
  const prior = new Set(before.filter((badge) => badge.earned).map((badge) => badge.id));
  return after.filter((badge) => badge.earned && !prior.has(badge.id));
}

/** Seed seen with badges already earned so we do not replay history. Keep new IDs unseen. */
export function seedSeenExcludingNew(alreadyEarnedIds: string[], newlyEarnedIds: string[]) {
  const fresh = new Set(migrateSeenBadgeIds(newlyEarnedIds));
  return migrateSeenBadgeIds(alreadyEarnedIds).filter((id) => !fresh.has(id));
}

export function capUnlockQueue<T>(items: T[], cap = UNLOCK_ANIMATE_CAP) {
  const shown = items.slice(0, cap);
  return { shown, extra: Math.max(0, items.length - shown.length) };
}

export function unlockMoreLine(extra: number) {
  if (extra <= 0) return "";
  return extra === 1 ? "and 1 more" : `and ${extra} more`;
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
