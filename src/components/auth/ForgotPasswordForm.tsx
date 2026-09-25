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
    <form action={action} className="mt-6 space-y-4">
      <StatusBanner error={state.error} success={state.success} />
      {state.resetUrl ? (
        <p className="rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm">
          <span className="font-semibold text-accent">PREVIEW ONLY — </span>
          <a href={state.resetUrl} className="break-all underline">
            {state.resetUrl}
          </a>
        </p>
      ) : null}
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
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent text-black disabled:opacity-60"
      >
        {pending ? "Working…" : "Request reset link"}
      </button>
    </form>
  );
}
