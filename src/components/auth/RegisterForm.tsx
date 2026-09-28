"use client";

import { useActionState, useEffect, useState } from "react";
import { registerAction, type ActionState } from "@/app/actions/auth";
import { StatusBanner } from "@/components/StatusBanner";

const SLOW_MS = 6_000;
const TIMEOUT_MS = 25_000;

type PendingPhase = "working" | "slow" | "timeout";

export function RegisterForm() {
  const [state, action, pending] = useActionState(
    registerAction,
    {} as ActionState,
  );
  const [phase, setPhase] = useState<PendingPhase>("working");

  useEffect(() => {
    if (!pending) return;
    const reset = window.setTimeout(() => setPhase("working"), 0);
    const slowTimer = window.setTimeout(() => setPhase("slow"), SLOW_MS);
    const timeoutTimer = window.setTimeout(() => setPhase("timeout"), TIMEOUT_MS);
    return () => {
      window.clearTimeout(reset);
      window.clearTimeout(slowTimer);
      window.clearTimeout(timeoutTimer);
    };
  }, [pending]);

  const buttonLabel = !pending
    ? "Create account"
    : phase === "slow" || phase === "timeout"
      ? "Still working, first sign-up can take a few seconds…"
      : "Creating account…";

  return (
    <form action={action} className="mt-6 space-y-4">
      <StatusBanner error={state.error} />
      {pending && phase === "timeout" ? (
        <StatusBanner error="This is taking too long. Refresh the page and try again." />
      ) : null}
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
        <span className="text-sm font-medium">Phone (optional)</span>
        <input
          name="phone"
          type="tel"
          autoComplete="tel"
          className="mt-1 w-full rounded-xl border border-line bg-card px-3 py-3"
        />
        <span className="mt-1 block text-xs text-muted">
          Helps match academy records with your last name and first initial. Not automatic —
          a coach reviews suggested phone matches.
        </span>
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
          You do not have to train at SVG to use this preview. Confirm your email after
          sign-up so we can match academy records, or a coach can verify you.
        </span>
      </label>
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="touch-target w-full rounded-full bg-accent px-4 text-black disabled:opacity-60"
      >
        {buttonLabel}
      </button>
    </form>
  );
}
