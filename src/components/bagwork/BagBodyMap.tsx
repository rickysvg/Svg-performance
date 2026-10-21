"use client";

import { useId } from "react";
import { BAG_REGION_LABELS, formatBagRegions, type BagRegion, type BagSide } from "@/lib/bag-body";
import { focusGlows, glowCaption, regionTapSpots, type BodyGlow } from "@/lib/bag-glow";

const ATHLETE = "/bagwork/athlete-front.webp";

function BehindGlow({ glows }: { glows: readonly BodyGlow[] }) {
  const filterId = `body-rim-${useId().replace(/:/g, "")}`;
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
      viewBox="0 0 720 1280"
      preserveAspectRatio="none"
      aria-hidden
      data-body-glows
      data-glow-layer="behind"
    >
      <defs>
        <filter id={filterId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>
      {glows.map((glow) => (
        <polyline
          key={glow.id}
          data-body-glow={glow.id}
          points={glow.points.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="none"
          stroke="#CBF805"
          strokeWidth={glow.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${filterId})`}
        />
      ))}
    </svg>
  );
}

export function BagBodyMap({
  regions,
  side = "both",
  workoutKey = null,
  interactive = false,
  onToggle,
}: {
  regions: readonly BagRegion[];
  side?: BagSide;
  workoutKey?: string | null;
  interactive?: boolean;
  onToggle?: (region: BagRegion) => void;
}) {
  const glows = focusGlows(interactive ? null : workoutKey, regions, side);
  const caption = glowCaption(glows) || formatBagRegions(regions);
  const emphasis = caption
    ? `Emphasizes ${caption}.`
    : interactive
      ? "Tap a region to highlight it."
      : "No regions highlighted.";

  return (
    <figure className="space-y-3" data-body-map data-body-side={side} data-body-round={workoutKey ?? ""}>
      <div className="overflow-hidden rounded-2xl bg-[#0c0e11]">
        <div className="relative">
          <BehindGlow glows={glows} />
          {/* The cutout has to stay transparent so the rim stays behind the limbs. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ATHLETE}
            alt={caption ? `Athlete facing forward. ${emphasis}` : "Athlete facing forward on a black background."}
            width={720}
            height={1280}
            className="relative z-[1] block h-auto w-full"
          />
          {interactive
            ? regionTapSpots(side).map((spot) => {
                const lit = regions.includes(spot.region);
                return (
                  <button
                    key={spot.id}
                    type="button"
                    data-region={spot.region}
                    data-lit={lit ? "true" : "false"}
                    aria-pressed={lit}
                    aria-label={BAG_REGION_LABELS[spot.region]}
                    onClick={() => onToggle?.(spot.region)}
                    className="absolute z-[2] -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      left: `${spot.x}%`,
                      top: `${spot.y}%`,
                      width: `${Math.max(spot.size, 18)}%`,
                      aspectRatio: "1",
                    }}
                  />
                );
              })
            : null}
        </div>
      </div>
      <p className="text-sm text-muted" data-body-emphasis>
        {emphasis}
      </p>
    </figure>
  );
}
