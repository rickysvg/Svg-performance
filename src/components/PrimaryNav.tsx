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
      <ul className="mx-auto grid max-w-3xl grid-cols-5 px-1">
        {PRIMARY_NAV_LINKS.map((link) => {
          const active = isPrimaryNavActive(current, link.href);
          return (
            <li key={link.href} className="px-0.5 py-1.5">
              <Link
                href={link.href}
                className={`font-display touch-target flex flex-col items-center justify-center rounded-full px-1 text-[12px] uppercase leading-tight tracking-[0.08em] whitespace-nowrap ${
                  active
                    ? "bg-accent font-semibold text-black"
                    : "text-muted hover:text-foreground"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
