"use client";

import { useActionState } from "react";
import { joinWaitlistAction, type BillingActionState } from "@/app/actions/billing";
import { StatusBanner } from "@/components/StatusBanner";
import type { CatalogPlanId } from "@/lib/plans";

export function WaitlistButton({ plan }: { plan: CatalogPlanId }) {
  const [state, action, pending] = useActionState(
    joinWaitlistAction,
    {} as BillingActionState,
  );
  return (
    <form action={action} className="space-y-2">
      <StatusBanner error={state.error} success={state.success} />
      <input type="hidden" name="plan" value={plan} />
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full border border-line font-medium disabled:opacity-60"
      >
        {pending ? "Joining…" : "Join the waitlist"}
      </button>
    </form>
  );
}
