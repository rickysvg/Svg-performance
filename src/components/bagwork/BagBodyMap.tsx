"use client";

import Image from "next/image";
import { BAG_REGION_LABELS, formatBagRegions, type BagRegion, type BagSide } from "@/lib/bag-body";
import { focusGlows, glowCaption, regionTapSpots, type BodyGlow } from "@/lib/bag-glow";

const ATHLETE = "/bagwork/athlete-front.webp";

function Glow({ spot }: { spot: BodyGlow }) {
  return (
    <span
      aria-hidden
      data-body-glow={spot.id}
      className="pointer-events-none absolute aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{
        left: `${spot.x}%`,
        top: `${spot.y}%`,
        width: `${spot.size}%`,
        background:
          "radial-gradient(circle, rgba(203,248,5,0.92) 0%, rgba(203,248,5,0.48) 32%, rgba(203,248,5,0.16) 58%, rgba(203,248,5,0) 74%)",
        mixBlendMode: "screen",
      }}
    />
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
          <Image
            src={ATHLETE}
            alt={caption ? `Athlete facing forward. ${emphasis}` : "Athlete facing forward on a black background."}
            width={720}
            height={1280}
            className="block h-auto w-full"
            sizes="(max-width: 390px) 92vw, 420px"
          />
          <div className="pointer-events-none absolute inset-0" data-body-glows>
            {glows.map((spot) => (
              <Glow key={spot.id} spot={spot} />
            ))}
          </div>
          {interactive
            ? regionTapSpots(side).map((spot) => {
                const region = spot.region;
                if (!region) return null;
                const lit = regions.includes(region);
                return (
                  <button
                    key={spot.id}
                    type="button"
                    data-region={region}
                    data-lit={lit ? "true" : "false"}
                    aria-pressed={lit}
                    aria-label={BAG_REGION_LABELS[region]}
                    onClick={() => onToggle?.(region)}
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
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
