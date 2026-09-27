import type { BadgeDef } from "@/lib/badges";

export function BadgeIcon({
  icon,
  earned,
}: {
  icon: BadgeDef["icon"];
  earned: boolean;
}) {
  const fill = earned ? "#0a0a0a" : "#f4f5ee";
  const stroke = earned ? "#CBF805" : "#d6d8cc";
  const mark = earned ? "#CBF805" : "#9aa08f";
  return (
    <svg viewBox="0 0 64 64" width="56" height="56" aria-hidden className="block">
      <polygon
        points="32,4 40,16 54,16 44,28 48,42 32,34 16,42 20,28 10,16 24,16"
        fill={fill}
        stroke={stroke}
        strokeWidth="2"
      />
      {icon === "star" ? (
        <polygon points="32,22 34.5,28 41,28 36,32 38,38 32,34.5 26,38 28,32 23,28 29.5,28" fill={mark} />
      ) : null}
      {icon === "flame" ? (
        <path d="M32 40c6 0 9-5 9-10 0-6-5-10-5-14 4 3 8 9 8 15 0 8-5 13-12 13s-12-5-12-13c0-4 2-8 5-11 0 4 2 8 2 11 0 4 2 9 5 9z" fill={mark} />
      ) : null}
      {icon === "bike" ? (
        <>
          <circle cx="22" cy="36" r="7" fill="none" stroke={mark} strokeWidth="2.4" />
          <circle cx="42" cy="36" r="7" fill="none" stroke={mark} strokeWidth="2.4" />
          <path d="M22 36h10l6-10h6M32 36l6-10" fill="none" stroke={mark} strokeWidth="2.2" />
        </>
      ) : null}
      {icon === "barbell" || icon === "heavy" ? (
        <path d="M16 32h32M18 26v12M46 26v12M14 29v6M50 29v6" fill="none" stroke={mark} strokeWidth="2.4" strokeLinecap="round" />
      ) : null}
      {icon === "pads" ? (
        <circle cx="32" cy="30" r="8" fill="none" stroke={mark} strokeWidth="2.4" />
      ) : null}
      {icon === "hold" ? (
        <path d="M32 22v16M26 28h12" fill="none" stroke={mark} strokeWidth="2.4" strokeLinecap="round" />
      ) : null}
      {icon === "lock" || !earned ? (
        icon === "lock" ? (
          <>
            <rect x="24" y="30" width="16" height="12" rx="2" fill="none" stroke={mark} strokeWidth="2" />
            <path d="M28 30v-4a4 4 0 0 1 8 0v4" fill="none" stroke={mark} strokeWidth="2" />
          </>
        ) : null
      ) : null}
    </svg>
  );
}
