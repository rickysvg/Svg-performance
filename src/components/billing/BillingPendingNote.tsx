export function BillingPendingNote() {
  return (
    <p className="mt-2 text-sm text-muted" data-billing-pending="1">
      Billing is pending. Stripe has the checkout, and this page will show Manage billing as soon as the customer is stored. Refresh in a moment if it does not appear.
    </p>
  );
}
