"use client";

import { useActionState } from "react";
import { redeemAccessCodeAction, type AccessCodeActionState } from "@/app/actions/access-code";
import { StatusBanner } from "@/components/StatusBanner";

export function RedeemAccessCodeForm() {
  const [state, action, pending] = useActionState(
    redeemAccessCodeAction,
    {} as AccessCodeActionState,
  );
  return (
    <form action={action} data-testid="redeem-access-code" className="space-y-3">
      <h2 className="text-lg">Have a code?</h2>
      <p className="text-sm text-muted">
        Ricky can give you Pro with an access code. No card. It does not start or use your free trial.
      </p>
      <StatusBanner error={state.error} success={state.success} />
      <label className="block text-sm">
        Access code
        <input
          name="code"
          placeholder="SVG-XXXX-XXXX"
          autoComplete="off"
          spellCheck={false}
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3 font-telemetry tracking-wide"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="touch-target rounded-full bg-accent px-5 text-black disabled:opacity-60"
      >
        {pending ? "Checking…" : "Redeem code"}
      </button>
    </form>
  );
}
