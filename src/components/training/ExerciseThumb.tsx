"use client";

import { useState } from "react";
import { exerciseThumbSrc, fallbackThumbSrc } from "@/lib/exercise-media";

export function ExerciseThumb({
  name,
  size = 56,
}: {
  name: string;
  size?: number;
}) {
  const [src, setSrc] = useState(exerciseThumbSrc(name));

  return (
    // Decorative list aid — movement stills, not SVG coaching film.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      onError={() => setSrc(fallbackThumbSrc())}
      className="shrink-0 rounded-lg bg-card object-cover"
      style={{ width: size, height: size }}
    />
  );
}
