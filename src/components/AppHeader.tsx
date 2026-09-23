import Link from "next/link";
import { Logo } from "@/components/Logo";
import { logoutAction } from "@/app/actions/auth";
import { isAccountNavActive } from "@/lib/member-nav";

function chipClass(active = false, compact = false) {
  return `inline-flex shrink-0 items-center justify-center rounded-full border ${
    compact ? "h-8 px-2.5 text-[11px]" : "h-9 px-3 text-xs"
  } ${
    active
      ? "border-black bg-accent font-semibold text-black"
      : "border-line bg-background text-foreground hover:border-black"
  }`;
}

export function AppHeader({
  email,
  role,
  homeHref,
  hideMemberLinks = false,
  placement = "top",
  currentPath,
}: {
  email?: string;
  role?: string;
  homeHref?: string;
  hideMemberLinks?: boolean;
  placement?: "top" | "bottom";
  currentPath?: string;
}) {
  const staff = role === "admin" || role === "coach";
  const docked = placement === "bottom";
  const path = currentPath ?? "";

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
