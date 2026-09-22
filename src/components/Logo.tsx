type LogoVariant = "mark" | "lockup";
type LogoSize = "sm" | "md" | "lg";

type LogoProps = {
  className?: string;
  priority?: boolean;
  size?: LogoSize;
  variant?: LogoVariant;
};

/**
 * Official SVG Performance art only (Ricky's lockup PNG).
 * mark = mountains + lime star (no SVG letters, no PERFORMANCE bar).
 * lockup = full official transparent lockup for the landing hero.
 * Does not use the old MMA Academy SVGs.
 */
const ASSETS: Record<LogoVariant, { src: string; aspect: number }> = {
  mark: { src: "/svg-performance-mark.png", aspect: 881 / 224 },
  lockup: { src: "/svg-performance-lockup.png", aspect: 1058 / 570 },
};

const HEIGHTS: Record<LogoVariant, Record<LogoSize, number>> = {
  mark: { sm: 32, md: 44, lg: 64 },
  lockup: { sm: 110, md: 160, lg: 188 },
};

export function Logo({
  className = "",
  priority = false,
  size = "md",
  variant = "lockup",
}: LogoProps) {
  const { src, aspect } = ASSETS[variant];
  const height = HEIGHTS[variant][size];
  const width = Math.round(height * aspect);
  return (
    // Official PNG — unoptimized so Next does not rasterize a muddy square.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="SVG Performance"
      width={width}
      height={height}
      fetchPriority={priority ? "high" : "auto"}
      className={`object-contain ${className}`.trim()}
    />
  );
}
