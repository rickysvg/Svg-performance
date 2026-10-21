"use client";

import {
  BAG_REGION_LABELS,
  HEAD_PATH,
  SILHOUETTE,
  figureParts,
  formatBagRegions,
  partIsLit,
  type BagRegion,
  type BagSide,
  type FigureView,
} from "@/lib/bag-body";

const VIEWS: FigureView[] = ["front", "back"];

export function BagBodyMap({
  regions,
  side = "both",
  interactive = false,
  onToggle,
}: {
  regions: readonly BagRegion[];
  side?: BagSide;
  interactive?: boolean;
  onToggle?: (region: BagRegion) => void;
}) {
  const label = formatBagRegions(regions);
  return (
    <figure className="space-y-3" data-body-map data-body-side={side}>
      <div className="grid grid-cols-2 gap-2">
        {VIEWS.map((view) => (
          <div key={view} className="hc-carbon overflow-hidden rounded-2xl px-1 py-2" data-body-view={view}>
            <svg viewBox="0 0 200 452" className="mx-auto h-auto w-full max-w-[11rem]" role="img" aria-label={`${view} body`}>
              <path d={HEAD_PATH} fill="#16181c" stroke="none" />
              {figureParts(view).map((part) => {
                const lit = partIsLit(part, regions, side);
                const name = BAG_REGION_LABELS[part.region];
                return (
                  <path
                    key={part.id}
                    d={part.d}
                    data-region={part.region}
                    data-side={part.side}
                    data-lit={lit ? "true" : "false"}
                    fill={lit ? "#CBF805" : "transparent"}
                    stroke={lit ? "#101208" : "none"}
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                    className={interactive ? "cursor-pointer" : undefined}
                    role={interactive ? "button" : undefined}
                    tabIndex={interactive ? 0 : undefined}
                    aria-pressed={interactive ? regions.includes(part.region) : undefined}
                    aria-label={interactive ? name : undefined}
                    onClick={
                      interactive
                        ? () => {
                            onToggle?.(part.region);
                          }
                        : undefined
                    }
                    onKeyDown={
                      interactive
                        ? (event) => {
                            if (event.key !== "Enter" && event.key !== " ") return;
                            event.preventDefault();
                            onToggle?.(part.region);
                          }
                        : undefined
                    }
                  />
                );
              })}
              <path d={HEAD_PATH} fill="none" stroke="#d5d5d5" strokeWidth="1.75" />
              <path d={SILHOUETTE[view]} fill="none" stroke="#c8c8c8" strokeWidth="1.75" strokeLinejoin="round" />
            </svg>
            <figcaption className="font-display text-center text-[11px] uppercase tracking-wide text-white/70">
              {view}
            </figcaption>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted" data-body-emphasis>
        {label ? `Emphasizes ${label}.` : interactive ? "Tap a region to highlight it." : "No regions highlighted."}
      </p>
    </figure>
  );
}
