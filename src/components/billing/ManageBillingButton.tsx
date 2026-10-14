"use client";

import { useActionState } from "react";
import { openBillingPortalAction, type BillingActionState } from "@/app/actions/billing";
import { StatusBanner } from "@/components/StatusBanner";

export function ManageBillingButton() {
  const [state, action, pending] = useActionState(
    openBillingPortalAction,
    {} as BillingActionState,
  );
  return (
    <form action={action} className="space-y-2">
      <StatusBanner error={state.error} />
      <button
        type="submit"
        disabled={pending}
        className="touch-target inline-flex items-center rounded-full bg-accent px-5 text-black disabled:opacity-60"
      >
        {pending ? "Opening billing…" : "Manage billing"}
      </button>
    </form>
  );
}
