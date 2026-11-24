"use client";

import { manageSubscriptions } from "@/lib/native-purchases";

export function ManageStoreSubscriptionButton({
  label = "Manage subscription",
  className = "touch-target inline-flex items-center justify-center rounded-full bg-accent px-5 text-black",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <button type="button" className={className} onClick={() => void manageSubscriptions()}>
      {label}
    </button>
  );
}
