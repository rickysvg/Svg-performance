"use client";

import { useActionState } from "react";
import { createTesterCodeAction, type TesterActionState } from "@/app/actions/tester";
import { StatusBanner } from "@/components/StatusBanner";

export function TesterCodeForm() {
  const [state, action, pending] = useActionState(createTesterCodeAction, {} as TesterActionState);
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-line bg-card p-5" data-tester-create>
      <h2>Generate a code</h2>
      <p className="text-sm text-muted">
        Each redemption gives full Pro until Nov 16, 2026. No card and no billing.
      </p>
      <StatusBanner error={state.error} success={state.success} />
      {state.code ? (
        <p className="font-display text-3xl tracking-wide text-accent" data-tester-code>
          {state.code}
        </p>
      ) : null}
      <label className="block text-sm">
        Max uses
        <input
          name="maxUses"
          type="number"
          required
          min={1}
          max={100}
          defaultValue={3}
          inputMode="numeric"
          className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-3"
        />
      </label>
      <input
        name="note"
        placeholder="Optional note, such as a name"
        className="w-full rounded-xl border border-line bg-background px-3 py-3"
      />
      <button
        type="submit"
        disabled={pending}
        className="touch-target rounded-full bg-accent px-5 text-black disabled:opacity-60"
      >
        {pending ? "Generating…" : "Generate code"}
      </button>
    </form>
  );
}
