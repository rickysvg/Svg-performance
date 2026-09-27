"use client";

import { useId } from "react";
import type { EarnedBadge } from "@/lib/badges";
import { BadgeBelt } from "@/components/progress/BadgeBelt";

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
  const uid = useId().replace(/:/g, "");
  const size = large ? 200 : 72;
  return (
    <div
      className={`badge-mark relative mx-auto flex items-center justify-center overflow-visible ${
        large ? "h-[200px] w-[200px]" : "h-20 w-20"
      } ${badge.earned && motion ? "badge-earned" : ""} ${badge.earned ? "" : "badge-locked"}`}
    >
      <BadgeBelt badge={badge} uid={uid} shine={shine} size={size} />
    </div>
  );
}
