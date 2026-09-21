import Link from "next/link";
import { Logo } from "@/components/Logo";
import { logoutAction } from "@/app/actions/auth";

export function AppHeader({
  email,
  role,
}: {
  email?: string;
  role?: string;
}) {
  const staff = role === "admin" || role === "coach";
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link href={email ? "/home" : "/"} className="flex items-center gap-3">
          <Logo size="sm" />
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-wide">SVG Performance</p>
            <p className="text-xs text-muted">Member companion preview</p>
          </div>
        </Link>
        {email ? (
          <div className="flex items-center gap-2">
            {staff ? (
              <Link
                href="/staff/reports"
                className="touch-target inline-flex items-center rounded-full border border-line px-3 text-xs hover:border-accent"
              >
                Staff
              </Link>
            ) : null}
            <Link
              href="/book"
              className="touch-target inline-flex items-center rounded-full border border-line px-3 text-xs hover:border-accent"
            >
              Book
            </Link>
            <Link
              href="/shop"
              className="touch-target inline-flex items-center rounded-full border border-line px-3 text-xs hover:border-accent"
            >
              Shop
            </Link>
            <Link
              href="/profile"
              className="touch-target inline-flex items-center rounded-full border border-line px-3 text-xs hover:border-accent"
            >
              Profile
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="touch-target rounded-full border border-line px-4 text-sm text-foreground hover:border-accent"
              >
                Log out
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/login"
            className="touch-target inline-flex items-center rounded-full border border-line px-4 text-sm hover:border-accent"
          >
            Log in
          </Link>
        )}
      </div>
    </header>
  );
}
