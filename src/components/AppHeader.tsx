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
  return `inline-flex shrink-0 items-center justify-center rounded-full border ${
    compact ? "h-8 px-2.5 text-[11px]" : "h-9 px-3 text-xs"
  } ${
    active
      ? "border-black bg-accent font-semibold text-black"
      : "border-line bg-background text-foreground hover:border-black"
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
      className={`font-display flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1 uppercase leading-none tracking-[0.04em] ${
        active ? "bg-accent font-semibold text-black" : "text-muted hover:text-foreground"
      }`}
      aria-current={active ? "page" : undefined}
    >
      {Icon ? <Icon /> : null}
      <span className="text-[9px]">{label}</span>
    </Link>
  );
}

export function AppHeader({
  email,
  role,
  homeHref,
  hideMemberLinks = false,
  placement = "top",
  currentPath,
  centerAction,
}: {
  email?: string;
  role?: string;
  homeHref?: string;
  hideMemberLinks?: boolean;
  placement?: "top" | "bottom";
  currentPath?: string;
  centerAction?: ReactNode;
}) {
  const staff = role === "admin" || role === "coach";
  const docked = placement === "bottom";
  const path = currentPath ?? "";

  if (docked && email) {
    return (
      <header
        data-bottom-dock
        className="sticky bottom-0 z-20 border-t border-line bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        {!hideMemberLinks && (role === "admin" || staff) ? (
          <div className="mx-auto flex max-w-3xl justify-end gap-1.5 px-3 pt-2">
            {role === "admin" ? (
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
        <div className="mx-auto flex max-w-3xl items-center gap-1 px-2 py-1.5">
          <Link
            href={homeHref ?? "/home"}
            className="flex shrink-0 items-center justify-center px-1"
          >
            <Logo variant="mark" size="sm" />
          </Link>
          <nav
            aria-label="Account"
            className="grid min-w-0 flex-1 grid-cols-5 items-end"
          >
            {BOTTOM_DOCK_LEFT.map((link) => (
              <DockLink
                key={link.href}
                href={link.href}
                label={link.label}
                active={isAccountNavActive(path, link.href)}
              />
            ))}
            <div className="flex items-center justify-center">{centerAction}</div>
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
            {!hideMemberLinks && role === "admin" ? (
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
