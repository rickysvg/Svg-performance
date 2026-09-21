import Image from "next/image";

type LogoProps = {
  className?: string;
  priority?: boolean;
  size?: "sm" | "md" | "lg";
};

const SRC = "/svg-performance-logo.png";

const SIZES = {
  sm: { width: 48, height: 48 },
  md: { width: 160, height: 160 },
  lg: { width: 280, height: 280 },
};

export function Logo({ className = "", priority = false, size = "md" }: LogoProps) {
  const { width, height } = SIZES[size];
  return (
    <Image
      src={SRC}
      alt="SVG Performance"
      width={width}
      height={height}
      priority={priority}
      className={`object-contain ${className}`.trim()}
    />
  );
}
