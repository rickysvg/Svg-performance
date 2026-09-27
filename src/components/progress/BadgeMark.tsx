import type { EarnedBadge } from "@/lib/badges";
import { BadgeArt } from "@/components/progress/BadgeArt";
import type { LoadUnit } from "@/lib/units";

export function BadgeMark({
  badge,
  unit = "lb",
  large = false,
  hero = false,
  motion = false,
}: {
  badge: EarnedBadge;
  unit?: LoadUnit;
  large?: boolean;
  hero?: boolean;
  motion?: boolean;
}) {
  return (
    <div
      className={`badge-mark relative mx-auto flex items-center justify-center overflow-visible ${
        large || hero ? "w-[220px]" : "w-[112px]"
      } ${badge.earned && motion ? "badge-earned" : ""}`}
    >
      <BadgeArt badge={badge} unit={unit} large={large} hero={hero} />
    </div>
  );
}
