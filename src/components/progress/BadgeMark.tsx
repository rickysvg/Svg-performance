"use client";

import type { EarnedBadge } from "@/lib/badges";
import { BadgePlate } from "@/components/progress/BadgePlate";

export function BadgeMark({
  badge,
  motion = true,
  large = false,
  shine = false,
}: {
  badge: EarnedBadge;
  motion?: boolean;
  large?: boolean;
  shine?: boolean;
}) {
  return (
    <div
      className={`badge-mark relative mx-auto flex items-center justify-center overflow-visible ${
        large ? "w-[240px]" : "h-20 w-20"
      } ${badge.earned && motion ? "badge-earned" : ""} ${badge.earned ? "" : "badge-locked"}`}
    >
      <BadgePlate badge={badge} large={large} shine={shine} />
    </div>
  );
}
