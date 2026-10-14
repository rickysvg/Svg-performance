"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { coachFabBottomClass, shouldHideCoachFab } from "@/lib/coaches";

export function CoachFabLink({
  name,
  thumbSrc,
  className,
}: {
  name: string;
  thumbSrc: string;
  className: string;
}) {
  return (
    <Link
      href="/coach"
      data-coach-fab
      data-coach-name={name}
      aria-label={`Open SVG Coach with ${name}`}
      className={className}
    >
      <img src={thumbSrc} alt="" width={48} height={48} className="h-full w-full object-cover" />
    </Link>
  );
}

export function CoachFab({
  name,
  thumbSrc,
  staffDock = false,
}: {
  name: string;
  thumbSrc: string;
  staffDock?: boolean;
}) {
  const pathname = usePathname() || "/";
  if (shouldHideCoachFab(pathname)) return null;

  return (
    <CoachFabLink
      name={name}
      thumbSrc={thumbSrc}
      className={`fixed z-30 h-12 w-12 overflow-hidden rounded-full bg-black shadow-md ring-2 ring-accent left-[max(0.75rem,env(safe-area-inset-left))] ${coachFabBottomClass(pathname, { staffDock })}`}
    />
  );
}
