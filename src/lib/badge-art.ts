import type { BadgeCategoryId, BadgeId } from "@/lib/badges";
import type { LoadUnit } from "@/lib/units";

/** Art filename stem. Lift IDs stay lift_100kg / lift_200kg in the repo. */
export function badgeArtId(id: BadgeId, unit: LoadUnit = "lb") {
  if (id === "lift_100kg") return unit === "kg" ? "lift_100kg" : "lift_225lb";
  if (id === "lift_200kg") return unit === "kg" ? "lift_200kg" : "lift_405lb";
  return id;
}

export function badgeArtSrc(
  id: BadgeId,
  unit: LoadUnit = "lb",
  variant: "progress" | "locked" | "hero" = "progress",
) {
  const stem = badgeArtId(id, unit);
  if (variant === "locked") return `/badges/${stem}_locked.webp`;
  if (variant === "hero") return `/badges/${stem}_hero.webp`;
  return `/badges/${stem}.webp`;
}

export const SFX_BY_CATEGORY: Record<BadgeCategoryId, string> = {
  lifting: "/sfx/lifting.mp3",
  cardio: "/sfx/cardio.mp3",
  martial: "/sfx/martial.mp3",
  grind: "/sfx/grind.mp3",
};
