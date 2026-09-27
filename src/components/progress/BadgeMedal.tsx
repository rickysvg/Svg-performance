import type { EarnedBadge } from "@/lib/badges";
import {
  faceFill,
  markFill,
  markFontSize,
  metalFor,
  type BadgeVisualProps,
} from "@/components/progress/badge-visuals";

function AntonMark({
  x,
  y,
  badge,
  size,
}: {
  x: number;
  y: number;
  badge: EarnedBadge;
  size?: number;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      fill={markFill(badge)}
      fontSize={size ?? markFontSize(badge.mark)}
      fontWeight={400}
      fontFamily="var(--font-anton), Anton, Impact, 'Arial Narrow', sans-serif"
      letterSpacing="0.02em"
      style={{ fontSynthesis: "none" }}
    >
      {badge.mark}
    </text>
  );
}

export function BadgeMedal({ badge, uid }: BadgeVisualProps) {
  const metal = metalFor(badge);
  const rim = `medal-rim-${uid}`;
  const bevel = `medal-bevel-${uid}`;
  const gloss = `medal-gloss-${uid}`;
  return (
    <svg viewBox="0 0 80 80" width="72" height="72" aria-hidden className="block">
      <defs>
        <linearGradient id={rim} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={metal.light} />
          <stop offset="38%" stopColor={metal.mid} />
          <stop offset="62%" stopColor={metal.dark} />
          <stop offset="100%" stopColor={metal.light} />
        </linearGradient>
        <radialGradient id={bevel} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor={metal.shine} stopOpacity="0.85" />
          <stop offset="45%" stopColor={metal.mid} />
          <stop offset="100%" stopColor={metal.dark} />
        </radialGradient>
        <linearGradient id={gloss} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="40" cy="40" r="37" fill={`url(#${bevel})`} />
      <circle cx="40" cy="40" r="33.5" fill="none" stroke={`url(#${rim})`} strokeWidth="5" />
      <circle cx="40" cy="40" r="30.5" fill="none" stroke={metal.dark} strokeWidth="1.2" />
      <circle cx="40" cy="40" r="27" fill={faceFill(badge)} />
      <circle
        cx="40"
        cy="40"
        r="27"
        fill="none"
        stroke={badge.earned ? "#CBF805" : metal.mid}
        strokeWidth="1.4"
        opacity={badge.earned ? 0.85 : 0.45}
      />
      <ellipse cx="30" cy="26" rx="16" ry="9" fill={`url(#${gloss})`} />
      <AntonMark x={40} y={badge.earned ? 40 : 36} badge={badge} />
      {badge.earned ? null : (
        <text
          x="40"
          y="54"
          textAnchor="middle"
          fill="#5c6156"
          fontSize="8"
          fontFamily="var(--font-anton), Anton, Impact, sans-serif"
          style={{ fontSynthesis: "none" }}
        >
          {badge.progressLabel}
        </text>
      )}
    </svg>
  );
}
