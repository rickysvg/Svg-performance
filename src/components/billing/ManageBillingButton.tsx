"use client";

import { ManageStoreSubscriptionButton } from "@/components/native/ManageStoreSubscriptionButton";
import { useStoreBillingBlocked } from "@/components/native/useStoreBillingBlocked";

export function ManageBillingButton({
  label = "Manage billing",
  className = "touch-target inline-flex items-center justify-center rounded-full bg-accent px-5 text-black",
  store = "stripe",
}: {
  label?: string;
  className?: string;
  store?: string;
}) {
  // The Stripe billing portal can change plans, so the store app does not link to it.
  // A store subscription opens Apple or Google subscription settings instead.
  const storeBillingBlocked = useStoreBillingBlocked();
  if (storeBillingBlocked) {
    if (store === "app_store" || store === "play_store") {
      return <ManageStoreSubscriptionButton label="Manage subscription" className={className} />;
    }
    return null;
  }
  return (
    <form method="POST" action="/api/stripe/portal">
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
