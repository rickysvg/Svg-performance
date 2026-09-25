"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isPrimaryNavActive, PRIMARY_NAV_LINKS } from "@/lib/member-nav";

export function PrimaryNav() {
  const current = usePathname();
  return (
    <nav
      aria-label="Main"
      data-primary-nav
      className="sticky top-0 z-20 overflow-x-hidden border-b border-line bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-3xl grid-cols-6 px-0.5">
        {PRIMARY_NAV_LINKS.map((link) => {
          const active = isPrimaryNavActive(current, link.href);
          return (
            <li key={link.href} className="min-w-0 px-px py-1.5">
              <Link
                href={link.href}
                data-nav-link={link.label}
                className={`font-display flex h-11 min-w-0 items-center justify-center rounded-full px-0.5 text-[10px] uppercase leading-none tracking-[0.04em] whitespace-nowrap ${
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
