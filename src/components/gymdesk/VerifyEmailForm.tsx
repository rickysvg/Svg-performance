"use client";

import { useActionState } from "react";
import {
  confirmEmailCodeAction,
  sendEmailCodeAction,
  type EmailCodeState,
} from "@/app/actions/gymdesk";
import { StatusBanner } from "@/components/StatusBanner";

export function VerifyEmailForm({
  email,
  alreadyVerified,
}: {
  email: string;
  alreadyVerified: boolean;
}) {
  const [sendState, sendAction, sendPending] = useActionState(
    sendEmailCodeAction,
    {} as EmailCodeState,
  );
  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmEmailCodeAction,
    {} as EmailCodeState,
  );

  if (alreadyVerified) {
    return (
      <p className="mt-6 rounded-2xl border border-line bg-card px-4 py-3 text-sm">
        This email is already confirmed.
      </p>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <StatusBanner error={sendState.error} success={sendState.success} />
      <StatusBanner error={confirmState.error} success={confirmState.success} />

      <form action={sendAction}>
        <p className="text-sm text-muted">
          We will send a 6-digit code to <strong className="text-foreground">{email}</strong>.
        </p>
        <button
          type="submit"
          disabled={sendPending}
          className="font-display mt-4 touch-target w-full rounded-full bg-accent px-4 text-black uppercase tracking-[0.06em] disabled:opacity-60"
        >
          {sendPending ? "Sending…" : "Send code"}
        </button>
      </form>

      <form action={confirmAction} className="space-y-3">
        <label className="block">
          <span className="text-sm font-medium">6-digit code</span>
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            minLength={6}
            maxLength={6}
            pattern="[0-9]{6}"
            className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3 tracking-[0.24em]"
          />
        </label>
        <button
          type="submit"
          disabled={confirmPending}
          className="font-display touch-target w-full rounded-full border border-black px-4 uppercase tracking-[0.06em] disabled:opacity-60"
        >
          {confirmPending ? "Checking…" : "Confirm email"}
        </button>
      </form>
    </div>
  );
}
