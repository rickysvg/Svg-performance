"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type ActionState } from "@/app/actions/auth";
import { StatusBanner } from "@/components/StatusBanner";

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState(loginAction, {} as ActionState);

  return (
    <form action={action} className="mt-6 space-y-4">
      <StatusBanner error={state.error} success={notice} />
      <label className="block">
        <span className="text-sm font-medium">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-3"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-3"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent font-semibold text-black disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Log in"}
      </button>
      <p className="text-sm">
        <Link href="/forgot-password" className="text-accent underline-offset-4 hover:underline">
          Forgot password?
        </Link>
      </p>
    </form>
  );
}
