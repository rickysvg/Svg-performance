import Link from "next/link";
import { Logo } from "@/components/Logo";
import { logoutAction } from "@/app/actions/auth";

const chipClass =
  "inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-line px-3 text-xs hover:border-accent";

export function AppHeader({
  email,
  role,
  homeHref,
  hideMemberLinks = false,
}: {
  email?: string;
  role?: string;
  homeHref?: string;
  hideMemberLinks?: boolean;
}) {
  const staff = role === "admin" || role === "coach";
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5">
        <Link
          href={homeHref ?? (email ? "/home" : "/")}
          className="flex min-w-0 items-center gap-2.5"
        >
          <Logo variant="mark" size="sm" />
          <span className="truncate text-sm font-semibold tracking-tight text-foreground">
            SVG Performance
          </span>
        </Link>
        {email ? (
          <nav
            aria-label="Account"
            className="-mx-1 flex flex-wrap items-center justify-end gap-x-2 gap-y-2"
          >
            {!hideMemberLinks && role === "admin" ? (
              <Link href="/admin" className={chipClass}>
                Admin
              </Link>
            ) : null}
            {!hideMemberLinks && staff ? (
              <Link href="/staff/reports" className={chipClass}>
                Staff
              </Link>
            ) : null}
            {!hideMemberLinks ? (
              <>
                <Link href="/book" className={chipClass}>
                  Book
                </Link>
                <Link href="/shop" className={chipClass}>
                  Shop
                </Link>
                <Link href="/profile" className={chipClass}>
                  Profile
                </Link>
              </>
            ) : null}
            <form action={logoutAction} className="shrink-0">
              <button type="submit" className={`${chipClass} text-foreground`}>
                Log out
              </button>
            </form>
          </nav>
        ) : (
          <Link href="/login" className={chipClass}>
            Log in
          </Link>
        )}
      </div>
    </header>
  );
}
