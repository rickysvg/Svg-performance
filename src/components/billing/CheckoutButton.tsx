"use client";

import { useActionState } from "react";
import { startCheckoutAction, type BillingActionState } from "@/app/actions/billing";
import { StatusBanner } from "@/components/StatusBanner";
import type { CheckoutSkuId } from "@/lib/plans";

export function CheckoutButton({
  plan,
  label,
  disabledReason,
}: {
  plan: CheckoutSkuId;
  label: string;
  disabledReason?: string;
}) {
  const [state, action, pending] = useActionState(
    startCheckoutAction,
    {} as BillingActionState,
  );
  if (disabledReason) {
    return <p className="text-sm text-muted">{disabledReason}</p>;
  }
  return (
    <form action={action} className="space-y-2">
      <StatusBanner error={state.error} />
      <input type="hidden" name="plan" value={plan} />
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-accent font-semibold text-black disabled:opacity-60"
      >
        {pending ? "Opening Stripe…" : label}
      </button>
    </form>
  );
}
