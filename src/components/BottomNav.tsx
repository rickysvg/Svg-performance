"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/home", label: "Home" },
  { href: "/training", label: "Train" },
  { href: "/nutrition", label: "Fuel" },
  { href: "/learn", label: "Learn" },
  { href: "/coach", label: "Coach" },
];

export function BottomNav() {
  const current = usePathname();
  return (
    <nav
      aria-label="Main"
      className="sticky bottom-0 z-20 border-t border-line bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-3xl grid-cols-5">
        {LINKS.map((link) => {
          const active =
            link.href === "/home"
              ? current === "/home"
              : current === link.href || current.startsWith(`${link.href}/`);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`touch-target flex flex-col items-center justify-center px-1 py-2 text-[11px] leading-tight whitespace-nowrap ${
                  active ? "font-semibold text-accent" : "text-muted"
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
