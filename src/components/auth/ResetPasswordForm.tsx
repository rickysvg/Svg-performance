"use client";

import { useActionState } from "react";
import { resetPasswordAction, type ActionState } from "@/app/actions/auth";
import { StatusBanner } from "@/components/StatusBanner";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(
    resetPasswordAction,
    {} as ActionState,
  );

  if (!token) {
    return (
      <p className="mt-6 text-sm text-danger">
        This reset link is missing a token. Request a new one.
      </p>
    );
  }

  return (
    <form action={action} className="mt-6 space-y-4">
      <StatusBanner error={state.error} />
      <input type="hidden" name="token" value={token} />
      <label className="block">
        <span className="text-sm font-medium">New password</span>
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
        <span className="text-sm font-medium">Confirm new password</span>
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-3"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent font-semibold text-black disabled:opacity-60"
      >
        {pending ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}
