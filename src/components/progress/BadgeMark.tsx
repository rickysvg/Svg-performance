"use client";

import { useId } from "react";
import type { EarnedBadge } from "@/lib/badges";
import { BADGE_STYLE, type BadgeStyleId } from "@/lib/badge-style";
import { BadgeBelt } from "@/components/progress/BadgeBelt";
import { BadgeHex } from "@/components/progress/BadgeHex";
import { BadgeMedal } from "@/components/progress/BadgeMedal";

export function BadgeMark({
  badge,
  style = BADGE_STYLE,
  motion = true,
  large = false,
  shine = false,
}: {
  badge: EarnedBadge;
  style?: BadgeStyleId;
  motion?: boolean;
  large?: boolean;
  shine?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const size = large ? 200 : style === "hex" ? 80 : 72;
  return (
    <div
      className={`badge-mark relative mx-auto flex items-center justify-center overflow-visible ${
        large ? "h-[200px] w-[200px]" : "h-20 w-20"
      } ${badge.earned && motion ? "badge-earned" : ""} ${badge.earned ? "" : "badge-locked"}`}
    >
      {style === "belt" ? <BadgeBelt badge={badge} uid={uid} shine={shine} size={size} /> : null}
      {style === "hex" ? <BadgeHex badge={badge} uid={uid} shine={shine} size={size} /> : null}
      {style === "medal" ? <BadgeMedal badge={badge} uid={uid} shine={shine} size={size} /> : null}
      {badge.earned && motion ? <span className="badge-shine" aria-hidden /> : null}
    </div>
  );
}
