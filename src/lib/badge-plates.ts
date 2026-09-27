import type { BadgeTier } from "@/lib/badges";

export function plateWebp(tier: BadgeTier, size: 256 | 512) {
  return `/badges/plate-${tier}-${size}.webp`;
}

export function platePng(tier: BadgeTier, size: 256 | 512) {
  return `/badges/plate-${tier}-${size}.png`;
}

export function markFontSize(mark: string, large: boolean) {
  const base = mark.length >= 4 ? 13 : mark.length === 3 ? 16 : mark.length === 2 ? 22 : 28;
  return large ? Math.round(base * 2.55) : base;
}
