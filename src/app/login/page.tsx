import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { LoginForm } from "@/components/auth/LoginForm";
import { safeNextPath } from "@/lib/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; changed?: string; next?: string }>;
}) {
  const query = await searchParams;
  const nextPath = safeNextPath(query.next) ?? undefined;
  const notice = query.reset
    ? "Password updated. Log in with the new password."
    : query.changed
      ? "Password changed. Log in again."
      : undefined;

  return (
    <div className="min-h-full">
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="text-2xl">Log in</h1>
        <p className="mt-2 text-sm text-muted">
          Welcome back. Your workouts stay on this account.
        </p>
        <LoginForm notice={notice} nextPath={nextPath} />
        <p className="mt-6 text-sm text-muted">
          New here?{" "}
          <Link href="/register" className="text-accent underline-offset-4 hover:underline">
            Create an account
          </Link>
        </p>
      </main>
    </div>
  );
}
