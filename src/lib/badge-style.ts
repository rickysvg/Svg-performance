export const BADGE_STYLES = ["medal", "belt", "hex"] as const;
export type BadgeStyleId = (typeof BADGE_STYLES)[number];

/**
 * Ricky picks one. Keep all three components until then, then delete the rest.
 * Override in the URL with ?badgeStyle=medal|belt|hex for side-by-side shots.
 */
export const BADGE_STYLE: BadgeStyleId = "medal";

export const BADGE_STYLE_LABEL: Record<BadgeStyleId, string> = {
  medal: "Medal",
  belt: "Belt plate",
  hex: "Hex patch",
};

export function isBadgeStyle(value: string | null | undefined): value is BadgeStyleId {
  return BADGE_STYLES.includes(value as BadgeStyleId);
}

export function resolveBadgeStyle(override?: string | null): BadgeStyleId {
  return isBadgeStyle(override) ? override : BADGE_STYLE;
}
