"use client";

import { useActionState } from "react";
import { startCheckoutAction, type BillingActionState } from "@/app/actions/billing";
import { StatusBanner } from "@/components/StatusBanner";
import type { CheckoutSkuId } from "@/lib/plans";

export function CheckoutButton({
  plan,
  label,
  disabledReason,
  financingHint,
}: {
  plan: CheckoutSkuId;
  label: string;
  disabledReason?: string;
  financingHint?: string;
}) {
  const [state, action, pending] = useActionState(
    startCheckoutAction,
    {} as BillingActionState,
  );
  if (disabledReason) {
    return (
      <div className="space-y-1">
        <p className="text-sm text-muted">{disabledReason}</p>
        {financingHint ? <p className="text-xs text-muted">{financingHint}</p> : null}
      </div>
    );
  }
  return (
    <form action={action} className="space-y-2">
      <StatusBanner error={state.error} />
      <input type="hidden" name="plan" value={plan} />
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent text-black disabled:opacity-60"
      >
        {pending ? "Opening Stripe…" : label}
      </button>
      {financingHint ? <p className="text-xs text-muted">{financingHint}</p> : null}
    </form>
  );
}
