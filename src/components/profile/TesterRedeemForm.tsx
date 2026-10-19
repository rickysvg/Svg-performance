"use client";

import { useActionState } from "react";
import { redeemTesterCodeAction, type TesterActionState } from "@/app/actions/tester";
import { StatusBanner } from "@/components/StatusBanner";

export function TesterRedeemForm() {
  const [state, action, pending] = useActionState(redeemTesterCodeAction, {} as TesterActionState);
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-line bg-card p-5" data-tester-redeem>
      <h2 className="text-lg">Tester code</h2>
      <p className="text-sm text-muted">
        Enter a code from Ricky. It turns on full Pro until Nov 16, with no card.
      </p>
      <StatusBanner error={state.error} success={state.success} />
      <input
        name="code"
        type="text"
        required
        autoComplete="off"
        autoCapitalize="characters"
        placeholder="SVG-••••••"
        className="w-full rounded-xl border border-line bg-background px-3 py-3 uppercase"
      />
      <button
        type="submit"
        disabled={pending}
        className="touch-target rounded-full bg-accent px-5 text-black disabled:opacity-60"
      >
        {pending ? "Applying…" : "Redeem code"}
      </button>
    </form>
  );
}
