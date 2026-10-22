import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { logoutAction } from "@/app/actions/auth";
import {
  BOTTOM_DOCK_LEFT,
  BOTTOM_DOCK_RIGHT,
  isAccountNavActive,
} from "@/lib/member-nav";

function chipClass(active = false, compact = false) {
  return `inline-flex shrink-0 items-center justify-center border font-telemetry uppercase tracking-[0.14em] ${
    compact ? "h-8 px-2.5 text-[10px]" : "h-9 px-3 text-[11px]"
  } ${
    active
      ? "border-[#CBF805] bg-[#CBF805] text-black"
      : "border-[#2a3124] bg-[#101216] text-foreground hover:border-[#CBF805]"
  }`;
}

function BookIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden className="block">
      <rect x="3" y="2.5" width="10" height="11" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 5.5h4M6 8h4M6 10.5h2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ShopIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden className="block">
      <path
        d="M3.5 6.5h9l-.7 6.2a1.2 1.2 0 0 1-1.2 1.1H5.4a1.2 1.2 0 0 1-1.2-1.1L3.5 6.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M5.5 6.5V5a2.5 2.5 0 0 1 5 0v1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ProgressIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden className="block">
      <path d="M3 12V9.5M7 12V6.5M11 12V4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden className="block">
      <circle cx="8" cy="5.5" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 13c.6-2.4 2.2-3.5 4.5-3.5s3.9 1.1 4.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const DOCK_ICONS: Record<string, () => ReactNode> = {
  Book: BookIcon,
  Shop: ShopIcon,
  Progress: ProgressIcon,
  Profile: ProfileIcon,
};

function DockLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  const Icon = DOCK_ICONS[label];
  return (
    <Link
      href={href}
      data-dock-link={label}
      className={`flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-1 ${
        active ? "text-[#CBF805]" : "text-muted hover:text-foreground"
      }`}
      aria-current={active ? "page" : undefined}
    >
      {Icon ? <Icon /> : null}
      <span className="font-telemetry text-[9px] uppercase tracking-[0.14em]">{label}</span>
      <span
        aria-hidden
        className={`h-0.5 w-5 ${active ? "bg-[#CBF805] shadow-[0_0_8px_#CBF805]" : "bg-transparent"}`}
      />
    </Link>
  );
}

export function AppHeader({
  email,
  role,
  showAdmin = false,
  homeHref,
  hideMemberLinks = false,
  placement = "top",
  currentPath,
}: {
  email?: string;
  role?: string;
  showAdmin?: boolean;
  homeHref?: string;
  hideMemberLinks?: boolean;
  placement?: "top" | "bottom";
  currentPath?: string;
}) {
  const staff = role === "admin" || role === "coach";
  const adminLink = showAdmin || role === "admin";
  const docked = placement === "bottom";
  const path = currentPath ?? "";

  if (docked && email) {
    return (
      <header
        data-bottom-dock
        className="hc-carbon fixed inset-x-0 bottom-0 z-20 border-t border-[#cbf805]/55 pb-[env(safe-area-inset-bottom)] shadow-[0_-16px_36px_rgba(0,0,0,0.55)]"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#CBF805] to-transparent"
        />
        {!hideMemberLinks && (adminLink || staff) ? (
          <div className="mx-auto flex max-w-3xl justify-end gap-1.5 px-3 pt-2">
            {adminLink ? (
              <Link href="/admin" className={chipClass(isAccountNavActive(path, "/admin"), true)}>
                Admin
              </Link>
            ) : null}
            {staff ? (
              <Link
                href="/staff/reports"
                className={chipClass(isAccountNavActive(path, "/staff/reports"), true)}
              >
                Staff
              </Link>
            ) : null}
          </div>
        ) : null}
        <div className="mx-auto flex max-w-3xl items-center gap-1 py-1.5 pl-2 pr-[4.75rem]">
          <Link
            href={homeHref ?? "/home"}
            className="flex shrink-0 items-center justify-center px-1"
          >
            <Logo variant="mark" size="sm" />
          </Link>
          <nav
            aria-label="Account"
            className="grid min-w-0 flex-1 grid-cols-3 items-end"
          >
            {BOTTOM_DOCK_LEFT.map((link) => (
              <DockLink
                key={link.href}
                href={link.href}
                label={link.label}
                active={isAccountNavActive(path, link.href)}
              />
            ))}
            {BOTTOM_DOCK_RIGHT.map((link) => (
              <DockLink
                key={link.href}
                href={link.href}
                label={link.label}
                active={isAccountNavActive(path, link.href)}
              />
            ))}
          </nav>
        </div>
      </header>
    );
  }

  return (
    <header
      className={
        docked
          ? "sticky bottom-0 z-20 border-t border-line bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
          : "sticky top-0 z-20 border-b border-line bg-background/95 backdrop-blur"
      }
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-2">
        <Link
          href={homeHref ?? (email ? "/home" : "/")}
          className="flex min-w-0 shrink-0 items-center gap-2.5"
        >
          <Logo variant="mark" size={docked ? "sm" : "md"} />
          <span className="hidden truncate text-sm font-semibold tracking-tight text-foreground sm:inline">
            SVG Performance
          </span>
        </Link>
        {email ? (
          <nav
            aria-label="Account"
            className="flex min-w-0 flex-nowrap items-center justify-end gap-1.5"
          >
            {!hideMemberLinks && adminLink ? (
              <Link
                href="/admin"
                className={chipClass(isAccountNavActive(path, "/admin"), docked)}
              >
                Admin
              </Link>
            ) : null}
            {!hideMemberLinks && staff ? (
              <Link
                href="/staff/reports"
                className={chipClass(isAccountNavActive(path, "/staff/reports"), docked)}
              >
                Staff
              </Link>
            ) : null}
            {!hideMemberLinks ? (
              <>
                <Link
                  href="/book"
                  className={chipClass(isAccountNavActive(path, "/book"), docked)}
                >
                  Book
                </Link>
                <Link
                  href="/shop"
                  className={chipClass(isAccountNavActive(path, "/shop"), docked)}
                >
                  Shop
                </Link>
                <Link
                  href="/profile"
                  className={chipClass(isAccountNavActive(path, "/profile"), docked)}
                >
                  Profile
                </Link>
              </>
            ) : null}
            <form action={logoutAction} className="shrink-0">
              <button type="submit" className={chipClass(false, docked)}>
                Log out
              </button>
            </form>
          </nav>
        ) : (
          <Link href="/login" className={chipClass()}>
            Log in
          </Link>
        )}
      </div>
    </header>
  );
}
