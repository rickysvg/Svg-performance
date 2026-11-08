import { ManageBillingButton } from "@/components/billing/ManageBillingButton";

export function BillingProblemBanner({ status }: { status: string }) {
  const failed = status === "past_due" || status === "unpaid";
  return (
    <section
      data-billing-banner={status}
      className="mb-4 rounded-2xl border border-black bg-accent/20 p-4"
    >
      <p className="font-display text-xs uppercase tracking-[0.06em] text-black">Billing</p>
      <h2 className="mt-1 text-lg text-black">
        {failed ? "Payment didn't go through" : "Subscription canceled"}
      </h2>
      <p className="mt-1 text-sm text-black">
        {failed
          ? "Paid features are locked. Add a card in Manage billing. They open again as soon as the payment succeeds. No refunds except billing errors."
          : "Paid features are locked. Manage billing for invoices and your card, or subscribe again from Pricing. No refunds except billing errors."}
      </p>
      <div className="mt-3">
        <ManageBillingButton />
      </div>
    </section>
  );
}
