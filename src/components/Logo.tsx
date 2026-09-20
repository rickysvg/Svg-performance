import Image from "next/image";

type LogoProps = {
  className?: string;
  priority?: boolean;
  size?: "sm" | "md" | "lg";
};

const SIZES = {
  sm: { width: 120, height: 82 },
  md: { width: 180, height: 124 },
  lg: { width: 260, height: 179 },
};

export function Logo({ className = "", priority = false, size = "md" }: LogoProps) {
  const { width, height } = SIZES[size];
  return (
    <Image
      src="/logo.svg"
      alt="SVG MMA Academy"
      width={width}
      height={height}
      priority={priority}
      className={className}
    />
  );
}
