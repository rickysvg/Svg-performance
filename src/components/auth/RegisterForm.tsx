"use client";

import { useActionState } from "react";
import { registerAction, type ActionState } from "@/app/actions/auth";
import { StatusBanner } from "@/components/StatusBanner";

export function RegisterForm() {
  const [state, action, pending] = useActionState(
    registerAction,
    {} as ActionState,
  );

  return (
    <form action={action} className="mt-6 space-y-4">
      <StatusBanner error={state.error} />
      <label className="block">
        <span className="text-sm font-medium">Display name</span>
        <input
          name="displayName"
          type="text"
          autoComplete="name"
          required
          className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-3"
        />
      </label>
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
          autoComplete="new-password"
          required
          minLength={8}
          className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-3"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Confirm password</span>
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-3"
        />
      </label>
      <label className="flex items-start gap-3 rounded-xl border border-line bg-card p-4">
        <input
          name="isAdultConfirmed"
          type="checkbox"
          required
          className="mt-1 h-5 w-5 accent-accent"
        />
        <span className="text-sm">
          I confirm I am 18 or older. This preview is an adult pilot.
        </span>
      </label>
      <label className="flex items-start gap-3 rounded-xl border border-line bg-card p-4">
        <input
          name="claimsGymMembership"
          type="checkbox"
          className="mt-1 h-5 w-5 accent-accent"
        />
        <span className="text-sm">
          Optional. I train at SVG MMA Academy.{" "}
          <strong className="text-foreground">
            This does not grant member pricing or extra access.
          </strong>{" "}
          You do not have to train at SVG to use this preview. A coach or admin
          must verify gym membership separately.
        </span>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent text-black disabled:opacity-60"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
