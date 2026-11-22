import { STORE_APP_BILLING_NOTE } from "@/lib/native-app";

/** Shown in the store app wherever the website offers Stripe Checkout. */
export function StoreAppBillingNote({ className = "" }: { className?: string }) {
  return (
    <p data-store-app-billing-note="1" className={`text-sm text-muted ${className}`.trim()}>
      {STORE_APP_BILLING_NOTE}
    </p>
  );
}
