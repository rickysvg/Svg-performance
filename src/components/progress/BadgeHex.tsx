import {
  HEX_POINTS,
  HEX_RIBBON,
  markFill,
  markFontSize,
  metalFor,
  type BadgeVisualProps,
} from "@/components/progress/badge-visuals";
import { BadgeSvgShine } from "@/components/progress/BadgeSvgShine";

export function BadgeHex({ badge, uid, shine, size = 80 }: BadgeVisualProps) {
  const metal = metalFor(badge);
  const stitch = badge.earned ? (badge.tier === "lime" ? "#0a0a0a" : "#CBF805") : metal.mid;
  const face = badge.earned
    ? badge.tier === "lime"
      ? "#CBF805"
      : badge.tier === "gold"
        ? metal.mid
        : "#0a0a0a"
    : "#d8dacf";
  const markColor =
    badge.earned && (badge.tier === "gold" || badge.tier === "lime") ? "#0a0a0a" : markFill(badge);
  const width = Math.round((size * 64) / 80);

  return (
    <svg viewBox="0 0 64 80" width={width} height={size} aria-hidden className="mx-auto block">
      <defs>
        <linearGradient id={`hex-rim-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={metal.light} />
          <stop offset="100%" stopColor={metal.dark} />
        </linearGradient>
      </defs>
      <polygon
        points={HEX_POINTS}
        fill={face}
        stroke={`url(#hex-rim-${uid})`}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <polygon
        points={HEX_POINTS}
        fill="none"
        stroke={stitch}
        strokeWidth="1.6"
        strokeDasharray="3 2"
        opacity="0.9"
      />
      <text
        x="32"
        y="32"
        textAnchor="middle"
        dominantBaseline="central"
        fill={markColor}
        fontSize={markFontSize(badge.mark) + 1}
        fontWeight={400}
        fontFamily="var(--font-anton), Anton, Impact, 'Arial Narrow', sans-serif"
        letterSpacing="0.02em"
        style={{ fontSynthesis: "none" }}
      >
        {badge.mark}
      </text>
      <path d={HEX_RIBBON} fill={badge.earned ? "#0a0a0a" : "#9aa08f"} />
      <text
        x="32"
        y="73.2"
        textAnchor="middle"
        dominantBaseline="central"
        fill={badge.earned ? "#CBF805" : "#f4f5ee"}
        fontSize="7"
        fontFamily="var(--font-anton), Anton, Impact, sans-serif"
        style={{ fontSynthesis: "none" }}
      >
        {badge.earned ? badge.ribbon.toUpperCase() : badge.progressLabel}
      </text>
      {shine ? (
        <BadgeSvgShine
          uid={uid}
          clip={
            <>
              <polygon points={HEX_POINTS} />
              <path d={HEX_RIBBON} />
            </>
          }
        />
      ) : null}
    </svg>
  );
}
