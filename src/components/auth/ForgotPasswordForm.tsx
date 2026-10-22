"use client";

import { useActionState } from "react";
import { forgotPasswordAction, type ActionState } from "@/app/actions/auth";
import { StatusBanner } from "@/components/StatusBanner";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(
    forgotPasswordAction,
    {} as ActionState,
  );

  return (
    <form data-testid="forgot-password-form" action={action} className="mt-6 space-y-4">
      <StatusBanner error={state.error} success={state.success} />
      {process.env.NODE_ENV !== "production" && state.resetUrl ? (
        <p className="rounded-xl border border-line bg-card p-4 text-sm">
          <span className="font-semibold">Development only. </span>
          <a href={state.resetUrl} className="underline">
            Open reset link
          </a>
        </p>
      ) : null}
      <label className="block">
        <span className="text-sm font-medium">Email</span>
        <input
          data-testid="forgot-password-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-3"
        />
      </label>
      <button
        data-testid="forgot-password-request-reset-link"
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent text-black disabled:opacity-60"
      >
        {pending ? "Working…" : "Request reset link"}
      </button>
    </form>
  );
}
