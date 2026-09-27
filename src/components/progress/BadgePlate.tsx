import type { EarnedBadge } from "@/lib/badges";
import { markFontSize, platePng, plateWebp } from "@/lib/badge-plates";

export function BadgePlate({
  badge,
  large = false,
  shine = false,
}: {
  badge: EarnedBadge;
  large?: boolean;
  shine?: boolean;
}) {
  const size = large ? 512 : 256;
  const font = markFontSize(badge.mark, large);
  return (
    <div
      className={`badge-plate relative mx-auto ${large ? "badge-plate-lg" : "badge-plate-sm"} ${
        badge.earned ? "" : "badge-plate-locked"
      }`}
    >
      <picture>
        <source type="image/webp" srcSet={plateWebp(badge.tier, size)} />
        <img
          src={platePng(badge.tier, size)}
          alt=""
          width={large ? 240 : 80}
          height={large ? 218 : 73}
          className="badge-plate-img relative z-0 h-auto w-full"
          draggable={false}
        />
      </picture>
      <span
        className="badge-plate-mark font-display pointer-events-none absolute left-1/2 top-[49%] z-[1] -translate-x-1/2 -translate-y-1/2 uppercase"
        style={{ fontSize: font }}
      >
        {badge.mark}
      </span>
      {badge.earned ? null : (
        <span className="badge-plate-progress font-display pointer-events-none absolute left-1/2 top-[64%] z-[1] -translate-x-1/2">
          {badge.progressLabel}
        </span>
      )}
      {shine ? (
        <span
          className="badge-plate-shine"
          style={{
            WebkitMaskImage: `url(${plateWebp(badge.tier, size)})`,
            maskImage: `url(${plateWebp(badge.tier, size)})`,
          }}
          aria-hidden
        />
      ) : null}
    </div>
  );
}
