import Link from "next/link";
import { Logo } from "@/components/Logo";
import { logoutAction } from "@/app/actions/auth";

export function AppHeader({ email }: { email?: string }) {
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
          <form action={logoutAction}>
            <button
              type="submit"
              className="touch-target rounded-full border border-line px-4 text-sm text-foreground hover:border-accent"
            >
              Log out
            </button>
          </form>
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
