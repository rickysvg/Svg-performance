"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isPrimaryNavActive, PRIMARY_NAV_LINKS } from "@/lib/member-nav";

export function PrimaryNav() {
  const current = usePathname();
  return (
    <nav
      aria-label="Main"
      className="sticky top-0 z-20 border-b border-line bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-3xl grid-cols-5">
        {PRIMARY_NAV_LINKS.map((link) => {
          const active = isPrimaryNavActive(current, link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`touch-target relative flex flex-col items-center justify-center px-1 py-2.5 text-[12px] leading-tight whitespace-nowrap ${
                  active
                    ? "bg-accent/10 font-semibold text-accent"
                    : "text-muted hover:text-foreground"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
                {active ? (
                  <span
                    className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent"
                    aria-hidden
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
