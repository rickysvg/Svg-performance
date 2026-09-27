import { markFill, markFontSize, metalFor, type BadgeVisualProps } from "@/components/progress/badge-visuals";

const HEX = "32,7 56,19 56,45 32,57 8,45 8,19";

export function BadgeHex({ badge, uid }: BadgeVisualProps) {
  const metal = metalFor(badge);
  const fill = `hex-fill-${uid}`;
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

  return (
    <svg viewBox="0 0 64 80" width="64" height="80" aria-hidden className="mx-auto block">
      <defs>
        <linearGradient id={fill} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={metal.light} />
          <stop offset="50%" stopColor={face} />
          <stop offset="100%" stopColor={metal.dark} />
        </linearGradient>
      </defs>
      <polygon points={HEX} fill={`url(#${fill})`} stroke="#0a0a0a" strokeWidth="5" strokeLinejoin="round" />
      <polygon
        points={HEX}
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
      <path
        d="M10,66 h44 a4,4 0 0 1 4,4 v5 a4,4 0 0 1 -4,4 h-44 a4,4 0 0 1 -4,-4 v-5 a4,4 0 0 1 4,-4 z"
        fill={badge.earned ? "#0a0a0a" : "#9aa08f"}
      />
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
    </svg>
  );
}
