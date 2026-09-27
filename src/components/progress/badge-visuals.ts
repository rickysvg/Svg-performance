import type { BadgeTier, EarnedBadge } from "@/lib/badges";
import type { BadgeStyleId } from "@/lib/badge-style";

export type BadgeVisualProps = {
  badge: EarnedBadge;
  uid: string;
  shine?: boolean;
  size?: number;
};

export const BELT_PLATE =
  "M14,40 L20,20 L30,13 L50,13 L60,20 L66,40 L60,60 L50,67 L30,67 L20,60 Z";
export const HEX_POINTS = "32,7 56,19 56,45 32,57 8,45 8,19";
export const HEX_RIBBON =
  "M10,66 h44 a4,4 0 0 1 4,4 v5 a4,4 0 0 1 -4,4 h-44 a4,4 0 0 1 -4,-4 v-5 a4,4 0 0 1 4,-4 z";

export const TIER_METAL: Record<
  BadgeTier,
  { dark: string; mid: string; light: string; shine: string }
> = {
  bronze: { dark: "#4a2e16", mid: "#b07a3c", light: "#e2b57a", shine: "#fff1d2" },
  silver: { dark: "#4d5158", mid: "#b7bcc4", light: "#f2f4f7", shine: "#ffffff" },
  gold: { dark: "#5c470c", mid: "#d4b03a", light: "#f6e08a", shine: "#fff6c8" },
  lime: { dark: "#3d4a00", mid: "#8fbf00", light: "#CBF805", shine: "#f4ffb0" },
};

export const LOCKED_METAL = {
  dark: "#6a6c66",
  mid: "#9aa08f",
  light: "#d6d8cc",
  shine: "#eef0e6",
};

export function metalFor(badge: EarnedBadge) {
  return badge.earned ? TIER_METAL[badge.tier] : LOCKED_METAL;
}

export function markFill(badge: EarnedBadge) {
  if (!badge.earned) return "#7a7e72";
  return badge.tier === "lime" ? "#0a0a0a" : "#CBF805";
}

export function faceFill(badge: EarnedBadge) {
  if (!badge.earned) return "#d8dacf";
  return badge.tier === "lime" ? "#CBF805" : "#0a0a0a";
}

export function markFontSize(mark: string) {
  if (mark.length >= 4) return 15;
  if (mark.length === 3) return 17;
  if (mark.length === 2) return 22;
  return 26;
}

export const COMPARE_BADGE_IDS = ["lift_100kg", "streak_7", "bike_50", "streak_30"] as const;

export function styleCaption(style: BadgeStyleId) {
  if (style === "medal") return "A Medal";
  if (style === "belt") return "B Belt";
  return "C Hex";
}
