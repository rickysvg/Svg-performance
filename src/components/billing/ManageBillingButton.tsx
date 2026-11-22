"use client";

import { useStoreBillingBlocked } from "@/components/native/useStoreBillingBlocked";

export function ManageBillingButton({
  label = "Manage billing",
  className = "touch-target inline-flex items-center justify-center rounded-full bg-accent px-5 text-black",
}: {
  label?: string;
  className?: string;
}) {
  // The Stripe billing portal can change plans, so the store app does not link to it.
  const storeBillingBlocked = useStoreBillingBlocked();
  if (storeBillingBlocked) return null;
  return (
    <form method="POST" action="/api/stripe/portal">
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
