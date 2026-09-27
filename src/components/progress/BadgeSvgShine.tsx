import type { ReactNode } from "react";

/** Soft metallic sweep, always clipped to the badge silhouette. */
export function BadgeSvgShine({
  uid,
  clip,
}: {
  uid: string;
  clip: ReactNode;
}) {
  const clipId = `badge-clip-${uid}`;
  const gradId = `badge-sweep-${uid}`;
  return (
    <>
      <clipPath id={clipId}>{clip}</clipPath>
      <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="42%" stopColor="#ffffff" stopOpacity="0.16" />
        <stop offset="50%" stopColor="#ffffff" stopOpacity="0.28" />
        <stop offset="58%" stopColor="#ffffff" stopOpacity="0.16" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
      <g clipPath={`url(#${clipId})`} className="badge-svg-shine-layer">
        <rect
          className="badge-svg-shine"
          x="-50"
          y="-8"
          width="46"
          height="96"
          fill={`url(#${gradId})`}
        />
      </g>
    </>
  );
}
