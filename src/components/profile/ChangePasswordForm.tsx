"use client";

import { useActionState } from "react";
import { changePasswordAction, type ActionState } from "@/app/actions/auth";
import { StatusBanner } from "@/components/StatusBanner";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(
    changePasswordAction,
    {} as ActionState,
  );

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-line bg-card p-5">
      <h2 className="text-lg">Change password</h2>
      <StatusBanner error={state.error} />
      <label className="block">
        <span className="text-sm font-medium">Current password</span>
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">New password</span>
        <input
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
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
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full border border-line font-medium disabled:opacity-60"
      >
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
