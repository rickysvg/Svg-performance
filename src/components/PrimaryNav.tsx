"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isPrimaryNavActive, PRIMARY_NAV_LINKS } from "@/lib/member-nav";

export function PrimaryNav({ coachLocked = false }: { coachLocked?: boolean }) {
  const current = usePathname();
  return (
    <nav
      aria-label="Main"
      className="hc-carbon sticky top-0 z-20 hidden border-b border-[#cbf805]/45 pt-[env(safe-area-inset-top)] md:block"
    >
      <ul className="mx-auto grid max-w-3xl grid-cols-5 px-1">
        {PRIMARY_NAV_LINKS.map((link) => {
          const active = isPrimaryNavActive(current, link.href);
          const locked = coachLocked && link.href === "/coach";
          return (
            <li key={link.href} className="px-0.5 py-1.5">
              <Link
                href={link.href}
                data-coach-nav-locked={locked ? "1" : undefined}
                className={`font-telemetry touch-target flex flex-col items-center justify-center border-b-2 px-1 text-[11px] uppercase leading-tight tracking-[0.16em] whitespace-nowrap ${
                  active ? "border-[#CBF805] text-[#CBF805]" : "border-transparent text-muted hover:text-foreground"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
                {locked ? (
                  <span className="mt-0.5 text-[9px] font-semibold normal-case tracking-normal text-[#CBF805]">
                    Pro
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
