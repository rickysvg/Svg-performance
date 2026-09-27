import { PLATE_OUTLINE_PATH, PLATE_OUTLINE_VIEWBOX } from "@/lib/plate-outline";

export function BadgeUnlockOutline({ fade }: { fade?: boolean }) {
  return (
    <svg
      className="badge-unlock-outline"
      viewBox={PLATE_OUTLINE_VIEWBOX}
      aria-hidden
    >
      <path
        className={fade ? "badge-unlock-outline-fade" : "badge-unlock-outline-stroke"}
        d={PLATE_OUTLINE_PATH}
        pathLength={1}
      />
    </svg>
  );
}
