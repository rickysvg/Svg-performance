type LogoVariant = "mark" | "lockup" | "badge";
type LogoSize = "xs" | "sm" | "md" | "lg";

type LogoProps = {
  className?: string;
  priority?: boolean;
  size?: LogoSize;
  variant?: LogoVariant;
};

/**
 * Official SVG Performance circular badge (Ricky, Sep 2026).
 * badge/lockup = full neon-ring lockup for splash and landing.
 * mark = the same badge at chrome size (header / account bar / favicon source).
 */
export const LOGO_BADGE_SRC = "/svg-performance-badge.webp";
export const LOGO_MARK_SRC = "/svg-performance-badge-mark.png";

const ASSETS: Record<LogoVariant, { src: string; aspect: number }> = {
  mark: { src: LOGO_MARK_SRC, aspect: 1 },
  lockup: { src: LOGO_BADGE_SRC, aspect: 1 },
  badge: { src: LOGO_BADGE_SRC, aspect: 1 },
};

const HEIGHTS: Record<LogoVariant, Record<LogoSize, number>> = {
  mark: { xs: 28, sm: 36, md: 44, lg: 64 },
  lockup: { xs: 72, sm: 120, md: 180, lg: 236 },
  badge: { xs: 72, sm: 120, md: 180, lg: 236 },
};

export function Logo({
  className = "",
  priority = false,
  size = "md",
  variant = "badge",
}: LogoProps) {
  const { src, aspect } = ASSETS[variant];
  const height = HEIGHTS[variant][size];
  const width = Math.round(height * aspect);
  return (
    // Official raster — unoptimized so Next does not muddy the neon ring.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="SVG Performance"
      width={width}
      height={height}
      fetchPriority={priority ? "high" : "auto"}
      className={`rounded-full object-contain ${className}`.trim()}
    />
  );
}
