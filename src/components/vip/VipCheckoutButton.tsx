"use client";

import { useActionState } from "react";
import { startVipCheckoutAction, type VipActionState } from "@/app/actions/vip";
import { StatusBanner } from "@/components/StatusBanner";

export function VipCheckoutButton() {
  const [state, action, pending] = useActionState(startVipCheckoutAction, {} as VipActionState);
  return (
    <form action={action} className="space-y-3" data-vip-checkout="1">
      <StatusBanner error={state.error} success={state.message} />
      <button
        type="submit"
        disabled={pending}
        className="touch-target w-full rounded-full bg-[#CBF805] font-semibold text-black disabled:opacity-60"
      >
        {pending ? "Opening…" : "Continue to checkout"}
      </button>
    </form>
  );
}
