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
}: {
  badge: EarnedBadge;
  style?: BadgeStyleId;
  motion?: boolean;
  large?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  return (
    <div
      className={`badge-mark relative mx-auto flex items-center justify-center ${
        large ? "h-40 w-40" : "h-20 w-20"
      } ${badge.earned && motion ? "badge-earned" : ""} ${badge.earned ? "" : "badge-locked"}`}
    >
      <div className={large ? "scale-[2.05]" : undefined}>
        {style === "belt" ? <BadgeBelt badge={badge} uid={uid} /> : null}
        {style === "hex" ? <BadgeHex badge={badge} uid={uid} /> : null}
        {style === "medal" ? <BadgeMedal badge={badge} uid={uid} /> : null}
      </div>
      {badge.earned && motion ? <span className="badge-shine" aria-hidden /> : null}
    </div>
  );
}
