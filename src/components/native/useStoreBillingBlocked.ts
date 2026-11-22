"use client";

import { useSyncExternalStore } from "react";
import { nativePlatform, storeBillingBlocksWebCheckout } from "@/lib/native-app";

// The platform never changes after load. Hydration renders the server snapshot
// (false), so ping React once after mount to compare against the real value.
function subscribeOnce(onChange: () => void) {
  const id = window.setTimeout(onChange, 0);
  return () => window.clearTimeout(id);
}

/**
 * True only inside the SVG Performance store app, where Stripe Checkout and the
 * Stripe billing portal must not be offered. Always false on the website and
 * during server render, so web markup is unchanged.
 */
export function useStoreBillingBlocked(): boolean {
  return useSyncExternalStore(
    subscribeOnce,
    () => storeBillingBlocksWebCheckout(nativePlatform()),
    () => false,
  );
}
