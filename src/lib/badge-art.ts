import type { BadgeId } from "@/lib/badges";
import { isLiftLadderId } from "@/lib/badges";
import type { LoadUnit } from "@/lib/units";

/** Art filename stem. Lift rungs use _lb (app is pounds-only in the UI). */
export function badgeArtId(id: BadgeId, unit: LoadUnit = "lb") {
  if (isLiftLadderId(id)) return `${id}_${unit === "kg" ? "lb" : unit}`;
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
