import Stripe from "stripe";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return null;
  }
  if (key.startsWith("sk_live_")) {
    throw new Error("Live Stripe secret keys are not allowed in this preview.");
  }
  return new Stripe(key);
}

export function constructStripeEvent(payload: string, signature: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set.");
  }
  return Stripe.webhooks.constructEvent(payload, signature, secret);
}
