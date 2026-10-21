"use client";

import { BAG_REGION_LABELS, formatBagRegions, type BagRegion, type BagSide } from "@/lib/bag-body";
import { focusGlows, GLOW_COLOR, glowCaption, glowSrc, regionTapSpots } from "@/lib/bag-glow";

const ATHLETE = "/bagwork/athlete-front.webp";

function BehindGlow({ ids }: { ids: readonly string[] }) {
  if (!ids.length) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0"
      data-glow-layer="behind"
      data-glow-color={GLOW_COLOR}
      aria-hidden
    >
      {ids.map((id) => (
        // The layer is a blurred dilation of the limb mask. Straight alpha has to survive.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={id}
          src={glowSrc(id)}
          alt=""
          width={720}
          height={1280}
          data-body-glow={id}
          className="absolute inset-0 h-full w-full"
        />
      ))}
    </div>
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
          <BehindGlow ids={glows.map((glow) => glow.id)} />
          {/* The cutout stays transparent so the rim stays behind the limbs. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ATHLETE}
            data-athlete
            alt={caption ? `Athlete facing forward. ${emphasis}` : "Athlete facing forward on a black background."}
            width={720}
            height={1280}
            loading="eager"
            fetchPriority="high"
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
