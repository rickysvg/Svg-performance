type LogoVariant = "mark" | "lockup";
type LogoSize = "sm" | "md" | "lg";

type LogoProps = {
  className?: string;
  priority?: boolean;
  size?: LogoSize;
  variant?: LogoVariant;
};

/**
 * Official SVG Performance art only.
 * mark = mountain + neon star + SVG (header).
 * lockup = full official lockup including the PERFORMANCE bar (hero).
 * Neither uses the old MMA Academy SVGs.
 */
const ASSETS: Record<
  LogoVariant,
  { src: string; aspect: number }
> = {
  mark: { src: "/svg-performance-mark.svg", aspect: 880 / 620 },
  lockup: { src: "/svg-performance-lockup.svg", aspect: 880 / 800 },
};

const HEIGHTS: Record<LogoVariant, Record<LogoSize, number>> = {
  mark: { sm: 36, md: 56, lg: 88 },
  lockup: { sm: 96, md: 160, lg: 220 },
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
    // SVG lockup/mark — unoptimized so Next does not rasterize a muddy square.
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
