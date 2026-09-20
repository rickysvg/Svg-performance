import Image from "next/image";

type LogoProps = {
  className?: string;
  priority?: boolean;
  size?: "sm" | "md" | "lg";
};

const SIZES = {
  sm: { width: 92, height: 37, src: "/logo-mark.svg" },
  md: { width: 200, height: 144, src: "/logo.svg" },
  lg: { width: 280, height: 202, src: "/logo.svg" },
};

export function Logo({ className = "", priority = false, size = "md" }: LogoProps) {
  const { width, height, src } = SIZES[size];
  return (
    <Image
      src={src}
      alt="SVG MMA Academy"
      width={width}
      height={height}
      priority={priority}
      className={className}
    />
  );
}
