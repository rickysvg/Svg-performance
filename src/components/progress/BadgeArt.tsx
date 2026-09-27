import type { EarnedBadge } from "@/lib/badges";
import { badgeArtSrc } from "@/lib/badge-art";
import type { LoadUnit } from "@/lib/units";

export function BadgeArt({
  badge,
  unit = "lb",
  hero = false,
  large = false,
  chip = false,
}: {
  badge: EarnedBadge;
  unit?: LoadUnit;
  hero?: boolean;
  large?: boolean;
  chip?: boolean;
}) {
  const src = badgeArtSrc(badge.id, unit, hero ? "hero" : badge.earned ? "progress" : "locked");
  const size = hero || large ? 220 : chip ? 44 : 112;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={`badge-art-img ${hero || large ? "badge-art-lg" : chip ? "badge-art-chip" : "badge-art-sm"}`}
      draggable={false}
    />
  );
}
