import {
  faceFill,
  markFill,
  markFontSize,
  metalFor,
  type BadgeVisualProps,
} from "@/components/progress/badge-visuals";

const PLATE =
  "M14,40 L20,20 L30,13 L50,13 L60,20 L66,40 L60,60 L50,67 L30,67 L20,60 Z";

export function BadgeBelt({ badge, uid }: BadgeVisualProps) {
  const metal = metalFor(badge);
  const plate = `belt-plate-${uid}`;
  const gloss = `belt-gloss-${uid}`;
  return (
    <svg viewBox="0 0 80 80" width="72" height="72" aria-hidden className="block">
      <defs>
        <linearGradient id={plate} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={metal.light} />
          <stop offset="35%" stopColor={metal.mid} />
          <stop offset="70%" stopColor={metal.dark} />
          <stop offset="100%" stopColor={metal.light} />
        </linearGradient>
        <linearGradient id={gloss} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M2,28 L13,22 L13,58 L2,52 Z" fill={`url(#${plate})`} stroke={metal.dark} strokeWidth="1" />
      <path d="M78,28 L67,22 L67,58 L78,52 Z" fill={`url(#${plate})`} stroke={metal.dark} strokeWidth="1" />
      <circle cx="7" cy="40" r="2.2" fill={metal.light} />
      <circle cx="73" cy="40" r="2.2" fill={metal.light} />
      <path d={PLATE} fill={`url(#${plate})`} stroke={metal.dark} strokeWidth="1.6" />
      <path
        d="M22,40 L27,23 L40,18 L53,23 L58,40 L53,57 L40,62 L27,57 Z"
        fill={faceFill(badge)}
        stroke={metal.dark}
        strokeWidth="1.2"
      />
      <path
        d="M24,28 C32,22 48,22 56,28"
        fill="none"
        stroke={`url(#${gloss})`}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <text
        x="40"
        y={badge.earned ? 41 : 37}
        textAnchor="middle"
        dominantBaseline="central"
        fill={markFill(badge)}
        fontSize={markFontSize(badge.mark)}
        fontWeight={400}
        fontFamily="var(--font-anton), Anton, Impact, 'Arial Narrow', sans-serif"
        letterSpacing="0.02em"
        style={{ fontSynthesis: "none" }}
      >
        {badge.mark}
      </text>
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
