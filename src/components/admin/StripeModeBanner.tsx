import { stripeKeyMode } from "@/lib/stripe";

export function StripeModeBanner() {
  const mode = stripeKeyMode();
  if (mode === "live") {
    return (
      <p
        data-stripe-mode="live"
        className="rounded-xl border border-black bg-accent px-4 py-3 text-sm font-semibold text-black"
      >
        Stripe mode: LIVE. Charges are real.
      </p>
    );
  }
  if (mode === "test") {
    return (
      <p data-stripe-mode="test" className="rounded-xl border border-line bg-card px-4 py-3 text-sm">
        Stripe mode: TEST. No real charges.
      </p>
    );
  }
  if (mode === "invalid") {
    return (
      <p
        data-stripe-mode="invalid"
        className="rounded-xl border border-line bg-card px-4 py-3 text-sm"
      >
        Stripe secret key is set, but it is not a test or live secret key.
      </p>
    );
  }
  return (
    <p
      data-stripe-mode="unconfigured"
      className="rounded-xl border border-line bg-card px-4 py-3 text-sm text-muted"
    >
      Stripe is not configured. Checkout stays off.
    </p>
  );
}
