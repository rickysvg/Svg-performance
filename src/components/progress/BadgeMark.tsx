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
}: {
  badge: EarnedBadge;
  style?: BadgeStyleId;
}) {
  const uid = useId().replace(/:/g, "");
  return (
    <div
      className={`badge-mark relative mx-auto flex h-20 w-20 items-center justify-center ${
        badge.earned ? "badge-earned" : "badge-locked"
      }`}
    >
      {style === "belt" ? <BadgeBelt badge={badge} uid={uid} /> : null}
      {style === "hex" ? <BadgeHex badge={badge} uid={uid} /> : null}
      {style === "medal" ? <BadgeMedal badge={badge} uid={uid} /> : null}
      {badge.earned ? <span className="badge-shine" aria-hidden /> : null}
    </div>
  );
}
