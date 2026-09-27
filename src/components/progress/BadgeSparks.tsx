"use client";

import { useEffect } from "react";
import { CelebrationFx, preloadFxSheets } from "@/components/progress/SpriteFx";

export function BadgeSparks({
  active,
  delayMs = 700,
}: {
  active: boolean;
  delayMs?: number;
  durationMs?: number;
}) {
  useEffect(() => {
    if (active) void preloadFxSheets();
  }, [active]);

  return <CelebrationFx active={active} delayMs={delayMs} size={720} />;
}
